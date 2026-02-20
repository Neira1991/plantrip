from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import load_itinerary, verify_trip_ownership
from app.models import Trip, User
from app.permissions import get_org_membership
from app.routers.stops import recalculate_end_date
from app.schemas import (
    BudgetSummary,
    ItineraryResponse,
    ItineraryStopResponse,
    TripCreate,
    TripResponse,
    TripUpdate,
)

router = APIRouter(prefix="/trips", tags=["trips"])


def compute_budget(stops, activities, movements):
    activities_total = sum(a.price or 0.0 for a in activities)
    accommodation_total = sum((s.price_per_night or 0.0) * s.nights for s in stops)
    transport_total = sum(m.price or 0.0 for m in movements)
    return BudgetSummary(
        activities_total=activities_total,
        accommodation_total=accommodation_total,
        transport_total=transport_total,
        grand_total=activities_total + accommodation_total + transport_total,
    )


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

    # Get organization membership if exists
    membership = await get_org_membership(user, db)
    organization_id = membership.organization_id if membership else None

    trip = Trip(
        user_id=user.id,
        organization_id=organization_id,
        name=data.name,
        country_code=data.country_code,
        start_date=data.start_date,
        end_date=data.start_date,
        status=data.status,
        notes=data.notes,
        currency=data.currency,
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
    trip = await verify_trip_ownership(trip_id, user, db)
    return trip


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: UUID,
    data: TripUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await verify_trip_ownership(trip_id, user, db)

    update_data = data.model_dump(exclude_unset=True)
    start_date_changed = "start_date" in update_data
    for key, value in update_data.items():
        setattr(trip, key, value)

    if start_date_changed:
        await db.flush()
        await recalculate_end_date(trip_id, db)

    await db.commit()
    await db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await verify_trip_ownership(trip_id, user, db)
    await db.delete(trip)
    await db.commit()


@router.get("/{trip_id}/itinerary", response_model=ItineraryResponse)
async def get_itinerary(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await verify_trip_ownership(trip_id, user, db)

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
