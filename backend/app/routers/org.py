import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.email import send_invite_email
from app.models import Organization, OrganizationInvite, OrganizationMember, Trip, User
from app.permissions import get_org_membership, require_org_admin, require_org_member
from app.schemas import (
    InviteCreate,
    InviteResponse,
    OrgStatsResponse,
    OrgTripResponse,
    OrganizationCreate,
    OrganizationMemberResponse,
    OrganizationResponse,
    OrganizationUpdate,
    TripsPerDesigner,
    UpdateMemberRoleRequest,
)

router = APIRouter(prefix="/org", tags=["organization"])
_testing = os.environ.get("TESTING", "").lower() == "true"
limiter = Limiter(key_func=get_remote_address, enabled=not _testing)


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from organization name.

    Validates: alphanumeric + hyphens only, 3-50 chars.
    """
    # Lowercase and replace non-alphanumeric with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower())
    # Strip leading/trailing hyphens
    slug = slug.strip("-")
    # Limit to 50 chars
    slug = slug[:50].rstrip("-")

    # Validate final slug: alphanumeric + hyphens only, 3-50 chars
    if not slug or len(slug) < 3:
        # Fallback: use random suffix to ensure uniqueness
        slug = f"org-{secrets.token_hex(4)}"

    # Final validation: only alphanumeric and hyphens
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", slug):
        # If validation fails, generate a safe random slug
        slug = f"org-{secrets.token_hex(4)}"

    return slug


async def ensure_unique_slug(base_slug: str, db: AsyncSession, exclude_id: UUID | None = None) -> str:
    """Ensure slug is unique, appending random suffix if needed."""
    slug = base_slug
    while True:
        query = select(Organization).where(Organization.slug == slug)
        if exclude_id:
            query = query.where(Organization.id != exclude_id)
        result = await db.execute(query)
        if not result.scalars().first():
            return slug
        # Append random suffix
        suffix = secrets.token_hex(3)
        slug = f"{base_slug[:44]}-{suffix}"


# --- Organization CRUD ---

@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    data: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization. User must not already belong to an org."""
    # Check if user already belongs to an org
    existing = await db.execute(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot create organization at this time")

    # Generate unique slug
    base_slug = generate_slug(data.name)
    slug = await ensure_unique_slug(base_slug, db)

    # Create org
    org = Organization(name=data.name, slug=slug)
    db.add(org)
    await db.flush()

    # Add creator as admin
    member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role="admin",
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)

    # Count members (should be 1)
    count_result = await db.execute(
        select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == org.id)
    )
    member_count = count_result.scalar() or 0

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_at=org.created_at,
        updated_at=org.updated_at,
        member_count=member_count,
    )


@router.get("", response_model=OrganizationResponse)
async def get_organization(
    membership: OrganizationMember = Depends(require_org_member),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's organization with member count."""
    org = await db.get(Organization, membership.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Count members
    count_result = await db.execute(
        select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == org.id)
    )
    member_count = count_result.scalar() or 0

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_at=org.created_at,
        updated_at=org.updated_at,
        member_count=member_count,
    )


@router.put("", response_model=OrganizationResponse)
async def update_organization(
    data: OrganizationUpdate,
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update organization name (admin only). Auto-regenerates slug."""
    org = await db.get(Organization, membership.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if data.name is not None:
        org.name = data.name
        # Regenerate slug
        base_slug = generate_slug(data.name)
        org.slug = await ensure_unique_slug(base_slug, db, exclude_id=org.id)

    org.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(org)

    # Count members
    count_result = await db.execute(
        select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == org.id)
    )
    member_count = count_result.scalar() or 0

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_at=org.created_at,
        updated_at=org.updated_at,
        member_count=member_count,
    )


@router.delete("", status_code=204)
async def delete_organization(
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete organization (admin only)."""
    org = await db.get(Organization, membership.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    await db.delete(org)
    await db.commit()


# --- Team Management ---

@router.get("/members", response_model=list[OrganizationMemberResponse])
async def list_members(
    membership: OrganizationMember = Depends(require_org_member),
    db: AsyncSession = Depends(get_db),
):
    """List all organization members with trip counts."""
    # Get all members with user info
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == membership.organization_id)
        .order_by(OrganizationMember.created_at)
    )
    members_with_users = result.all()

    # Get trip counts for each member
    trip_counts = {}
    for member, _ in members_with_users:
        count_result = await db.execute(
            select(func.count())
            .select_from(Trip)
            .where(
                Trip.user_id == member.user_id,
                Trip.organization_id == membership.organization_id,
            )
        )
        trip_counts[member.user_id] = count_result.scalar() or 0

    # Build response
    return [
        OrganizationMemberResponse(
            id=member.id,
            user_id=member.user_id,
            email=user.email,
            role=member.role,
            trip_count=trip_counts.get(member.user_id, 0),
            created_at=member.created_at,
        )
        for member, user in members_with_users
    ]


@router.put("/members/{user_id}/role", response_model=OrganizationMemberResponse)
async def update_member_role(
    user_id: UUID,
    data: UpdateMemberRoleRequest,
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change a member's role (admin only). Cannot demote last admin."""
    # Get target member
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.organization_id == membership.organization_id,
            OrganizationMember.user_id == user_id,
        )
    )
    member_user = result.first()
    if not member_user:
        raise HTTPException(status_code=404, detail="Member not found")

    target_member, user = member_user

    # If demoting from admin, check if they're the last admin
    # Use SELECT FOR UPDATE to prevent race conditions
    if target_member.role == "admin" and data.role != "admin":
        admin_count_result = await db.execute(
            select(func.count())
            .select_from(OrganizationMember)
            .where(
                OrganizationMember.organization_id == membership.organization_id,
                OrganizationMember.role == "admin",
            )
            .with_for_update()
        )
        admin_count = admin_count_result.scalar() or 0
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    target_member.role = data.role
    await db.commit()
    await db.refresh(target_member)

    # Get trip count
    trip_count_result = await db.execute(
        select(func.count())
        .select_from(Trip)
        .where(
            Trip.user_id == user_id,
            Trip.organization_id == membership.organization_id,
        )
    )
    trip_count = trip_count_result.scalar() or 0

    return OrganizationMemberResponse(
        id=target_member.id,
        user_id=target_member.user_id,
        email=user.email,
        role=target_member.role,
        trip_count=trip_count,
        created_at=target_member.created_at,
    )


@router.delete("/members/{user_id}", status_code=204)
async def remove_member(
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a member from the organization.
    Admin can remove others. Any member can remove themselves (leave org).
    Cannot remove last admin.
    """
    membership = await get_org_membership(user, db)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of an organization")

    # Get target member
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == membership.organization_id,
            OrganizationMember.user_id == user_id,
        )
    )
    target_member = result.scalars().first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Permission check: admin or self
    is_self = user_id == user.id
    is_admin = membership.role == "admin"
    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="You can only remove yourself or be an admin")

    # Check if removing last admin
    # Use SELECT FOR UPDATE to prevent race conditions
    if target_member.role == "admin":
        admin_count_result = await db.execute(
            select(func.count())
            .select_from(OrganizationMember)
            .where(
                OrganizationMember.organization_id == membership.organization_id,
                OrganizationMember.role == "admin",
            )
            .with_for_update()
        )
        admin_count = admin_count_result.scalar() or 0
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    await db.delete(target_member)
    await db.commit()


# --- Invites ---

@router.post("/invites", response_model=InviteResponse, status_code=201)
@limiter.limit("10/hour")
async def create_invite(
    request: Request,
    data: InviteCreate,
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create an invite (admin only). Rate limited to 10/hour."""
    # Check if email is already a member (case-insensitive)
    # Note: data.email is already normalized to lowercase by InviteCreate validator
    existing_member = await db.execute(
        select(OrganizationMember)
        .join(User, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.organization_id == membership.organization_id,
            func.lower(User.email) == data.email,
        )
    )
    if existing_member.scalars().first():
        raise HTTPException(status_code=409, detail="User is already a member")

    # Create invite
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invite = OrganizationInvite(
        organization_id=membership.organization_id,
        email=data.email,
        role=data.role,
        token=token,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    # Send invite email
    org = await db.get(Organization, membership.organization_id)
    org_name = org.name if org else "an organization"
    await send_invite_email(data.email, org_name, data.role, token)

    return invite


@router.get("/invites", response_model=list[InviteResponse])
async def list_invites(
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """List pending (non-expired, non-accepted) invites (admin only)."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OrganizationInvite)
        .where(
            OrganizationInvite.organization_id == membership.organization_id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.expires_at > now,
        )
        .order_by(OrganizationInvite.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/invites/{invite_id}", status_code=204)
async def revoke_invite(
    invite_id: UUID,
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an invite (admin only)."""
    invite = await db.get(OrganizationInvite, invite_id)
    if not invite or invite.organization_id != membership.organization_id:
        raise HTTPException(status_code=404, detail="Invite not found")

    await db.delete(invite)
    await db.commit()


@router.post("/invites/{token}/accept", response_model=OrganizationResponse)
async def accept_invite(
    token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept an invite (any logged-in user). User must not already belong to an org."""
    # Check if user already belongs to an org
    existing = await db.execute(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="You are already a member of an organization")

    # Find invite
    result = await db.execute(
        select(OrganizationInvite).where(OrganizationInvite.token == token)
    )
    invite = result.scalars().first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Check expiry
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")

    # Check if already accepted
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invite has already been accepted")

    # Check email match (case-insensitive)
    # Normalize both emails to lowercase for comparison
    if invite.email.lower() != user.email.lower():
        raise HTTPException(status_code=400, detail="Invite is for a different email address")

    # Create membership
    member = OrganizationMember(
        organization_id=invite.organization_id,
        user_id=user.id,
        role=invite.role,
    )
    db.add(member)

    # Mark invite as accepted
    invite.accepted_at = datetime.now(timezone.utc)

    await db.commit()

    # Get org
    org = await db.get(Organization, invite.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Count members
    count_result = await db.execute(
        select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == org.id)
    )
    member_count = count_result.scalar() or 0

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_at=org.created_at,
        updated_at=org.updated_at,
        member_count=member_count,
    )


# --- Public Invite Info ---

@router.get("/invites/{token}/info")
@limiter.limit("10/minute")
async def get_invite_info(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint to get invite info for the landing page. No auth required."""
    result = await db.execute(
        select(OrganizationInvite).where(OrganizationInvite.token == token)
    )
    invite = result.scalars().first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invite has already been accepted")

    org = await db.get(Organization, invite.organization_id)
    org_name = org.name if org else "Unknown"

    return {
        "org_name": org_name,
        "role": invite.role,
        "email": invite.email,
    }


# --- Admin Views ---

@router.get("/trips", response_model=list[OrgTripResponse])
async def list_org_trips(
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all trips in the organization (admin only). Ordered by created_at desc."""
    result = await db.execute(
        select(Trip, User)
        .join(User, Trip.user_id == User.id)
        .where(Trip.organization_id == membership.organization_id)
        .order_by(Trip.created_at.desc())
    )
    trips_with_users = result.all()

    return [
        OrgTripResponse(
            id=trip.id,
            name=trip.name,
            country_code=trip.country_code,
            status=trip.status,
            start_date=trip.start_date,
            end_date=trip.end_date,
            created_at=trip.created_at,
            designer_email=user.email,
        )
        for trip, user in trips_with_users
    ]


@router.get("/stats", response_model=OrgStatsResponse)
async def get_org_stats(
    membership: OrganizationMember = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get organization stats (admin only)."""
    # Total trips
    total_trips_result = await db.execute(
        select(func.count())
        .select_from(Trip)
        .where(Trip.organization_id == membership.organization_id)
    )
    total_trips = total_trips_result.scalar() or 0

    # Total members
    total_members_result = await db.execute(
        select(func.count())
        .select_from(OrganizationMember)
        .where(OrganizationMember.organization_id == membership.organization_id)
    )
    total_members = total_members_result.scalar() or 0

    # Trips per designer
    trips_by_designer_result = await db.execute(
        select(User.email, func.count(Trip.id).label("count"))
        .select_from(Trip)
        .join(User, Trip.user_id == User.id)
        .where(Trip.organization_id == membership.organization_id)
        .group_by(User.email)
        .order_by(func.count(Trip.id).desc())
    )
    trips_by_designer = [
        TripsPerDesigner(email=row[0], count=row[1])
        for row in trips_by_designer_result.all()
    ]

    # Trips by status
    trips_by_status_result = await db.execute(
        select(Trip.status, func.count(Trip.id).label("count"))
        .where(Trip.organization_id == membership.organization_id)
        .group_by(Trip.status)
    )
    trips_by_status = {row[0]: row[1] for row in trips_by_status_result.all()}

    return OrgStatsResponse(
        total_trips=total_trips,
        total_members=total_members,
        trips_by_designer=trips_by_designer,
        trips_by_status=trips_by_status,
    )
