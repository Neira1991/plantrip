import uuid as uuid_mod
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import verify_trip_ownership
from app.models import Activity, ActivityPhoto, Movement, TripStop, TripVersion, User
from app.schemas import (
    VersionCreate,
    VersionDetailResponse,
    VersionMetaResponse,
)

router = APIRouter(prefix="/trips/{trip_id}/versions", tags=["versions"])


async def _build_snapshot(trip_id: UUID, db: AsyncSession) -> dict:
    """Serialize the current trip state (stops, activities, photos, movements) to a dict."""
    stops_result = await db.execute(
        select(TripStop)
        .where(TripStop.trip_id == trip_id)
        .order_by(TripStop.sort_index)
    )
    stops = stops_result.scalars().all()
    stop_ids = [s.id for s in stops]

    # Load activities with photos
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

    # Load movements
    movements_result = await db.execute(
        select(Movement).where(Movement.trip_id == trip_id)
    )
    movements = movements_result.scalars().all()

    # Build activities grouped by stop
    activities_by_stop: dict[UUID, list] = {}
    for a in all_activities:
        activities_by_stop.setdefault(a.trip_stop_id, []).append(a)

    stops_data = []
    for stop in stops:
        stop_activities = activities_by_stop.get(stop.id, [])
        activities_data = []
        for act in stop_activities:
            photos_data = [
                {
                    "url": p.url,
                    "thumbnail_url": p.thumbnail_url,
                    "attribution": p.attribution,
                    "photographer_name": p.photographer_name,
                    "photographer_url": p.photographer_url,
                    "source": p.source,
                    "width": p.width,
                    "height": p.height,
                    "sort_index": p.sort_index,
                }
                for p in act.photos
            ]
            activities_data.append({
                "sort_index": act.sort_index,
                "title": act.title,
                "date": act.date.isoformat() if act.date else None,
                "start_time": act.start_time.isoformat() if act.start_time else None,
                "duration_minutes": act.duration_minutes,
                "lng": act.lng,
                "lat": act.lat,
                "address": act.address,
                "notes": act.notes,
                "category": act.category,
                "opening_hours": act.opening_hours,
                "price": act.price,
                "tips": act.tips,
                "website_url": act.website_url,
                "phone": act.phone,
                "rating": act.rating,
                "guide_info": act.guide_info,
                "transport_info": act.transport_info,
                "opentripmap_xid": act.opentripmap_xid,
                "photos": photos_data,
            })

        stops_data.append({
            "sort_index": stop.sort_index,
            "name": stop.name,
            "lng": stop.lng,
            "lat": stop.lat,
            "notes": stop.notes,
            "nights": stop.nights,
            "price_per_night": stop.price_per_night,
            "activities": activities_data,
        })

    # Movements reference stops by sort_index for restore mapping
    movements_data = []
    stop_id_to_sort_index = {s.id: s.sort_index for s in stops}
    for m in movements:
        from_idx = stop_id_to_sort_index.get(m.from_stop_id)
        to_idx = stop_id_to_sort_index.get(m.to_stop_id)
        if from_idx is None or to_idx is None:
            continue
        movements_data.append({
            "from_sort_index": from_idx,
            "to_sort_index": to_idx,
            "type": m.type,
            "duration_minutes": m.duration_minutes,
            "departure_time": m.departure_time.isoformat() if m.departure_time else None,
            "arrival_time": m.arrival_time.isoformat() if m.arrival_time else None,
            "carrier": m.carrier,
            "booking_ref": m.booking_ref,
            "notes": m.notes,
            "price": m.price,
        })

    return {
        "stops": stops_data,
        "movements": movements_data,
    }


@router.post("", response_model=VersionMetaResponse, status_code=201)
async def create_version(
    trip_id: UUID,
    data: VersionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    # Auto-increment version_number
    result = await db.execute(
        select(func.coalesce(func.max(TripVersion.version_number), 0))
        .where(TripVersion.trip_id == trip_id)
    )
    max_version = result.scalar()
    next_version = max_version + 1

    snapshot = await _build_snapshot(trip_id, db)

    version = TripVersion(
        trip_id=trip_id,
        version_number=next_version,
        label=data.label,
        snapshot_data=snapshot,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


@router.get("", response_model=list[VersionMetaResponse])
async def list_versions(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    result = await db.execute(
        select(TripVersion)
        .where(TripVersion.trip_id == trip_id)
        .order_by(TripVersion.version_number.desc())
    )
    return result.scalars().all()


@router.get("/{version_id}", response_model=VersionDetailResponse)
async def get_version(
    trip_id: UUID,
    version_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    version = await db.get(TripVersion, version_id)
    if not version or version.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Version not found")

    return version


@router.post("/{version_id}/restore", response_model=VersionMetaResponse, status_code=200)
async def restore_version(
    trip_id: UUID,
    version_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Destructive restore: replaces current trip stops/activities/movements with snapshot data."""
    await verify_trip_ownership(trip_id, user, db)

    version = await db.get(TripVersion, version_id)
    if not version or version.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Version not found")

    snapshot = version.snapshot_data

    # Delete existing data: movements first (they reference stops), then stops cascade deletes activities
    await db.execute(delete(Movement).where(Movement.trip_id == trip_id))
    await db.execute(delete(TripStop).where(TripStop.trip_id == trip_id))
    await db.flush()

    # Recreate stops with new UUIDs; build sort_index -> new_stop_id map for movements
    sort_index_to_stop_id: dict[int, UUID] = {}
    for stop_data in snapshot.get("stops", []):
        new_stop_id = uuid_mod.uuid4()
        sort_index_to_stop_id[stop_data["sort_index"]] = new_stop_id

        stop = TripStop(
            id=new_stop_id,
            trip_id=trip_id,
            sort_index=stop_data["sort_index"],
            name=stop_data["name"],
            lng=stop_data["lng"],
            lat=stop_data["lat"],
            notes=stop_data.get("notes", ""),
            nights=stop_data.get("nights", 1),
            price_per_night=stop_data.get("price_per_night"),
        )
        db.add(stop)

        # Recreate activities for this stop
        for act_data in stop_data.get("activities", []):
            from datetime import date, time

            new_activity_id = uuid_mod.uuid4()
            activity = Activity(
                id=new_activity_id,
                trip_stop_id=new_stop_id,
                sort_index=act_data["sort_index"],
                title=act_data["title"],
                date=date.fromisoformat(act_data["date"]) if act_data.get("date") else None,
                start_time=time.fromisoformat(act_data["start_time"]) if act_data.get("start_time") else None,
                duration_minutes=act_data.get("duration_minutes"),
                lng=act_data.get("lng"),
                lat=act_data.get("lat"),
                address=act_data.get("address", ""),
                notes=act_data.get("notes", ""),
                category=act_data.get("category", ""),
                opening_hours=act_data.get("opening_hours", ""),
                price=act_data.get("price"),
                tips=act_data.get("tips", ""),
                website_url=act_data.get("website_url", ""),
                phone=act_data.get("phone", ""),
                rating=act_data.get("rating"),
                guide_info=act_data.get("guide_info", ""),
                transport_info=act_data.get("transport_info", ""),
                opentripmap_xid=act_data.get("opentripmap_xid", ""),
            )
            db.add(activity)

            # Recreate photos for this activity
            for photo_data in act_data.get("photos", []):
                photo = ActivityPhoto(
                    id=uuid_mod.uuid4(),
                    activity_id=new_activity_id,
                    url=photo_data["url"],
                    thumbnail_url=photo_data.get("thumbnail_url", ""),
                    attribution=photo_data.get("attribution", ""),
                    photographer_name=photo_data.get("photographer_name", ""),
                    photographer_url=photo_data.get("photographer_url", ""),
                    source=photo_data.get("source", "unsplash"),
                    width=photo_data.get("width"),
                    height=photo_data.get("height"),
                    sort_index=photo_data.get("sort_index", 0),
                )
                db.add(photo)

    # Recreate movements using sort_index -> new_stop_id map
    for mov_data in snapshot.get("movements", []):
        from_stop_id = sort_index_to_stop_id.get(mov_data["from_sort_index"])
        to_stop_id = sort_index_to_stop_id.get(mov_data["to_sort_index"])
        if not from_stop_id or not to_stop_id:
            continue

        from datetime import datetime as dt

        movement = Movement(
            id=uuid_mod.uuid4(),
            trip_id=trip_id,
            from_stop_id=from_stop_id,
            to_stop_id=to_stop_id,
            type=mov_data["type"],
            duration_minutes=mov_data.get("duration_minutes"),
            departure_time=dt.fromisoformat(mov_data["departure_time"]) if mov_data.get("departure_time") else None,
            arrival_time=dt.fromisoformat(mov_data["arrival_time"]) if mov_data.get("arrival_time") else None,
            carrier=mov_data.get("carrier", ""),
            booking_ref=mov_data.get("booking_ref", ""),
            notes=mov_data.get("notes", ""),
            price=mov_data.get("price"),
        )
        db.add(movement)

    await db.commit()
    await db.refresh(version)
    return version


@router.delete("/{version_id}", status_code=204)
async def delete_version(
    trip_id: UUID,
    version_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    version = await db.get(TripVersion, version_id)
    if not version or version.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Version not found")

    await db.delete(version)
    await db.commit()
