from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import limiter, verify_trip_ownership
from app.models import Activity, ActivityFeedback, ShareToken, TripStop, TripVersion, User
from app.schemas import (
    ActivityFeedbackSummary,
    FeedbackCreate,
    FeedbackResponse,
    TripFeedbackResponse,
    VersionFeedbackGroup,
)

router = APIRouter(tags=["feedback"])


@router.post("/shared/{token}/feedback", response_model=FeedbackResponse, status_code=201)
@limiter.limit("10/minute")
async def create_feedback(
    request: Request,
    token: str,
    data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    # Validate share token
    result = await db.execute(
        select(ShareToken).where(ShareToken.token == token)
    )
    share_token = result.scalars().first()

    if not share_token or share_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    # Validate activity exists and belongs to the shared trip
    activity = await db.get(Activity, data.activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Verify activity belongs to a stop on the shared trip
    stop = await db.get(TripStop, activity.trip_stop_id)
    if not stop or stop.trip_id != share_token.trip_id:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Look up the latest version for this trip
    version_result = await db.execute(
        select(TripVersion)
        .where(TripVersion.trip_id == share_token.trip_id)
        .order_by(TripVersion.version_number.desc())
        .limit(1)
    )
    latest_version = version_result.scalars().first()

    feedback = ActivityFeedback(
        share_token_id=share_token.id,
        activity_id=data.activity_id,
        version_id=latest_version.id if latest_version else None,
        activity_title=activity.title,
        viewer_session_id=data.viewer_session_id,
        viewer_name=data.viewer_name,
        sentiment=data.sentiment,
        message=data.message,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return FeedbackResponse(
        id=feedback.id,
        activity_id=feedback.activity_id,
        activity_title=feedback.activity_title,
        viewer_name=feedback.viewer_name,
        sentiment=feedback.sentiment,
        message=feedback.message,
        version_number=latest_version.version_number if latest_version else None,
        version_label=latest_version.label if latest_version else None,
        created_at=feedback.created_at,
    )


@router.get("/trips/{trip_id}/feedback", response_model=TripFeedbackResponse)
async def get_trip_feedback(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_trip_ownership(trip_id, user, db)

    # Get all feedback for this trip via share_token join (catches orphaned feedback)
    feedback_result = await db.execute(
        select(ActivityFeedback)
        .join(ShareToken, ActivityFeedback.share_token_id == ShareToken.id)
        .where(ShareToken.trip_id == trip_id)
        .order_by(ActivityFeedback.created_at.desc())
    )
    all_feedback = feedback_result.scalars().all()

    if not all_feedback:
        return TripFeedbackResponse(trip_id=trip_id, versions=[])

    # Collect all referenced version_ids and load version metadata
    version_ids = {fb.version_id for fb in all_feedback if fb.version_id is not None}
    versions_map: dict[UUID, TripVersion] = {}
    if version_ids:
        versions_result = await db.execute(
            select(TripVersion).where(TripVersion.id.in_(version_ids))
        )
        for v in versions_result.scalars().all():
            versions_map[v.id] = v

    # Group feedback: version_id → activity_title → list[feedback]
    grouped: dict[UUID | None, dict[str, list[ActivityFeedback]]] = {}
    for fb in all_feedback:
        vid = fb.version_id
        title = fb.activity_title or "Unknown activity"
        grouped.setdefault(vid, {}).setdefault(title, []).append(fb)

    # Build version groups sorted by version_number desc, unversioned last
    def version_sort_key(vid: UUID | None) -> tuple[int, int]:
        if vid is None:
            return (1, 0)
        v = versions_map.get(vid)
        return (0, -(v.version_number if v else 0))

    version_groups = []
    for vid in sorted(grouped.keys(), key=version_sort_key):
        v = versions_map.get(vid) if vid else None
        activity_summaries = []
        for title, fb_list in grouped[vid].items():
            likes = sum(1 for fb in fb_list if fb.sentiment == "like")
            dislikes = sum(1 for fb in fb_list if fb.sentiment == "dislike")
            activity_summaries.append(
                ActivityFeedbackSummary(
                    activity_id=fb_list[0].activity_id,
                    activity_title=title,
                    likes=likes,
                    dislikes=dislikes,
                    feedback=[
                        FeedbackResponse(
                            id=fb.id,
                            activity_id=fb.activity_id,
                            activity_title=fb.activity_title,
                            viewer_name=fb.viewer_name,
                            sentiment=fb.sentiment,
                            message=fb.message,
                            version_number=v.version_number if v else None,
                            version_label=v.label if v else None,
                            created_at=fb.created_at,
                        )
                        for fb in fb_list
                    ],
                )
            )
        version_groups.append(
            VersionFeedbackGroup(
                version_id=vid,
                version_number=v.version_number if v else None,
                version_label=v.label if v else None,
                activities=activity_summaries,
            )
        )

    return TripFeedbackResponse(trip_id=trip_id, versions=version_groups)


