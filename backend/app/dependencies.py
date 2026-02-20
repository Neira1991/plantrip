import os
from uuid import UUID

from fastapi import HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import Activity, Movement, Trip, TripStop, User

TESTING = os.environ.get("TESTING", "").lower() == "true"

limiter = Limiter(key_func=get_remote_address, enabled=not TESTING)


async def verify_trip_ownership(trip_id: UUID, user: User, db: AsyncSession) -> Trip:
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


async def verify_stop_ownership(stop_id: UUID, user: User, db: AsyncSession) -> TripStop:
    stop = await db.get(TripStop, stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    trip = await db.get(Trip, stop.trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Stop not found")
    return stop


async def load_itinerary(trip_id: UUID, db: AsyncSession):
    """Load stops, movements, and activities (with photos) for a trip.

    Returns (stops, movements, all_activities, movement_by_from, activities_by_stop).
    """
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

    # Load all activities for stops in this trip (with photos)
    stop_ids = [s.id for s in stops]
    if stop_ids:
        activities_result = await db.execute(
            select(Activity)
            .options(selectinload(Activity.photos))
            .where(Activity.trip_stop_id.in_(stop_ids))
            .order_by(Activity.sort_index)
        )
        all_activities = activities_result.scalars().all()
    else:
        all_activities = []

    activities_by_stop: dict[UUID, list] = {}
    for a in all_activities:
        activities_by_stop.setdefault(a.trip_stop_id, []).append(a)

    return stops, movements, all_activities, movement_by_from, activities_by_stop
