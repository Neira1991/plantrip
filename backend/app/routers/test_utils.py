import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, create_refresh_token, hash_password
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/test", tags=["test"])

# Shared secret that E2E tests must send to access test endpoints.
# Not a real security boundary (TESTING should be off in prod),
# but prevents accidental or casual abuse when TESTING is on.
TEST_SECRET = "plantrip-test-secret"


def _verify_test_secret(x_test_secret: str | None = Header(default=None)):
    if x_test_secret != TEST_SECRET:
        raise HTTPException(status_code=403, detail="Invalid test secret")


@router.post("/reset")
async def reset_database(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_test_secret),
):
    """Truncate all tables in FK-safe order. Only available when TESTING=true."""
    await db.execute(text("TRUNCATE activities, movements, trip_stops, trips, users CASCADE"))
    await db.commit()
    return {"status": "reset"}


@router.post("/create-test-user")
async def create_test_user(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_test_secret),
):
    """Create a test user and return tokens. Only available when TESTING=true."""
    email = f"test-{uuid.uuid4().hex[:8]}@test.com"
    user = User(email=email, hashed_password=hash_password("testpass123"))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    return {
        "id": str(user.id),
        "email": user.email,
        "access_token": access_token,
        "refresh_token": refresh_token,
    }
