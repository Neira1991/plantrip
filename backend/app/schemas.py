from datetime import date as DateType, datetime, time as TimeType
from typing import Any
from uuid import UUID

from pydantic import BaseModel, field_validator

VALID_ROLES = {"admin", "designer"}


def validate_role_value(v: str) -> str:
    if v not in VALID_ROLES:
        raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}")
    return v


# --- Auth ---

class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class OrgInfo(BaseModel):
    id: UUID
    name: str
    slug: str
    role: str

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: UUID
    email: str
    email_verified: bool = False
    created_at: datetime
    organization: OrgInfo | None = None

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


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


# --- Organization ---

class OrganizationCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 1 or len(v) > 200:
            raise ValueError("Organization name must be between 1 and 200 characters")
        return v


class OrganizationUpdate(BaseModel):
    name: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v or len(v) < 1 or len(v) > 200:
                raise ValueError("Organization name must be between 1 and 200 characters")
        return v


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class OrganizationMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    role: str
    trip_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class InviteCreate(BaseModel):
    email: str
    role: str = "designer"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        if len(v) > 320:
            raise ValueError("Email address too long")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return validate_role_value(v)


class InviteResponse(BaseModel):
    id: UUID
    email: str
    role: str
    token: str
    expires_at: datetime
    created_at: datetime
    accepted_at: datetime | None = None

    model_config = {"from_attributes": True}


class OrgTripResponse(BaseModel):
    id: UUID
    name: str
    country_code: str
    status: str
    start_date: DateType | None
    end_date: DateType | None
    created_at: datetime
    designer_email: str

    model_config = {"from_attributes": True}


class TripsPerDesigner(BaseModel):
    email: str
    count: int


class OrgStatsResponse(BaseModel):
    total_trips: int
    total_members: int
    trips_by_designer: list[TripsPerDesigner]
    trips_by_status: dict[str, int]


class UpdateMemberRoleRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return validate_role_value(v)


# --- Feedback ---

class FeedbackCreate(BaseModel):
    activity_id: UUID
    viewer_session_id: str
    viewer_name: str = "Anonymous"
    sentiment: str
    message: str = ""

    @field_validator("sentiment")
    @classmethod
    def validate_sentiment(cls, v: str) -> str:
        if v not in ["like", "dislike"]:
            raise ValueError("sentiment must be 'like' or 'dislike'")
        return v

    @field_validator("viewer_name")
    @classmethod
    def validate_viewer_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            v = "Anonymous"
        if len(v) > 100:
            raise ValueError("viewer_name must be at most 100 characters")
        return v

    @field_validator("viewer_session_id")
    @classmethod
    def validate_viewer_session_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("viewer_session_id is required")
        if len(v) > 64:
            raise ValueError("viewer_session_id must be at most 64 characters")
        return v


class FeedbackResponse(BaseModel):
    id: UUID
    activity_id: UUID | None
    activity_title: str = ""
    viewer_name: str
    sentiment: str
    message: str
    version_number: int | None = None
    version_label: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityFeedbackSummary(BaseModel):
    activity_id: UUID | None
    activity_title: str
    likes: int
    dislikes: int
    feedback: list[FeedbackResponse]


class VersionFeedbackGroup(BaseModel):
    version_id: UUID | None
    version_number: int | None
    version_label: str | None
    activities: list[ActivityFeedbackSummary]


class TripFeedbackResponse(BaseModel):
    trip_id: UUID
    versions: list[VersionFeedbackGroup]


# --- Trip Versions ---

class VersionCreate(BaseModel):
    label: str = ""

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 200:
            raise ValueError("label must be at most 200 characters")
        return v


class VersionMetaResponse(BaseModel):
    id: UUID
    trip_id: UUID
    version_number: int
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionDetailResponse(BaseModel):
    id: UUID
    trip_id: UUID
    version_number: int
    label: str
    snapshot_data: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
