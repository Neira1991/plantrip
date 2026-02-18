from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Activity, TripStop
from app.schemas import ActivityCreate, ActivityResponse, ActivityUpdate

router = APIRouter(tags=["activities"])


@router.get("/stops/{stop_id}/activities", response_model=list[ActivityResponse])
async def list_activities(stop_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Activity)
        .where(Activity.trip_stop_id == stop_id)
        .order_by(Activity.sort_index)
    )
    return result.scalars().all()


@router.post("/stops/{stop_id}/activities", response_model=ActivityResponse, status_code=201)
async def create_activity(stop_id: UUID, data: ActivityCreate, db: AsyncSession = Depends(get_db)):
    # Verify stop exists
    stop = await db.get(TripStop, stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    # Auto-assign sort_index
    result = await db.execute(
        select(func.coalesce(func.max(Activity.sort_index), -1))
        .where(Activity.trip_stop_id == stop_id)
    )
    max_index = result.scalar()
    next_index = max_index + 1

    activity = Activity(
        trip_stop_id=stop_id,
        sort_index=next_index,
        title=data.title,
        date=data.date,
        start_time=data.start_time,
        duration_minutes=data.duration_minutes,
        notes=data.notes,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@router.put("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(activity_id: UUID, data: ActivityUpdate, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(activity, key, value)
    activity.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(activity)
    return activity


@router.delete("/activities/{activity_id}", status_code=204)
async def delete_activity(activity_id: UUID, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    stop_id = activity.trip_stop_id

    await db.delete(activity)
    await db.flush()

    # Defer unique constraint for renumbering
    await db.execute(text("SET CONSTRAINTS uq_activity_sort DEFERRED"))

    # Renumber remaining activities in the stop
    result = await db.execute(
        select(Activity)
        .where(Activity.trip_stop_id == stop_id)
        .order_by(Activity.sort_index)
    )
    remaining = result.scalars().all()
    now = datetime.utcnow()
    for i, a in enumerate(remaining):
        a.sort_index = i
        a.updated_at = now

    await db.commit()
