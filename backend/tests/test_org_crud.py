"""
Test organization CRUD operations.

Covers:
- Create organization (success, already in org)
- Get organization (member sees it, non-member forbidden)
- Update organization (admin success, designer forbidden)
- Delete organization (admin success, designer forbidden)
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, OrganizationMember, User


@pytest.mark.asyncio
class TestCreateOrganization:
    """Test POST /api/org - creating a new organization."""

    async def test_create_organization_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        db: AsyncSession
    ):
        """User can create organization and becomes admin."""
        response = await client.post(
            "/api/org",
            json={"name": "My New Org"},
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My New Org"
        assert data["slug"] == "my-new-org"
        assert data["member_count"] == 1
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

        # Verify user is admin in DB
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user.id
            )
        )
        membership = result.scalars().first()
        assert membership is not None
        assert membership.role == "admin"
        assert str(membership.organization_id) == data["id"]

    async def test_create_organization_already_member(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """User already in an org cannot create another org."""
        response = await client.post(
            "/api/org",
            json={"name": "Another Org"},
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "Cannot create organization" in response.json()["detail"]

    async def test_create_organization_not_authenticated(
        self,
        client: AsyncClient
    ):
        """Unauthenticated request is rejected."""
        response = await client.post(
            "/api/org",
            json={"name": "My Org"}
        )

        assert response.status_code == 401

    async def test_create_organization_generates_unique_slug(
        self,
        client: AsyncClient,
        auth_headers: dict,
        auth_headers_user2: dict,
        user: User,
        user2: User
    ):
        """Multiple orgs with similar names get unique slugs."""
        # User 1 creates first org
        response1 = await client.post(
            "/api/org",
            json={"name": "Tech Startup"},
            headers=auth_headers
        )
        assert response1.status_code == 201
        slug1 = response1.json()["slug"]
        assert slug1 == "tech-startup"

        # User 2 creates org with same name - should get unique slug
        response2 = await client.post(
            "/api/org",
            json={"name": "Tech Startup"},
            headers=auth_headers_user2
        )
        assert response2.status_code == 201
        slug2 = response2.json()["slug"]
        assert slug2 != slug1
        assert slug2.startswith("tech-startup-")

    async def test_create_organization_handles_special_characters(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Org name with special chars generates valid slug."""
        response = await client.post(
            "/api/org",
            json={"name": "My Org!!! (2026) - #1"},
            headers=auth_headers
        )

        assert response.status_code == 201
        slug = response.json()["slug"]
        # Should be alphanumeric + hyphens only
        assert slug == "my-org-2026-1"


@pytest.mark.asyncio
class TestGetOrganization:
    """Test GET /api/org - retrieving organization details."""

    async def test_get_organization_as_member(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Member can retrieve their organization."""
        response = await client.get("/api/org", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == organization.name
        assert data["slug"] == organization.slug
        assert data["member_count"] == 1
        assert str(data["id"]) == str(organization.id)

    async def test_get_organization_with_multiple_members(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization_with_designer: Organization
    ):
        """Member count reflects all members."""
        response = await client.get("/api/org", headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["member_count"] == 2

    async def test_get_organization_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot access any organization."""
        response = await client.get("/api/org", headers=auth_headers_user2)

        assert response.status_code == 403
        assert "must be a member" in response.json()["detail"].lower()

    async def test_get_organization_not_authenticated(
        self,
        client: AsyncClient
    ):
        """Unauthenticated request is rejected."""
        response = await client.get("/api/org")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdateOrganization:
    """Test PUT /api/org - updating organization name."""

    async def test_update_organization_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Admin can update organization name."""
        response = await client.put(
            "/api/org",
            json={"name": "Updated Org Name"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Org Name"
        assert data["slug"] == "updated-org-name"
        assert str(data["id"]) == str(organization.id)

    async def test_update_organization_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer cannot update organization."""
        response = await client.put(
            "/api/org",
            json={"name": "Hacked Name"},
            headers=auth_headers_user2
        )

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_update_organization_preserves_id(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """Updating org regenerates slug but preserves ID."""
        original_id = organization.id

        await client.put(
            "/api/org",
            json={"name": "New Name"},
            headers=auth_headers
        )

        # Verify in DB
        updated_org = await db.get(Organization, original_id)
        assert updated_org is not None
        assert updated_org.name == "New Name"
        assert updated_org.slug == "new-name"
        assert updated_org.id == original_id

    async def test_update_organization_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot update any organization."""
        response = await client.put(
            "/api/org",
            json={"name": "Whatever"},
            headers=auth_headers_user2
        )

        assert response.status_code == 403


@pytest.mark.asyncio
class TestDeleteOrganization:
    """Test DELETE /api/org - deleting organization."""

    async def test_delete_organization_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """Admin can delete organization."""
        org_id = organization.id

        response = await client.delete("/api/org", headers=auth_headers)

        assert response.status_code == 204

        # Verify org is deleted from DB
        deleted_org = await db.get(Organization, org_id)
        assert deleted_org is None

        # Verify membership is cascade deleted
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id
            )
        )
        assert result.scalars().first() is None

    async def test_delete_organization_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer cannot delete organization."""
        response = await client.delete("/api/org", headers=auth_headers_user2)

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_delete_organization_cascades_to_trips(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip,
        db: AsyncSession
    ):
        """Deleting org sets trip.organization_id to NULL (SET NULL cascade)."""
        trip_id = trip.id
        org_id = trip.organization_id

        response = await client.delete("/api/org", headers=auth_headers)
        assert response.status_code == 204

        # Verify trip still exists but org_id is NULL
        await db.refresh(trip)
        assert trip.organization_id is None
        assert trip.id == trip_id

    async def test_delete_organization_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot delete any organization."""
        response = await client.delete("/api/org", headers=auth_headers_user2)

        assert response.status_code == 403
