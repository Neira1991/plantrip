from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import OrganizationMember, User


async def get_org_membership(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrganizationMember | None:
    """Get the user's organization membership, or None if not a member of any org."""
    result = await db.execute(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id)
    )
    return result.scalars().first()


async def require_org_member(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrganizationMember:
    """Require the user to be a member of an organization."""
    membership = await get_org_membership(user, db)
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member of an organization")
    return membership


async def require_org_admin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrganizationMember:
    """Require the user to be an admin of an organization."""
    membership = await get_org_membership(user, db)
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member of an organization")
    if membership.role != "admin":
        raise HTTPException(status_code=403, detail="You must be an admin to perform this action")
    return membership
