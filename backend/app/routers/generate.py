from datetime import time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.dependencies import TESTING, limiter, load_itinerary, verify_trip_ownership
from app.models import Activity, Movement, Trip, TripStop, User
from app.routers.stops import recalculate_end_date
from app.routers.trips import compute_budget
from app.schemas import (
    ItineraryResponse,
    ItineraryStopResponse,
)

router = APIRouter(tags=["generate"])

VALID_MOVEMENT_TYPES = {"train", "bus", "flight", "car", "ferry", "walk"}
VALID_CATEGORIES = {
    "sightseeing", "food", "museum", "outdoors", "shopping",
    "nightlife", "culture", "relaxation", "adventure", "transport", ""
}
MAX_STOPS = 20


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)


# ── Canned test data ──

def _canned_itinerary():
    return {
        "stops": [
            {
                "name": "Rome",
                "lng": 12.4964,
                "lat": 41.9028,
                "nights": 2,
                "notes": "Explore the Eternal City",
                "price_per_night": 120.0,
                "activities": [
                    {
                        "title": "Visit the Colosseum",
                        "day_offset": 0,
                        "start_time": "09:00",
                        "duration_minutes": 120,
                        "lng": 12.4922,
                        "lat": 41.8902,
                        "address": "Piazza del Colosseo, 1, Rome",
                        "notes": "Book tickets in advance",
                        "category": "sightseeing",
                        "price": 16.0,
                    }
                ],
            },
            {
                "name": "Florence",
                "lng": 11.2558,
                "lat": 43.7696,
                "nights": 2,
                "notes": "Renaissance art and culture",
                "price_per_night": 110.0,
                "activities": [
                    {
                        "title": "Uffizi Gallery",
                        "day_offset": 0,
                        "start_time": "10:00",
                        "duration_minutes": 180,
                        "lng": 11.2551,
                        "lat": 43.7677,
                        "address": "Piazzale degli Uffizi, Florence",
                        "notes": "One of the world's greatest art museums",
                        "category": "museum",
                        "price": 20.0,
                    }
                ],
            },
        ],
        "movements": [
            {
                "from_stop_index": 0,
                "to_stop_index": 1,
                "type": "train",
                "duration_minutes": 95,
                "carrier": "Trenitalia",
                "notes": "High-speed train Roma Termini to Firenze SMN",
                "price": 45.0,
            }
        ],
    }


# ── Tool schema for Claude ──

ITINERARY_TOOL = {
    "name": "create_itinerary",
    "description": "Create a complete trip itinerary with stops, activities, and movements between stops.",
    "input_schema": {
        "type": "object",
        "required": ["stops"],
        "properties": {
            "stops": {
                "type": "array",
                "description": "Ordered list of stops (cities/places) to visit",
                "items": {
                    "type": "object",
                    "required": ["name", "lng", "lat", "nights"],
                    "properties": {
                        "name": {"type": "string", "description": "City or place name"},
                        "lng": {"type": "number", "description": "Longitude (-180 to 180)"},
                        "lat": {"type": "number", "description": "Latitude (-90 to 90)"},
                        "nights": {"type": "integer", "minimum": 1, "description": "Number of nights to stay"},
                        "notes": {"type": "string", "description": "Brief description of the stop"},
                        "price_per_night": {"type": "number", "description": "Estimated accommodation cost per night in trip currency"},
                        "activities": {
                            "type": "array",
                            "description": "Activities at this stop",
                            "items": {
                                "type": "object",
                                "required": ["title", "day_offset"],
                                "properties": {
                                    "title": {"type": "string", "description": "Activity name"},
                                    "day_offset": {"type": "integer", "minimum": 0, "description": "Day offset from arrival at this stop (0 = first day)"},
                                    "start_time": {"type": "string", "description": "Start time in HH:MM format (24h)"},
                                    "duration_minutes": {"type": "integer", "description": "Duration in minutes"},
                                    "lng": {"type": "number", "description": "Longitude of the activity location"},
                                    "lat": {"type": "number", "description": "Latitude of the activity location"},
                                    "address": {"type": "string", "description": "Street address"},
                                    "notes": {"type": "string", "description": "Tips or notes about the activity"},
                                    "category": {
                                        "type": "string",
                                        "enum": ["sightseeing", "food", "museum", "outdoors", "shopping", "nightlife", "culture", "relaxation", "adventure", "transport"],
                                        "description": "Activity category"
                                    },
                                    "price": {"type": "number", "description": "Estimated cost in trip currency"},
                                },
                            },
                        },
                    },
                },
            },
            "movements": {
                "type": "array",
                "description": "Transport between stops",
                "items": {
                    "type": "object",
                    "required": ["from_stop_index", "to_stop_index", "type"],
                    "properties": {
                        "from_stop_index": {"type": "integer", "description": "Index of departure stop in the stops array"},
                        "to_stop_index": {"type": "integer", "description": "Index of arrival stop in the stops array"},
                        "type": {
                            "type": "string",
                            "enum": ["train", "bus", "flight", "car", "ferry", "walk"],
                            "description": "Transport type"
                        },
                        "duration_minutes": {"type": "integer", "description": "Travel duration in minutes"},
                        "carrier": {"type": "string", "description": "Transport company or service name"},
                        "notes": {"type": "string", "description": "Booking tips or notes"},
                        "price": {"type": "number", "description": "Estimated cost in trip currency"},
                    },
                },
            },
        },
    },
}


def _build_system_prompt(trip: Trip) -> str:
    return (
        f"You are a travel planning assistant. Create a detailed trip itinerary.\n\n"
        f"Trip details:\n"
        f"- Country: {trip.country_code}\n"
        f"- Start date: {trip.start_date.isoformat()}\n"
        f"- Currency: {trip.currency}\n\n"
        f"Guidelines:\n"
        f"- Use accurate real-world coordinates (longitude, latitude) for all stops and activities\n"
        f"- Provide realistic prices and durations in {trip.currency}\n"
        f"- Plan 2-4 activities per day\n"
        f"- Include a mix of activity categories (sightseeing, food, museum, culture, etc.)\n"
        f"- Add transport movements between consecutive stops\n"
        f"- Set appropriate number of nights for each stop based on the number of activities\n"
        f"- You MUST call the create_itinerary tool with your response\n"
    )


def _validate_coordinate(lng: float, lat: float) -> tuple[float, float]:
    lng = max(-180.0, min(180.0, float(lng)))
    lat = max(-90.0, min(90.0, float(lat)))
    return lng, lat


def _parse_time(time_str: str | None) -> time | None:
    if not time_str:
        return None
    try:
        parts = time_str.strip().split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


@router.post("/trips/{trip_id}/generate", response_model=ItineraryResponse)
@limiter.limit("3/hour")
async def generate_itinerary(
    request: Request,
    trip_id: UUID,
    data: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify trip ownership
    trip = await verify_trip_ownership(trip_id, user, db)

    # 2. Determine itinerary data
    if TESTING and data.prompt.startswith("__TEST__"):
        tool_input = _canned_itinerary()
    else:
        # Guard: API key required
        if not settings.ANTHROPIC_API_KEY:
            raise HTTPException(status_code=503, detail="AI generation is not configured")

        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        try:
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=_build_system_prompt(trip),
                messages=[{"role": "user", "content": data.prompt}],
                tools=[ITINERARY_TOOL],
                tool_choice={"type": "tool", "name": "create_itinerary"},
            )
        except anthropic.AuthenticationError:
            raise HTTPException(status_code=503, detail="Invalid Anthropic API key")
        except anthropic.BadRequestError as e:
            msg = str(e)
            if "credit balance" in msg.lower():
                raise HTTPException(status_code=503, detail="Anthropic account has insufficient credits")
            raise HTTPException(status_code=502, detail="AI request failed")
        except anthropic.APIError:
            raise HTTPException(status_code=502, detail="AI service is temporarily unavailable")

        # Extract tool_use result
        tool_input = None
        for block in response.content:
            if block.type == "tool_use" and block.name == "create_itinerary":
                tool_input = block.input
                break

        if not tool_input or "stops" not in tool_input:
            raise HTTPException(status_code=502, detail="AI did not generate a valid itinerary")

    raw_stops = tool_input.get("stops", [])
    raw_movements = tool_input.get("movements", [])

    # Validate
    if not raw_stops:
        raise HTTPException(status_code=422, detail="No stops generated")
    if len(raw_stops) > MAX_STOPS:
        raw_stops = raw_stops[:MAX_STOPS]

    # 3. Clear existing data
    await db.execute(delete(Movement).where(Movement.trip_id == trip_id))
    await db.execute(delete(TripStop).where(TripStop.trip_id == trip_id))
    await db.flush()

    # 4. Defer unique constraint for sort_index
    await db.execute(text("SET CONSTRAINTS uq_trip_stop_sort DEFERRED"))

    # 5. Insert stops
    created_stops = []
    cumulative_nights = []
    nights_so_far = 0
    for idx, raw_stop in enumerate(raw_stops):
        lng, lat = _validate_coordinate(
            raw_stop.get("lng", 0),
            raw_stop.get("lat", 0),
        )
        nights = max(1, int(raw_stop.get("nights", 1)))
        stop = TripStop(
            trip_id=trip_id,
            sort_index=idx,
            name=str(raw_stop.get("name", "Unknown"))[:200],
            lng=lng,
            lat=lat,
            notes=str(raw_stop.get("notes", ""))[:10000],
            nights=nights,
            price_per_night=raw_stop.get("price_per_night"),
        )
        db.add(stop)
        created_stops.append(stop)
        cumulative_nights.append(nights_so_far)
        nights_so_far += nights

    await db.flush()

    # 6. Insert activities
    all_activities = []
    for stop_idx, raw_stop in enumerate(raw_stops):
        raw_activities = raw_stop.get("activities", [])
        for act_idx, raw_act in enumerate(raw_activities):
            day_offset = max(0, int(raw_act.get("day_offset", 0)))
            activity_date = trip.start_date + timedelta(
                days=cumulative_nights[stop_idx] + day_offset
            )
            act_lng = raw_act.get("lng")
            act_lat = raw_act.get("lat")
            if act_lng is not None and act_lat is not None:
                act_lng, act_lat = _validate_coordinate(act_lng, act_lat)
            else:
                act_lng, act_lat = None, None

            category = str(raw_act.get("category", ""))
            if category not in VALID_CATEGORIES:
                category = ""

            activity = Activity(
                trip_stop_id=created_stops[stop_idx].id,
                sort_index=act_idx,
                title=str(raw_act.get("title", "Activity"))[:200],
                date=activity_date,
                start_time=_parse_time(raw_act.get("start_time")),
                duration_minutes=raw_act.get("duration_minutes"),
                lng=act_lng,
                lat=act_lat,
                address=str(raw_act.get("address", ""))[:500],
                notes=str(raw_act.get("notes", ""))[:10000],
                category=category,
                price=raw_act.get("price"),
            )
            db.add(activity)
            all_activities.append(activity)

    await db.flush()

    # 7. Insert movements
    created_movements = []
    seen_pairs = set()
    for raw_mov in raw_movements:
        from_idx = raw_mov.get("from_stop_index")
        to_idx = raw_mov.get("to_stop_index")
        if (
            from_idx is None
            or to_idx is None
            or from_idx < 0
            or to_idx < 0
            or from_idx >= len(created_stops)
            or to_idx >= len(created_stops)
            or from_idx == to_idx
        ):
            continue

        pair = (from_idx, to_idx)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        mov_type = str(raw_mov.get("type", "train"))
        if mov_type not in VALID_MOVEMENT_TYPES:
            mov_type = "train"

        movement = Movement(
            trip_id=trip_id,
            from_stop_id=created_stops[from_idx].id,
            to_stop_id=created_stops[to_idx].id,
            type=mov_type,
            duration_minutes=raw_mov.get("duration_minutes"),
            carrier=str(raw_mov.get("carrier", ""))[:200],
            notes=str(raw_mov.get("notes", ""))[:10000],
            price=raw_mov.get("price"),
        )
        db.add(movement)
        created_movements.append(movement)

    await db.flush()

    # 8. Recalculate end date
    await recalculate_end_date(trip_id, db)

    # 9. Commit and reload
    await db.commit()

    # Reload trip
    await db.refresh(trip)

    # Reload full itinerary
    stops, movements, all_activities, movement_by_from, activities_by_stop = await load_itinerary(trip_id, db)

    itinerary_stops = [
        ItineraryStopResponse(
            stop=stop,
            activities=activities_by_stop.get(stop.id, []),
            movement_to_next=movement_by_from.get(stop.id),
        )
        for stop in stops
    ]

    budget = compute_budget(stops, all_activities, movements)
    return ItineraryResponse(trip=trip, stops=itinerary_stops, budget=budget)
