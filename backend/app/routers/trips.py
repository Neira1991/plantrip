from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Activity, Movement, Trip, TripStop, User
from app.schemas import (
    ItineraryResponse,
    ItineraryStopResponse,
    TripCreate,
    TripResponse,
    TripUpdate,
)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=list[TripResponse])
async def list_trips(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trip).where(Trip.user_id == user.id).order_by(Trip.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=TripResponse, status_code=201)
async def create_trip(
    data: TripCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate country for this user
    result = await db.execute(
        select(Trip).where(Trip.country_code == data.country_code, Trip.user_id == user.id)
    )
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="A trip for this country already exists")

    trip = Trip(
        user_id=user.id,
        name=data.name,
        country_code=data.country_code,
        start_date=data.start_date,
        end_date=data.end_date,
        status=data.status,
        notes=data.notes,
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: UUID,
    data: TripUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trip, key, value)
    trip.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    await db.delete(trip)
    await db.commit()


@router.get("/{trip_id}/itinerary", response_model=ItineraryResponse)
async def get_itinerary(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Load stops sorted by sort_index
    stops_result = await db.execute(
        select(TripStop)
        .where(TripStop.trip_id == trip_id)
        .order_by(TripStop.sort_index)
    )
    stops = stops_result.scalars().all()

    # Load all movements for this trip
    movements_result = await db.execute(
        select(Movement).where(Movement.trip_id == trip_id)
    )
    movements = movements_result.scalars().all()
    movement_by_from = {m.from_stop_id: m for m in movements}

    # Load all activities for stops in this trip
    stop_ids = [s.id for s in stops]
    activities_result = await db.execute(
        select(Activity)
        .where(Activity.trip_stop_id.in_(stop_ids))
        .order_by(Activity.sort_index)
    ) if stop_ids else None
    all_activities = activities_result.scalars().all() if activities_result else []

    activities_by_stop: dict[UUID, list] = {}
    for a in all_activities:
        activities_by_stop.setdefault(a.trip_stop_id, []).append(a)

    itinerary_stops = []
    for stop in stops:
        itinerary_stops.append(
            ItineraryStopResponse(
                stop=stop,
                activities=activities_by_stop.get(stop.id, []),
                movement_to_next=movement_by_from.get(stop.id),
            )
        )

    return ItineraryResponse(trip=trip, stops=itinerary_stops)
