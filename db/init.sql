-- PlanTrip Database Schema v3 (with auth)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- users
-- ============================================================================

CREATE TABLE users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(320)  NOT NULL UNIQUE,
  hashed_password VARCHAR(128)  NOT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================================
-- trips
-- ============================================================================

CREATE TABLE trips (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(200)  NOT NULL,
  country_code  VARCHAR(10)   NOT NULL,
  start_date    DATE          NOT NULL,
  end_date      DATE,
  status        VARCHAR(20)   NOT NULL DEFAULT 'planning',
  notes         TEXT          DEFAULT '',
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_trips_user_id      ON trips (user_id);
CREATE INDEX idx_trips_country_code ON trips (country_code);
CREATE INDEX idx_trips_status       ON trips (status);

-- ============================================================================
-- trip_stops
-- ============================================================================

CREATE TABLE trip_stops (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID              NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sort_index  INTEGER           NOT NULL,
  name        VARCHAR(200)      NOT NULL,
  lng         DOUBLE PRECISION  NOT NULL,
  lat         DOUBLE PRECISION  NOT NULL,
  notes       TEXT              DEFAULT '',
  nights      INTEGER           NOT NULL DEFAULT 1 CHECK (nights >= 1),
  created_at  TIMESTAMPTZ       DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       DEFAULT NOW(),
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
  carrier           VARCHAR(200)  DEFAULT '',
  booking_ref       VARCHAR(200)  DEFAULT '',
  notes             TEXT          DEFAULT '',
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (from_stop_id, to_stop_id),
  CHECK  (from_stop_id != to_stop_id)
);

CREATE INDEX idx_movements_trip_id      ON movements (trip_id);
CREATE INDEX idx_movements_from_stop_id ON movements (from_stop_id);
CREATE INDEX idx_movements_to_stop_id   ON movements (to_stop_id);

-- ============================================================================
-- activities
-- ============================================================================

CREATE TABLE activities (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_stop_id      UUID          NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  sort_index        INTEGER       NOT NULL,
  title             VARCHAR(200)  NOT NULL,
  date              DATE,
  start_time        TIME,
  duration_minutes  INTEGER,
  lng               DOUBLE PRECISION,
  lat               DOUBLE PRECISION,
  address           TEXT          DEFAULT '',
  notes             TEXT          DEFAULT '',
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW(),
  CONSTRAINT uq_activity_sort UNIQUE (trip_stop_id, sort_index) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_activities_trip_stop_id ON activities (trip_stop_id);
