from datetime import date as DateType, datetime, time as TimeType
from uuid import UUID

from pydantic import BaseModel, field_validator


# --- Auth ---

class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Trip ---

class TripCreate(BaseModel):
    name: str
    country_code: str
    start_date: DateType
    status: str = "planning"
    notes: str = ""


class TripUpdate(BaseModel):
    name: str | None = None
    country_code: str | None = None
    start_date: DateType | None = None
    status: str | None = None
    notes: str | None = None


class TripResponse(BaseModel):
    id: UUID
    name: str
    country_code: str
    start_date: DateType | None
    end_date: DateType | None
    status: str
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- TripStop ---

class TripStopCreate(BaseModel):
    name: str
    lng: float
    lat: float
    notes: str = ""
    nights: int = 1

    @field_validator("nights")
    @classmethod
    def nights_min(cls, v: int) -> int:
        if v < 1:
            raise ValueError("nights must be at least 1")
        return v


class TripStopUpdate(BaseModel):
    name: str | None = None
    lng: float | None = None
    lat: float | None = None
    notes: str | None = None
    nights: int | None = None

    @field_validator("nights")
    @classmethod
    def nights_min(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("nights must be at least 1")
        return v


class TripStopResponse(BaseModel):
    id: UUID
    trip_id: UUID
    sort_index: int
    name: str
    lng: float
    lat: float
    notes: str
    nights: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripStopReorder(BaseModel):
    from_index: int
    to_index: int


# --- Movement ---

class MovementCreate(BaseModel):
    from_stop_id: UUID
    to_stop_id: UUID
    type: str
    duration_minutes: int | None = None
    departure_time: datetime | None = None
    arrival_time: datetime | None = None
    carrier: str = ""
    booking_ref: str = ""
    notes: str = ""


class MovementUpdate(BaseModel):
    type: str | None = None
    duration_minutes: int | None = None
    departure_time: datetime | None = None
    arrival_time: datetime | None = None
    carrier: str | None = None
    booking_ref: str | None = None
    notes: str | None = None


class MovementResponse(BaseModel):
    id: UUID
    trip_id: UUID
    from_stop_id: UUID
    to_stop_id: UUID
    type: str
    duration_minutes: int | None
    departure_time: datetime | None
    arrival_time: datetime | None
    carrier: str
    booking_ref: str
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Activity ---

class ActivityCreate(BaseModel):
    title: str
    date: DateType | None = None
    start_time: TimeType | None = None
    duration_minutes: int | None = None
    lng: float | None = None
    lat: float | None = None
    address: str = ""
    notes: str = ""


class ActivityUpdate(BaseModel):
    title: str | None = None
    date: DateType | None = None
    start_time: TimeType | None = None
    duration_minutes: int | None = None
    lng: float | None = None
    lat: float | None = None
    address: str | None = None
    notes: str | None = None


class ActivityResponse(BaseModel):
    id: UUID
    trip_stop_id: UUID
    sort_index: int
    title: str
    date: DateType | None
    start_time: TimeType | None
    duration_minutes: int | None
    lng: float | None
    lat: float | None
    address: str
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Itinerary ---

class ItineraryStopResponse(BaseModel):
    stop: TripStopResponse
    activities: list[ActivityResponse]
    movement_to_next: MovementResponse | None

    model_config = {"from_attributes": True}


class ItineraryResponse(BaseModel):
    trip: TripResponse
    stops: list[ItineraryStopResponse]

    model_config = {"from_attributes": True}
