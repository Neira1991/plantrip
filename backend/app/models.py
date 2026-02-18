import uuid
from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    trips: Mapped[list["Trip"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planning")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    owner: Mapped["User"] = relationship(back_populates="trips")
    stops: Mapped[list["TripStop"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    movements: Mapped[list["Movement"]] = relationship(back_populates="trip", cascade="all, delete-orphan")


class TripStop(Base):
    __tablename__ = "trip_stops"
    __table_args__ = (
        UniqueConstraint("trip_id", "sort_index", name="uq_trip_stop_sort"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

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
        UniqueConstraint("from_stop_id", "to_stop_id", name="uq_movement_stops"),
        CheckConstraint("from_stop_id != to_stop_id", name="ck_movement_different_stops"),
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

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
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    stop: Mapped["TripStop"] = relationship(back_populates="activities")
