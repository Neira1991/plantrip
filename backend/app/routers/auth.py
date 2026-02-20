import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import settings
from app.database import get_db
from app.dependencies import limiter
from app.email import send_email_verification, send_welcome_email
from app.models import Organization, OrganizationMember, User
from app.schemas import OrgInfo, UserLogin, UserRegister, UserResponse, VerifyEmailRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(response: Response, user: User) -> None:
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, data: UserRegister, response: Response, db: AsyncSession = Depends(get_db)):
    if not data.email or not data.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Normalize email to lowercase for case-insensitive storage
    normalized_email = data.email.strip().lower()

    # Check for existing user with case-insensitive comparison
    result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="Email already registered")

    verification_token = secrets.token_urlsafe(48)
    user = User(
        email=normalized_email,
        hashed_password=hash_password(data.password),
        email_verification_token=verification_token,
        email_verification_sent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Fire-and-forget emails
    await send_email_verification(normalized_email, verification_token)
    await send_welcome_email(normalized_email)

    _set_auth_cookies(response, user)
    return user


@router.post("/login", response_model=UserResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    # Normalize email to lowercase for case-insensitive lookup
    normalized_email = data.email.strip().lower()
    result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = result.scalars().first()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _set_auth_cookies(response, user)
    return user


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    from uuid import UUID
    user = await db.get(User, UUID(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token(str(user.id))
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"status": "refreshed"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "logged out"}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get organization membership if exists
    result = await db.execute(
        select(OrganizationMember, Organization)
        .join(Organization, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == user.id)
    )
    membership_org = result.first()

    org_info = None
    if membership_org:
        membership, org = membership_org
        org_info = OrgInfo(
            id=org.id,
            name=org.name,
            slug=org.slug,
            role=membership.role,
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        created_at=user.created_at,
        organization=org_info,
    )


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Verify email address using token."""
    result = await db.execute(
        select(User).where(User.email_verification_token == data.token)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.email_verified = True
    user.email_verification_token = None
    await db.commit()
    return {"status": "verified"}


@router.post("/resend-verification")
@limiter.limit("2/minute")
async def resend_verification(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend verification email for the currently logged-in user."""
    if user.email_verified:
        return {"status": "already_verified"}

    token = secrets.token_urlsafe(48)
    user.email_verification_token = token
    user.email_verification_sent_at = datetime.now(timezone.utc)
    await db.commit()

    await send_email_verification(user.email, token)
    return {"status": "sent"}
