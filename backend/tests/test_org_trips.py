"""
Test organization trip integration and admin views.

Covers:
- New trip auto-gets organization_id when user is in org
- Admin sees all org trips via GET /api/org/trips
- GET /api/auth/me returns org info
- Organization stats endpoint
"""
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, Trip, User


@pytest.mark.asyncio
class TestTripOrganizationIntegration:
    """Test that trips are automatically linked to user's organization."""

    async def test_create_trip_auto_assigns_organization(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """When user creates trip, it gets their organization_id."""
        response = await client.post(
            "/api/trips",
            json={
                "name": "Trip to Italy",
                "country_code": "IT",
                "start_date": "2026-06-01",
                "status": "planning"
            },
            headers=auth_headers
        )

        assert response.status_code == 201
        trip_id = response.json()["id"]

        # Verify trip has organization_id in DB
        from uuid import UUID
        trip = await db.get(Trip, UUID(trip_id))
        assert trip is not None
        assert trip.organization_id == organization.id

    async def test_create_trip_without_organization(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        db: AsyncSession
    ):
        """User not in org creates trip with null organization_id."""
        response = await client.post(
            "/api/trips",
            json={
                "name": "Personal Trip",
                "country_code": "ES",
                "start_date": "2026-07-01",
                "status": "planning"
            },
            headers=auth_headers_user2
        )

        assert response.status_code == 201
        trip_id = response.json()["id"]

        # Verify trip has null organization_id
        from uuid import UUID
        trip = await db.get(Trip, UUID(trip_id))
        assert trip is not None
        assert trip.organization_id is None


@pytest.mark.asyncio
class TestListOrgTrips:
    """Test GET /api/org/trips - listing all organization trips."""

    async def test_list_org_trips_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip,
        trip_user2,
        organization_with_designer: Organization
    ):
        """Admin can see all trips in organization."""
        response = await client.get("/api/org/trips", headers=auth_headers)

        assert response.status_code == 200
        trips = response.json()
        assert len(trips) == 2

        # Extract trip names
        trip_names = {t["name"] for t in trips}
        assert "Test Trip to France" in trip_names
        assert "User2 Trip to Spain" in trip_names

        # Verify designer emails are included
        trip_by_name = {t["name"]: t for t in trips}
        assert trip_by_name["Test Trip to France"]["designer_email"] == "test@example.com"
        assert trip_by_name["User2 Trip to Spain"]["designer_email"] == "test2@example.com"

    async def test_list_org_trips_ordered_by_created_at_desc(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip,
        trip_user2,
        organization_with_designer: Organization
    ):
        """Trips are ordered by created_at desc (newest first)."""
        response = await client.get("/api/org/trips", headers=auth_headers)

        assert response.status_code == 200
        trips = response.json()
        # trip_user2 was created second, so should be first
        assert trips[0]["name"] == "User2 Trip to Spain"
        assert trips[1]["name"] == "Test Trip to France"

    async def test_list_org_trips_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer cannot list org trips (admin-only endpoint)."""
        response = await client.get("/api/org/trips", headers=auth_headers_user2)

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_list_org_trips_includes_all_fields(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip: Trip
    ):
        """Response includes all required trip fields."""
        response = await client.get("/api/org/trips", headers=auth_headers)

        assert response.status_code == 200
        trips = response.json()
        trip_data = trips[0]

        assert "id" in trip_data
        assert "name" in trip_data
        assert "country_code" in trip_data
        assert "status" in trip_data
        assert "start_date" in trip_data
        assert "end_date" in trip_data
        assert "created_at" in trip_data
        assert "designer_email" in trip_data

    async def test_list_org_trips_empty_organization(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Returns empty list for org with no trips."""
        response = await client.get("/api/org/trips", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_org_trips_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot list org trips."""
        response = await client.get("/api/org/trips", headers=auth_headers_user2)

        assert response.status_code == 403


@pytest.mark.asyncio
class TestAuthMeWithOrganization:
    """Test GET /api/auth/me returns organization info."""

    async def test_me_includes_organization_info(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        user: User
    ):
        """User in org sees org info in /me response."""
        response = await client.get("/api/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user.email
        assert data["organization"] is not None
        assert data["organization"]["id"] == str(organization.id)
        assert data["organization"]["name"] == organization.name
        assert data["organization"]["slug"] == organization.slug
        assert data["organization"]["role"] == "admin"

    async def test_me_designer_role(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer sees their role correctly."""
        response = await client.get("/api/auth/me", headers=auth_headers_user2)

        assert response.status_code == 200
        org_info = response.json()["organization"]
        assert org_info["role"] == "designer"

    async def test_me_without_organization(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """User not in org has null organization."""
        response = await client.get("/api/auth/me", headers=auth_headers_user2)

        assert response.status_code == 200
        assert response.json()["organization"] is None


@pytest.mark.asyncio
class TestOrgStats:
    """Test GET /api/org/stats - organization statistics."""

    async def test_get_org_stats_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip,
        trip_user2,
        organization_with_designer: Organization
    ):
        """Admin can view organization statistics."""
        response = await client.get("/api/org/stats", headers=auth_headers)

        assert response.status_code == 200
        stats = response.json()

        assert stats["total_trips"] == 2
        assert stats["total_members"] == 2

        # Trips by designer
        assert len(stats["trips_by_designer"]) == 2
        trips_by_email = {d["email"]: d["count"] for d in stats["trips_by_designer"]}
        assert trips_by_email["test@example.com"] == 1
        assert trips_by_email["test2@example.com"] == 1

        # Trips by status
        assert stats["trips_by_status"]["planning"] == 1
        assert stats["trips_by_status"]["active"] == 1

    async def test_get_org_stats_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer cannot view org stats."""
        response = await client.get("/api/org/stats", headers=auth_headers_user2)

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_get_org_stats_empty_org(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Stats work correctly for org with no trips."""
        response = await client.get("/api/org/stats", headers=auth_headers)

        assert response.status_code == 200
        stats = response.json()

        assert stats["total_trips"] == 0
        assert stats["total_members"] == 1
        assert stats["trips_by_designer"] == []
        assert stats["trips_by_status"] == {}

    async def test_get_org_stats_trips_by_designer_ordered_by_count(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Trips by designer are ordered by count descending."""
        # Create 3 trips for user, 1 for user2
        for i in range(3):
            trip = Trip(
                user_id=user.id,
                organization_id=organization_with_designer.id,
                name=f"Trip {i}",
                country_code="FR",
                start_date=datetime(2026, 6, 1).date(),
                status="planning"
            )
            db.add(trip)

        trip_user2 = Trip(
            user_id=user2.id,
            organization_id=organization_with_designer.id,
            name="User2 Trip",
            country_code="ES",
            start_date=datetime(2026, 7, 1).date(),
            status="planning"
        )
        db.add(trip_user2)
        await db.commit()

        response = await client.get("/api/org/stats", headers=auth_headers)

        assert response.status_code == 200
        trips_by_designer = response.json()["trips_by_designer"]

        # Should be ordered by count descending
        assert trips_by_designer[0]["email"] == "test@example.com"
        assert trips_by_designer[0]["count"] == 3
        assert trips_by_designer[1]["email"] == "test2@example.com"
        assert trips_by_designer[1]["count"] == 1

    async def test_get_org_stats_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot view org stats."""
        response = await client.get("/api/org/stats", headers=auth_headers_user2)

        assert response.status_code == 403
