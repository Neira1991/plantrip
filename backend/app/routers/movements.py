from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Movement, Trip
from app.schemas import MovementCreate, MovementResponse, MovementUpdate

router = APIRouter(tags=["movements"])


@router.get("/trips/{trip_id}/movements", response_model=list[MovementResponse])
async def list_movements(trip_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Movement).where(Movement.trip_id == trip_id)
    )
    return result.scalars().all()


@router.post("/trips/{trip_id}/movements", response_model=MovementResponse, status_code=201)
async def upsert_movement(trip_id: UUID, data: MovementCreate, db: AsyncSession = Depends(get_db)):
    # Verify trip exists
    trip = await db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Check for existing movement with same from/to stops
    result = await db.execute(
        select(Movement).where(
            Movement.from_stop_id == data.from_stop_id,
            Movement.to_stop_id == data.to_stop_id,
        )
    )
    existing = result.scalars().first()

    if existing:
        # Update existing movement
        existing.type = data.type
        existing.duration_minutes = data.duration_minutes
        existing.departure_time = data.departure_time
        existing.arrival_time = data.arrival_time
        existing.carrier = data.carrier
        existing.booking_ref = data.booking_ref
        existing.notes = data.notes
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing

    # Create new movement
    movement = Movement(
        trip_id=trip_id,
        from_stop_id=data.from_stop_id,
        to_stop_id=data.to_stop_id,
        type=data.type,
        duration_minutes=data.duration_minutes,
        departure_time=data.departure_time,
        arrival_time=data.arrival_time,
        carrier=data.carrier,
        booking_ref=data.booking_ref,
        notes=data.notes,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement


@router.put("/movements/{movement_id}", response_model=MovementResponse)
async def update_movement(movement_id: UUID, data: MovementUpdate, db: AsyncSession = Depends(get_db)):
    movement = await db.get(Movement, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(movement, key, value)
    movement.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(movement)
    return movement


@router.delete("/movements/{movement_id}", status_code=204)
async def delete_movement(movement_id: UUID, db: AsyncSession = Depends(get_db)):
    movement = await db.get(Movement, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")

    await db.delete(movement)
    await db.commit()
