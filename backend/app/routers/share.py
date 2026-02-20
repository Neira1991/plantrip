import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import limiter, load_itinerary, verify_trip_ownership
from app.models import ShareToken, Trip, User
from app.routers.trips import compute_budget
from app.schemas import (
    ItineraryStopResponse,
    ShareTokenResponse,
    SharedTripResponse,
)

router = APIRouter(tags=["share"])

TOKEN_EXPIRY_HOURS = 24


@router.post("/trips/{trip_id}/share", response_model=ShareTokenResponse, status_code=201)
@limiter.limit("5/minute")
async def create_share_token(
    request: Request,
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    # Delete old tokens for this trip
    await db.execute(
        delete(ShareToken).where(ShareToken.trip_id == trip_id)
    )

    # Clean up expired tokens from other trips (opportunistic cleanup)
    await db.execute(
        delete(ShareToken).where(ShareToken.expires_at < datetime.now(timezone.utc))
    )

    token = ShareToken(
        trip_id=trip_id,
        user_id=user.id,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)
    return token


@router.get("/trips/{trip_id}/share", response_model=ShareTokenResponse)
async def get_share_token(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    result = await db.execute(
        select(ShareToken).where(
            ShareToken.trip_id == trip_id,
            ShareToken.expires_at > datetime.now(timezone.utc),
        )
    )
    token = result.scalars().first()
    if not token:
        raise HTTPException(status_code=404, detail="No active share link")
    return token


@router.delete("/trips/{trip_id}/share", status_code=204)
async def revoke_share_token(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    await db.execute(
        delete(ShareToken).where(ShareToken.trip_id == trip_id)
    )
    await db.commit()


@router.get("/shared/{token}", response_model=SharedTripResponse)
@limiter.limit("30/minute")
async def get_shared_trip(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share_token = result.scalars().first()

    if not share_token or share_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    trip = await db.get(Trip, share_token.trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    stops, movements, all_activities, movement_by_from, activities_by_stop = await load_itinerary(trip.id, db)

    itinerary_stops = [
        ItineraryStopResponse(
            stop=stop,
            activities=activities_by_stop.get(stop.id, []),
            movement_to_next=movement_by_from.get(stop.id),
        )
        for stop in stops
    ]

    budget = compute_budget(stops, all_activities, movements)
    return SharedTripResponse(
        trip_name=trip.name,
        country_code=trip.country_code,
        start_date=trip.start_date,
        end_date=trip.end_date,
        status=trip.status,
        currency=trip.currency,
        stops=itinerary_stops,
        budget=budget,
        expires_at=share_token.expires_at,
    )
