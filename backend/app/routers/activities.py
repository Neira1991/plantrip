from datetime import datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Activity, ActivityPhoto, Trip, TripStop, User
from app.schemas import (
    ActivityCreate,
    ActivityDetailResponse,
    ActivityPhotoResponse,
    ActivityResponse,
    ActivityUpdate,
)

router = APIRouter(tags=["activities"])


async def _verify_stop_ownership(stop_id: UUID, user: User, db: AsyncSession) -> TripStop:
    stop = await db.get(TripStop, stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    trip = await db.get(Trip, stop.trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Stop not found")
    return stop


async def _verify_activity_ownership(activity_id: UUID, user: User, db: AsyncSession) -> Activity:
    activity = await db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    stop = await db.get(TripStop, activity.trip_stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Activity not found")
    trip = await db.get(Trip, stop.trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.get("/stops/{stop_id}/activities", response_model=list[ActivityResponse])
async def list_activities(
    stop_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_stop_ownership(stop_id, user, db)
    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.photos))
        .where(Activity.trip_stop_id == stop_id)
        .order_by(Activity.sort_index)
    )
    return result.scalars().all()


@router.post("/stops/{stop_id}/activities", response_model=ActivityResponse, status_code=201)
async def create_activity(
    stop_id: UUID,
    data: ActivityCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_stop_ownership(stop_id, user, db)

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
        lng=data.lng,
        lat=data.lat,
        address=data.address,
        notes=data.notes,
        category=data.category,
        opening_hours=data.opening_hours,
        price_info=data.price_info,
        tips=data.tips,
        website_url=data.website_url,
        phone=data.phone,
        rating=data.rating,
        guide_info=data.guide_info,
        transport_info=data.transport_info,
        opentripmap_xid=data.opentripmap_xid,
    )
    db.add(activity)
    await db.commit()
    # Re-load with photos to avoid lazy-loading in async context
    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.photos))
        .where(Activity.id == activity.id)
    )
    return result.scalars().first()


@router.put("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID,
    data: ActivityUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    activity = await _verify_activity_ownership(activity_id, user, db)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(activity, key, value)
    activity.updated_at = datetime.utcnow()

    await db.commit()
    # Re-load with photos
    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.photos))
        .where(Activity.id == activity_id)
    )
    return result.scalars().first()


@router.delete("/activities/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    activity = await _verify_activity_ownership(activity_id, user, db)
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


@router.get("/activities/{activity_id}", response_model=ActivityDetailResponse)
async def get_activity(
    activity_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.photos))
        .where(Activity.id == activity_id)
    )
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    stop = await db.get(TripStop, activity.trip_stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Activity not found")
    trip = await db.get(Trip, stop.trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Activity not found")

    return activity


@router.post("/activities/{activity_id}/photos", response_model=list[ActivityPhotoResponse])
async def refresh_photos(
    activity_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    activity = await _verify_activity_ownership(activity_id, user, db)

    if not settings.UNSPLASH_ACCESS_KEY:
        raise HTTPException(status_code=503, detail="Photo service not configured")

    # Build search query: "title stopName"
    stop = await db.get(TripStop, activity.trip_stop_id)
    query = activity.title
    if stop:
        query = f"{activity.title} {stop.name}"

    # Fetch from Unsplash
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "per_page": 6, "orientation": "landscape"},
            headers={"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch photos")
        data = resp.json()

    # Delete old photos for this activity
    await db.execute(
        delete(ActivityPhoto).where(ActivityPhoto.activity_id == activity_id)
    )

    # Insert new photos
    photos = []
    for i, result in enumerate(data.get("results", [])):
        photo = ActivityPhoto(
            activity_id=activity_id,
            url=result["urls"].get("regular", ""),
            thumbnail_url=result["urls"].get("small", ""),
            attribution=f"Photo by {result['user']['name']} on Unsplash",
            photographer_name=result["user"]["name"],
            photographer_url=result["user"]["links"].get("html", ""),
            source="unsplash",
            width=result.get("width"),
            height=result.get("height"),
            sort_index=i,
        )
        db.add(photo)
        photos.append(photo)

    await db.commit()
    for p in photos:
        await db.refresh(p)

    return photos
