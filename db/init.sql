-- PlanTrip Database Schema v4 (consolidated)
--
-- Changelog vs v3:
--   • NUMERIC(12,2) for all money columns (was DOUBLE PRECISION / FLOAT)
--   • SHA-256 hashed email-verification & password-reset tokens
--   • CHECK constraints on trips.status, movements.type, trips.currency
--   • Removed UNIQUE(from_stop_id, to_stop_id) on movements (round-trips)
--   • Feedback gets direct trip_id FK; share_token_id nullable + SET NULL
--   • activity_photos sort_index UNIQUE per activity (DEFERRABLE)
--   • users.hashed_password widened to VARCHAR(256)
--   • All timestamps NOT NULL with DEFAULT NOW()
--   • Improved index strategy (composite, removed redundant)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- users
-- ============================================================================

CREATE TABLE users (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       VARCHAR(320)  NOT NULL UNIQUE,
  hashed_password             VARCHAR(256)  NOT NULL,
  email_verified              BOOLEAN       NOT NULL DEFAULT FALSE,
  email_verification_token    VARCHAR(128)  UNIQUE,
  email_verification_sent_at  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- organizations
-- ============================================================================

CREATE TABLE organizations (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200)  NOT NULL,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- organization_members
-- ============================================================================

CREATE TABLE organization_members (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL DEFAULT 'designer',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_member UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON organization_members (user_id);

-- ============================================================================
-- organization_invites
-- ============================================================================

CREATE TABLE organization_invites (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             VARCHAR(320)  NOT NULL,
  role              VARCHAR(20)   NOT NULL DEFAULT 'designer',
  token             VARCHAR(64)   NOT NULL UNIQUE,
  expires_at        TIMESTAMPTZ   NOT NULL,
  accepted_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_invites_token ON organization_invites (token);

-- ============================================================================
-- trips
-- ============================================================================

CREATE TABLE trips (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID          REFERENCES organizations(id) ON DELETE SET NULL,
  name            VARCHAR(200)  NOT NULL,
  country_code    VARCHAR(10)   NOT NULL,
  start_date      DATE          NOT NULL,
  end_date        DATE,
  status          VARCHAR(20)   NOT NULL DEFAULT 'planning',
  notes           TEXT          NOT NULL DEFAULT '',
  currency        VARCHAR(3)    NOT NULL DEFAULT 'EUR',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_trips_status CHECK (
    status IN ('planning', 'booked', 'completed', 'cancelled', 'active')
  ),
  CONSTRAINT ck_trips_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_trips_user_created ON trips (user_id, created_at DESC);
CREATE INDEX idx_trips_organization_id ON trips (organization_id);
CREATE INDEX idx_trips_country_code ON trips (country_code);

-- ============================================================================
-- trip_stops
-- ============================================================================

CREATE TABLE trip_stops (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID              NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sort_index      INTEGER           NOT NULL,
  name            VARCHAR(200)      NOT NULL,
  lng             DOUBLE PRECISION  NOT NULL,
  lat             DOUBLE PRECISION  NOT NULL,
  notes           TEXT              NOT NULL DEFAULT '',
  nights          INTEGER           NOT NULL DEFAULT 1,
  price_per_night NUMERIC(12,2),
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_trip_stop_nights_min CHECK (nights >= 1),
  CONSTRAINT uq_trip_stop_sort UNIQUE (trip_id, sort_index) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_trip_stops_trip_id ON trip_stops (trip_id);

-- ============================================================================
-- movements
-- ============================================================================

CREATE TABLE movements (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           UUID          NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_stop_id      UUID          NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  to_stop_id        UUID          NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  type              VARCHAR(20)   NOT NULL,
  duration_minutes  INTEGER,
  departure_time    TIMESTAMPTZ,
  arrival_time      TIMESTAMPTZ,
  carrier           VARCHAR(200)  NOT NULL DEFAULT '',
  booking_ref       VARCHAR(200)  NOT NULL DEFAULT '',
  notes             TEXT          NOT NULL DEFAULT '',
  price             NUMERIC(12,2),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_movement_different_stops CHECK (from_stop_id != to_stop_id),
  CONSTRAINT ck_movement_type CHECK (
    type IN ('train', 'car', 'plane', 'bus', 'ferry', 'walk', 'other')
  )
);

CREATE INDEX idx_movements_trip_id      ON movements (trip_id);
CREATE INDEX idx_movements_from_stop_id ON movements (from_stop_id);
CREATE INDEX idx_movements_to_stop_id   ON movements (to_stop_id);

-- ============================================================================
-- activities
-- ============================================================================

CREATE TABLE activities (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_stop_id      UUID              NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  sort_index        INTEGER           NOT NULL,
  title             VARCHAR(200)      NOT NULL,
  date              DATE,
  start_time        TIME,
  duration_minutes  INTEGER,
  lng               DOUBLE PRECISION,
  lat               DOUBLE PRECISION,
  address           TEXT              NOT NULL DEFAULT '',
  notes             TEXT              NOT NULL DEFAULT '',
  category          VARCHAR(100)      NOT NULL DEFAULT '',
  opening_hours     TEXT              NOT NULL DEFAULT '',
  price             NUMERIC(12,2),
  tips              TEXT              NOT NULL DEFAULT '',
  website_url       VARCHAR(500)      NOT NULL DEFAULT '',
  phone             VARCHAR(50)       NOT NULL DEFAULT '',
  rating            DOUBLE PRECISION,
  guide_info        TEXT              NOT NULL DEFAULT '',
  transport_info    TEXT              NOT NULL DEFAULT '',
  opentripmap_xid   VARCHAR(100)      NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_activity_sort UNIQUE (trip_stop_id, sort_index) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_activities_trip_stop_id ON activities (trip_stop_id);

-- ============================================================================
-- activity_photos
-- ============================================================================

CREATE TABLE activity_photos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id         UUID          NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  url                 VARCHAR(1000) NOT NULL,
  thumbnail_url       VARCHAR(1000) NOT NULL DEFAULT '',
  attribution         TEXT          NOT NULL DEFAULT '',
  photographer_name   VARCHAR(200)  NOT NULL DEFAULT '',
  photographer_url    VARCHAR(500)  NOT NULL DEFAULT '',
  source              VARCHAR(50)   NOT NULL DEFAULT 'unsplash',
  width               INTEGER,
  height              INTEGER,
  sort_index          INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_activity_photo_sort UNIQUE (activity_id, sort_index)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_activity_photos_activity_id ON activity_photos (activity_id);

-- ============================================================================
-- share_tokens
-- ============================================================================

CREATE TABLE share_tokens (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID          NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(64)   NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ   NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_tokens_token   ON share_tokens (token);
CREATE INDEX idx_share_tokens_trip_id ON share_tokens (trip_id);

-- ============================================================================
-- password_reset_tokens
-- ============================================================================

CREATE TABLE password_reset_tokens (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(128)  NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ   NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);

-- ============================================================================
-- trip_versions
-- ============================================================================

CREATE TABLE trip_versions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  label           VARCHAR(200) NOT NULL DEFAULT '',
  snapshot_data   JSONB   NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_trip_versions_trip_version UNIQUE (trip_id, version_number)
);

CREATE INDEX idx_trip_versions_trip_id ON trip_versions (trip_id);

-- ============================================================================
-- activity_feedback
-- ============================================================================

CREATE TABLE activity_feedback (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID          NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  share_token_id      UUID          REFERENCES share_tokens(id) ON DELETE SET NULL,
  activity_id         UUID          REFERENCES activities(id) ON DELETE SET NULL,
  version_id          UUID          REFERENCES trip_versions(id) ON DELETE SET NULL,
  activity_title      VARCHAR(200)  NOT NULL DEFAULT '',
  viewer_session_id   VARCHAR(64)   NOT NULL,
  viewer_name         VARCHAR(100)  NOT NULL DEFAULT 'Anonymous',
  sentiment           VARCHAR(10)   NOT NULL,
  message             TEXT          NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_activity_feedback_sentiment CHECK (sentiment IN ('like', 'dislike'))
);

CREATE INDEX idx_activity_feedback_trip_id        ON activity_feedback (trip_id);
CREATE INDEX idx_activity_feedback_share_token_id ON activity_feedback (share_token_id);
CREATE INDEX idx_activity_feedback_activity_id    ON activity_feedback (activity_id);
CREATE INDEX idx_activity_feedback_version_id     ON activity_feedback (version_id);
