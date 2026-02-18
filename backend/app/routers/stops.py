from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Activity, Movement, Trip, TripStop, User
from app.schemas import TripStopCreate, TripStopReorder, TripStopResponse, TripStopUpdate

router = APIRouter(tags=["stops"])


async def recalculate_end_date(trip_id: UUID, db: AsyncSession) -> None:
    trip = await db.get(Trip, trip_id)
    if not trip:
        return
    total_nights = (await db.execute(
        select(func.coalesce(func.sum(TripStop.nights), 0))
        .where(TripStop.trip_id == trip_id)
    )).scalar()
    trip.end_date = trip.start_date + timedelta(days=max(total_nights - 1, 0))
    trip.updated_at = datetime.utcnow()


async def _verify_trip_ownership(trip_id: UUID, user: User, db: AsyncSession) -> Trip:
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


async def _verify_stop_ownership(stop_id: UUID, user: User, db: AsyncSession) -> TripStop:
    stop = await db.get(TripStop, stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    trip = await db.get(Trip, stop.trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Stop not found")
    return stop


@router.get("/trips/{trip_id}/stops", response_model=list[TripStopResponse])
async def list_stops(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_trip_ownership(trip_id, user, db)
    result = await db.execute(
        select(TripStop)
        .where(TripStop.trip_id == trip_id)
        .order_by(TripStop.sort_index)
    )
    return result.scalars().all()


@router.post("/trips/{trip_id}/stops", response_model=TripStopResponse, status_code=201)
async def create_stop(
    trip_id: UUID,
    data: TripStopCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_trip_ownership(trip_id, user, db)

    # Auto-assign sort_index
    result = await db.execute(
        select(func.coalesce(func.max(TripStop.sort_index), -1))
        .where(TripStop.trip_id == trip_id)
    )
    max_index = result.scalar()
    next_index = max_index + 1

    stop = TripStop(
        trip_id=trip_id,
        sort_index=next_index,
        name=data.name,
        lng=data.lng,
        lat=data.lat,
        notes=data.notes,
        nights=data.nights,
        price_per_night=data.price_per_night,
    )
    db.add(stop)
    await db.flush()
    await recalculate_end_date(trip_id, db)
    await db.commit()
    await db.refresh(stop)
    return stop


@router.put("/stops/{stop_id}", response_model=TripStopResponse)
async def update_stop(
    stop_id: UUID,
    data: TripStopUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stop = await _verify_stop_ownership(stop_id, user, db)

    update_data = data.model_dump(exclude_unset=True)
    nights_changed = "nights" in update_data
    for key, value in update_data.items():
        setattr(stop, key, value)
    stop.updated_at = datetime.utcnow()

    if nights_changed:
        await db.flush()
        await recalculate_end_date(stop.trip_id, db)

    await db.commit()
    await db.refresh(stop)
    return stop


@router.delete("/stops/{stop_id}", status_code=204)
async def delete_stop(
    stop_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stop = await _verify_stop_ownership(stop_id, user, db)
    trip_id = stop.trip_id

    # Delete activities for this stop
    await db.execute(delete(Activity).where(Activity.trip_stop_id == stop_id))

    # Delete movements referencing this stop
    await db.execute(
        delete(Movement).where(
            (Movement.from_stop_id == stop_id) | (Movement.to_stop_id == stop_id)
        )
    )

    # Delete the stop
    await db.delete(stop)
    await db.flush()

    # Defer unique constraint for renumbering
    await db.execute(text("SET CONSTRAINTS uq_trip_stop_sort DEFERRED"))

    # Renumber remaining stops
    result = await db.execute(
        select(TripStop)
        .where(TripStop.trip_id == trip_id)
        .order_by(TripStop.sort_index)
    )
    remaining = result.scalars().all()
    for i, s in enumerate(remaining):
        s.sort_index = i
        s.updated_at = datetime.utcnow()

    await recalculate_end_date(trip_id, db)
    await db.commit()


@router.put("/trips/{trip_id}/stops/reorder", response_model=list[TripStopResponse])
async def reorder_stops(
    trip_id: UUID,
    data: TripStopReorder,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_trip_ownership(trip_id, user, db)

    # Load all stops for this trip sorted by sort_index
    result = await db.execute(
        select(TripStop)
        .where(TripStop.trip_id == trip_id)
        .order_by(TripStop.sort_index)
    )
    stops = list(result.scalars().all())

    if data.from_index < 0 or data.from_index >= len(stops) or data.to_index < 0 or data.to_index >= len(stops):
        raise HTTPException(status_code=400, detail="Invalid index")

    # Splice reorder
    moved = stops.pop(data.from_index)
    stops.insert(data.to_index, moved)

    # Defer unique constraint for renumbering
    await db.execute(text("SET CONSTRAINTS uq_trip_stop_sort DEFERRED"))

    # Renumber 0, 1, 2...
    now = datetime.utcnow()
    for i, stop in enumerate(stops):
        stop.sort_index = i
        stop.updated_at = now

    # Delete ALL movements for this trip
    await db.execute(delete(Movement).where(Movement.trip_id == trip_id))

    await db.commit()

    # Refresh to return updated data
    for stop in stops:
        await db.refresh(stop)

    return stops
