"""
Sanity tests to verify test infrastructure is working correctly.

These tests should pass if the test setup is correct.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


@pytest.mark.asyncio
class TestInfrastructure:
    """Test that test infrastructure is working."""

    async def test_database_connection(self, db: AsyncSession):
        """Database session is created successfully."""
        assert db is not None
        # Execute a simple query
        from sqlalchemy import text
        result = await db.execute(text("SELECT 1 as test"))
        row = result.first()
        assert row[0] == 1

    async def test_client_available(self, client: AsyncClient):
        """HTTP client is available."""
        assert client is not None

    async def test_health_endpoint(self, client: AsyncClient):
        """Health endpoint is accessible."""
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    async def test_user_fixture(self, user: User):
        """User fixture creates a user."""
        assert user is not None
        assert user.email == "test@example.com"
        assert user.id is not None

    async def test_auth_headers_fixture(self, auth_headers: dict):
        """Auth headers fixture provides valid JWT."""
        assert "Cookie" in auth_headers
        assert "access_token=" in auth_headers["Cookie"]

    async def test_authenticated_request(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User
    ):
        """Can make authenticated requests."""
        response = await client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user.email

    async def test_database_is_clean(self, db: AsyncSession):
        """Database is cleaned before each test."""
        from sqlalchemy import select, text
        from app.models import Organization, User

        # Check that there are no leftover organizations
        # (except those created by fixtures in this test)
        result = await db.execute(select(Organization))
        orgs = result.scalars().all()
        # Should be empty unless organization fixture is used
        assert len(orgs) == 0

    async def test_multiple_users_can_be_created(
        self,
        user: User,
        user2: User,
        user3: User
    ):
        """Multiple user fixtures work correctly."""
        assert user.email == "test@example.com"
        assert user2.email == "test2@example.com"
        assert user3.email == "test3@example.com"
        assert user.id != user2.id
        assert user2.id != user3.id
