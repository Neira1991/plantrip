"""
Test configuration and fixtures for backend integration tests.

Sets up:
- Async test database (PostgreSQL via Docker Compose)
- FastAPI test client with async support
- User authentication helpers
- Organization and invite helpers
"""
import os
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set TESTING env var before importing app
os.environ["TESTING"] = "true"

from app.auth import create_access_token, hash_password
from app.database import get_db
from app.main import app
from app.models import Base, Organization, OrganizationInvite, OrganizationMember, Trip, User


# Test database configuration
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test"
)

# Create test engine and session
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    """Override get_db to use test database."""
    async with test_async_session() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for session-scoped fixtures."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create all tables at session start, drop at session end."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
async def clean_db():
    """Clean all tables before each test to ensure isolation."""
    async with test_async_session() as session:
        # Truncate in reverse FK order to avoid constraint violations
        await session.execute(text("TRUNCATE activity_feedback, trip_versions, activities, movements, trip_stops, trips, organization_invites, organization_members, organizations, share_tokens, users CASCADE"))
        await session.commit()
    yield


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for direct DB operations in tests."""
    async with test_async_session() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Get an async HTTP client for API testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def user(db: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        hashed_password=hash_password("testpass123")
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def user2(db: AsyncSession) -> User:
    """Create a second test user."""
    user = User(
        email="test2@example.com",
        hashed_password=hash_password("testpass123")
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def user3(db: AsyncSession) -> User:
    """Create a third test user."""
    user = User(
        email="test3@example.com",
        hashed_password=hash_password("testpass123")
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
def auth_headers(user: User) -> dict:
    """Generate auth headers with access token for a user."""
    token = create_access_token(str(user.id))
    return {"Cookie": f"access_token={token}"}


@pytest.fixture
def auth_headers_user2(user2: User) -> dict:
    """Generate auth headers for user2."""
    token = create_access_token(str(user2.id))
    return {"Cookie": f"access_token={token}"}


@pytest.fixture
def auth_headers_user3(user3: User) -> dict:
    """Generate auth headers for user3."""
    token = create_access_token(str(user3.id))
    return {"Cookie": f"access_token={token}"}


@pytest.fixture
async def organization(db: AsyncSession, user: User) -> Organization:
    """Create a test organization with user as admin."""
    org = Organization(name="Test Organization", slug="test-organization")
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role="admin"
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.fixture
async def organization_with_designer(
    db: AsyncSession,
    organization: Organization,
    user2: User
) -> Organization:
    """Add user2 as a designer to the organization."""
    member = OrganizationMember(
        organization_id=organization.id,
        user_id=user2.id,
        role="designer"
    )
    db.add(member)
    await db.commit()
    return organization


@pytest.fixture
async def invite(
    db: AsyncSession,
    organization: Organization
) -> OrganizationInvite:
    """Create a pending invite for the organization."""
    invite = OrganizationInvite(
        organization_id=organization.id,
        email="invitee@example.com",
        role="designer",
        token="test-invite-token-123",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


@pytest.fixture
async def trip(db: AsyncSession, user: User, organization: Organization) -> Trip:
    """Create a test trip for user in organization."""
    trip = Trip(
        user_id=user.id,
        organization_id=organization.id,
        name="Test Trip to France",
        country_code="FR",
        start_date=datetime(2026, 6, 1).date(),
        status="planning"
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


@pytest.fixture
async def trip_user2(db: AsyncSession, user2: User, organization: Organization) -> Trip:
    """Create a test trip for user2 in organization."""
    trip = Trip(
        user_id=user2.id,
        organization_id=organization.id,
        name="User2 Trip to Spain",
        country_code="ES",
        start_date=datetime(2026, 7, 1).date(),
        status="active"
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip
