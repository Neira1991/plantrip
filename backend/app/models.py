import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_verification_token: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    email_verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    trips: Mapped[list["Trip"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    organization_memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint(
            "status IN ('planning', 'booked', 'completed', 'cancelled', 'active')",
            name="ck_trips_status",
        ),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_trips_currency"),
        Index("idx_trips_user_created", "user_id", "created_at"),
        Index("idx_trips_organization_id", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planning")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    owner: Mapped["User"] = relationship(back_populates="trips")
    organization: Mapped["Organization | None"] = relationship(back_populates="trips")
    stops: Mapped[list["TripStop"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    movements: Mapped[list["Movement"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    versions: Mapped[list["TripVersion"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    feedback: Mapped[list["ActivityFeedback"]] = relationship(back_populates="trip", cascade="all, delete-orphan")


class TripStop(Base):
    __tablename__ = "trip_stops"
    __table_args__ = (
        UniqueConstraint("trip_id", "sort_index", name="uq_trip_stop_sort"),
        CheckConstraint("nights >= 1", name="ck_trip_stop_nights_min"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    nights: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price_per_night: Mapped[float | None] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    trip: Mapped["Trip"] = relationship(back_populates="stops")
    activities: Mapped[list["Activity"]] = relationship(back_populates="stop", cascade="all, delete-orphan")
    movements_from: Mapped[list["Movement"]] = relationship(
        foreign_keys="Movement.from_stop_id", back_populates="from_stop", cascade="all, delete-orphan"
    )
    movements_to: Mapped[list["Movement"]] = relationship(
        foreign_keys="Movement.to_stop_id", back_populates="to_stop", cascade="all, delete-orphan"
    )


class Movement(Base):
    __tablename__ = "movements"
    __table_args__ = (
        CheckConstraint("from_stop_id != to_stop_id", name="ck_movement_different_stops"),
        CheckConstraint(
            "type IN ('train', 'car', 'plane', 'bus', 'ferry', 'walk', 'other')",
            name="ck_movement_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    from_stop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_stops.id", ondelete="CASCADE"), nullable=False)
    to_stop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_stops.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    departure_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrival_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    carrier: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    booking_ref: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price: Mapped[float | None] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    trip: Mapped["Trip"] = relationship(back_populates="movements")
    from_stop: Mapped["TripStop"] = relationship(foreign_keys=[from_stop_id], back_populates="movements_from")
    to_stop: Mapped["TripStop"] = relationship(foreign_keys=[to_stop_id], back_populates="movements_to")


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        UniqueConstraint("trip_stop_id", "sort_index", name="uq_activity_sort"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_stop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_stops.id", ondelete="CASCADE"), nullable=False)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    opening_hours: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price: Mapped[float | None] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=True)
    tips: Mapped[str] = mapped_column(Text, nullable=False, default="")
    website_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    guide_info: Mapped[str] = mapped_column(Text, nullable=False, default="")
    transport_info: Mapped[str] = mapped_column(Text, nullable=False, default="")
    opentripmap_xid: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    stop: Mapped["TripStop"] = relationship(back_populates="activities")
    photos: Mapped[list["ActivityPhoto"]] = relationship(back_populates="activity", cascade="all, delete-orphan")
    feedback: Mapped[list["ActivityFeedback"]] = relationship(back_populates="activity")


class ActivityPhoto(Base):
    __tablename__ = "activity_photos"
    __table_args__ = (
        UniqueConstraint("activity_id", "sort_index", name="uq_activity_photo_sort"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    thumbnail_url: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    attribution: Mapped[str] = mapped_column(Text, nullable=False, default="")
    photographer_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    photographer_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="unsplash")
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    activity: Mapped["Activity"] = relationship(back_populates="photos")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    invites: Mapped[list["OrganizationInvite"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    trips: Mapped[list["Trip"]] = relationship(back_populates="organization")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
        Index("idx_org_members_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="designer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization: Mapped["Organization"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="organization_memberships")


class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="designer")
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization: Mapped["Organization"] = relationship(back_populates="invites")


class ShareToken(Base):
    __tablename__ = "share_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    trip: Mapped["Trip"] = relationship("Trip")
    user: Mapped["User"] = relationship("User")
    feedback: Mapped[list["ActivityFeedback"]] = relationship(back_populates="share_token")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        Index("idx_password_reset_tokens_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship("User")


class ActivityFeedback(Base):
    __tablename__ = "activity_feedback"
    __table_args__ = (
        CheckConstraint("sentiment IN ('like', 'dislike')", name="ck_activity_feedback_sentiment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    share_token_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("share_tokens.id", ondelete="SET NULL"), nullable=True, index=True)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True)
    version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trip_versions.id", ondelete="SET NULL"), nullable=True, index=True)
    activity_title: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")
    viewer_session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    viewer_name: Mapped[str] = mapped_column(String(100), nullable=False, server_default="Anonymous")
    sentiment: Mapped[str] = mapped_column(String(10), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    trip: Mapped["Trip"] = relationship(back_populates="feedback")
    share_token: Mapped["ShareToken | None"] = relationship(back_populates="feedback")
    activity: Mapped["Activity | None"] = relationship(back_populates="feedback")
    version: Mapped["TripVersion | None"] = relationship("TripVersion", back_populates="feedback")


class TripVersion(Base):
    __tablename__ = "trip_versions"
    __table_args__ = (
        UniqueConstraint("trip_id", "version_number", name="uq_trip_versions_trip_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    trip: Mapped["Trip"] = relationship(back_populates="versions")
    feedback: Mapped[list["ActivityFeedback"]] = relationship(back_populates="version")
