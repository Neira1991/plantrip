import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Activity, Movement, ShareToken, Trip, TripStop, User
from app.schemas import (
    ItineraryStopResponse,
    ShareTokenResponse,
    SharedTripResponse,
)

router = APIRouter(tags=["share"])
_testing = os.environ.get("TESTING", "").lower() == "true"
limiter = Limiter(key_func=get_remote_address, enabled=not _testing)

TOKEN_EXPIRY_HOURS = 24


@router.post("/trips/{trip_id}/share", response_model=ShareTokenResponse, status_code=201)
@limiter.limit("5/minute")
async def create_share_token(
    request: Request,
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

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
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

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
    trip = await db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

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

    # Build itinerary (same logic as trips.get_itinerary but without auth)
    stops_result = await db.execute(
        select(TripStop)
        .where(TripStop.trip_id == trip.id)
        .order_by(TripStop.sort_index)
    )
    stops = stops_result.scalars().all()

    movements_result = await db.execute(
        select(Movement).where(Movement.trip_id == trip.id)
    )
    movements = movements_result.scalars().all()
    movement_by_from = {m.from_stop_id: m for m in movements}

    stop_ids = [s.id for s in stops]
    if stop_ids:
        from sqlalchemy.orm import selectinload
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

    itinerary_stops = []
    for stop in stops:
        itinerary_stops.append(
            ItineraryStopResponse(
                stop=stop,
                activities=activities_by_stop.get(stop.id, []),
                movement_to_next=movement_by_from.get(stop.id),
            )
        )

    return SharedTripResponse(
        trip_name=trip.name,
        country_code=trip.country_code,
        start_date=trip.start_date,
        end_date=trip.end_date,
        status=trip.status,
        stops=itinerary_stops,
        expires_at=share_token.expires_at,
    )
