from datetime import date as DateType, datetime, time as TimeType
from typing import Any
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
    currency: str = "EUR"


class TripUpdate(BaseModel):
    name: str | None = None
    country_code: str | None = None
    start_date: DateType | None = None
    status: str | None = None
    notes: str | None = None
    currency: str | None = None


class TripResponse(BaseModel):
    id: UUID
    name: str
    country_code: str
    start_date: DateType | None
    end_date: DateType | None
    status: str
    notes: str
    currency: str = "EUR"
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
    price_per_night: float | None = None

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
    price_per_night: float | None = None

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
    price_per_night: float | None = None
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
    price: float | None = None


class MovementUpdate(BaseModel):
    type: str | None = None
    duration_minutes: int | None = None
    departure_time: datetime | None = None
    arrival_time: datetime | None = None
    carrier: str | None = None
    booking_ref: str | None = None
    notes: str | None = None
    price: float | None = None


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
    price: float | None = None
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
    category: str = ""
    opening_hours: str = ""
    price: float | None = None
    tips: str = ""
    website_url: str = ""
    phone: str = ""
    rating: float | None = None
    guide_info: str = ""
    transport_info: str = ""
    opentripmap_xid: str = ""


class ActivityUpdate(BaseModel):
    title: str | None = None
    date: DateType | None = None
    start_time: TimeType | None = None
    duration_minutes: int | None = None
    lng: float | None = None
    lat: float | None = None
    address: str | None = None
    notes: str | None = None
    category: str | None = None
    opening_hours: str | None = None
    price: float | None = None
    tips: str | None = None
    website_url: str | None = None
    phone: str | None = None
    rating: float | None = None
    guide_info: str | None = None
    transport_info: str | None = None
    opentripmap_xid: str | None = None


class ActivityPhotoResponse(BaseModel):
    id: UUID
    url: str
    thumbnail_url: str
    attribution: str
    photographer_name: str
    photographer_url: str
    source: str
    width: int | None
    height: int | None
    sort_index: int

    model_config = {"from_attributes": True}


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
    category: str = ""
    opening_hours: str = ""
    price: float | None = None
    tips: str = ""
    website_url: str = ""
    phone: str = ""
    rating: float | None = None
    guide_info: str = ""
    transport_info: str = ""
    opentripmap_xid: str = ""
    photos: list[ActivityPhotoResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ActivityDetailResponse is the same as ActivityResponse (photos included)
ActivityDetailResponse = ActivityResponse


# --- Budget ---

class BudgetSummary(BaseModel):
    activities_total: float = 0.0
    accommodation_total: float = 0.0
    transport_total: float = 0.0
    grand_total: float = 0.0


# --- Itinerary ---

class ItineraryStopResponse(BaseModel):
    stop: TripStopResponse
    activities: list[ActivityResponse]
    movement_to_next: MovementResponse | None

    model_config = {"from_attributes": True}


class ItineraryResponse(BaseModel):
    trip: TripResponse
    stops: list[ItineraryStopResponse]
    budget: BudgetSummary = BudgetSummary()

    model_config = {"from_attributes": True}


# --- Share ---

class ShareTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    trip_id: UUID

    model_config = {"from_attributes": True}


class SharedTripResponse(BaseModel):
    trip_name: str
    country_code: str
    start_date: DateType | None
    end_date: DateType | None
    status: str
    currency: str = "EUR"
    stops: list[ItineraryStopResponse]
    budget: BudgetSummary = BudgetSummary()
    expires_at: datetime

    model_config = {"from_attributes": True}


# --- Places (OpenTripMap) ---

class PlacePoint(BaseModel):
    lat: float
    lon: float


class PlaceResponse(BaseModel):
    xid: str
    name: str
    kinds: str = ""
    point: PlacePoint
    rate: int = 0
    dist: float | None = None


class PlaceDetailResponse(BaseModel):
    xid: str
    name: str
    kinds: str = ""
    point: PlacePoint
    rate: int = 0
    wikipedia: str | None = None
    image: str | None = None
    preview: dict[str, Any] | None = None
    url: str | None = None
    address: dict[str, Any] | None = None
    wikipedia_extracts: dict[str, Any] | None = None


class GeonameResponse(BaseModel):
    name: str
    lat: float
    lon: float
    population: int = 0
    country: str = ""
