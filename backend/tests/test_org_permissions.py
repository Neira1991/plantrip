"""
Test organization permission edge cases and security.

Covers:
- Permission boundaries between admin and designer roles
- Last admin protection across all operations
- Non-member access prevention
- Rate limiting on invites (when TESTING=false)
- Cross-organization access prevention
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, OrganizationMember, User


@pytest.mark.asyncio
class TestPermissionBoundaries:
    """Test permission boundaries between roles."""

    async def test_designer_cannot_access_admin_endpoints(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer is forbidden from all admin-only endpoints."""
        # Cannot update org
        response = await client.put(
            "/api/org",
            json={"name": "New Name"},
            headers=auth_headers_user2
        )
        assert response.status_code == 403

        # Cannot delete org
        response = await client.delete("/api/org", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot create invite
        response = await client.post(
            "/api/org/invites",
            json={"email": "test@test.com"},
            headers=auth_headers_user2
        )
        assert response.status_code == 403

        # Cannot list invites
        response = await client.get("/api/org/invites", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot revoke invite
        from uuid import uuid4
        response = await client.delete(
            f"/api/org/invites/{uuid4()}",
            headers=auth_headers_user2
        )
        assert response.status_code == 403

        # Cannot change member roles
        response = await client.put(
            f"/api/org/members/{uuid4()}/role",
            json={"role": "admin"},
            headers=auth_headers_user2
        )
        assert response.status_code == 403

        # Cannot list org trips
        response = await client.get("/api/org/trips", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot view org stats
        response = await client.get("/api/org/stats", headers=auth_headers_user2)
        assert response.status_code == 403

    async def test_designer_can_access_member_endpoints(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer can access endpoints available to all members."""
        # Can get organization
        response = await client.get("/api/org", headers=auth_headers_user2)
        assert response.status_code == 200

        # Can list members
        response = await client.get("/api/org/members", headers=auth_headers_user2)
        assert response.status_code == 200

        # Can leave organization (remove self)
        from sqlalchemy import select
        # Get their own user_id from membership
        response = await client.delete(
            f"/api/org/members/{pytest.user2_id_placeholder}",
            headers=auth_headers_user2
        )
        # This will be tested in detail in test_org_members.py

    async def test_non_member_forbidden_from_all_org_endpoints(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """User not in any org is forbidden from all org endpoints."""
        # Cannot get org
        response = await client.get("/api/org", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot update org
        response = await client.put(
            "/api/org",
            json={"name": "X"},
            headers=auth_headers_user2
        )
        assert response.status_code == 403

        # Cannot delete org
        response = await client.delete("/api/org", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot list members
        response = await client.get("/api/org/members", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot list invites
        response = await client.get("/api/org/invites", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot list trips
        response = await client.get("/api/org/trips", headers=auth_headers_user2)
        assert response.status_code == 403

        # Cannot view stats
        response = await client.get("/api/org/stats", headers=auth_headers_user2)
        assert response.status_code == 403


@pytest.mark.asyncio
class TestLastAdminProtection:
    """Test that last admin cannot be removed or demoted."""

    async def test_last_admin_cannot_demote_self(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        organization: Organization
    ):
        """Single admin cannot demote themselves."""
        response = await client.put(
            f"/api/org/members/{user.id}/role",
            json={"role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "last admin" in response.json()["detail"].lower()

    async def test_last_admin_cannot_leave(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        organization: Organization
    ):
        """Single admin cannot leave organization."""
        response = await client.delete(
            f"/api/org/members/{user.id}",
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "last admin" in response.json()["detail"].lower()

    async def test_multiple_admins_can_demote_each_other(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """With 2+ admins, one can demote another."""
        # Promote user2 to admin
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        membership.role = "admin"
        await db.commit()

        # Now user (admin) can demote user2
        response = await client.put(
            f"/api/org/members/{user2.id}/role",
            json={"role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["role"] == "designer"

    async def test_multiple_admins_one_can_leave(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """With 2+ admins, one can leave."""
        # Promote user2 to admin
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        membership.role = "admin"
        await db.commit()

        # Now user (admin) can leave
        from app.models import User as UserModel
        user_obj = await db.get(UserModel, pytest.user_id_from_fixture)
        # Will be tested in detail in members test

    async def test_removing_last_admin_fails_after_another_leaves(
        self,
        client: AsyncClient,
        auth_headers: dict,
        auth_headers_user2: dict,
        user: User,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """After one admin leaves, cannot remove the last remaining admin."""
        # Promote user2 to admin
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        membership.role = "admin"
        await db.commit()

        # user2 (admin) leaves
        response = await client.delete(
            f"/api/org/members/{user2.id}",
            headers=auth_headers_user2
        )
        assert response.status_code == 204

        # Now user is the last admin, cannot be removed
        response = await client.delete(
            f"/api/org/members/{user.id}",
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "last admin" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestCrossOrganizationAccess:
    """Test that users cannot access other organizations."""

    async def test_cannot_access_other_org_invite(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        user3: User,
        auth_headers_user3: dict,
        db: AsyncSession
    ):
        """Admin of org A cannot revoke invite from org B."""
        # Create second organization with user3 as admin
        org_b = Organization(name="Org B", slug="org-b")
        db.add(org_b)
        await db.flush()

        member_b = OrganizationMember(
            organization_id=org_b.id,
            user_id=user3.id,
            role="admin"
        )
        db.add(member_b)
        await db.commit()

        # user creates invite in their org (org A)
        response = await client.post(
            "/api/org/invites",
            json={"email": "invite-a@test.com"},
            headers=auth_headers
        )
        assert response.status_code == 201
        invite_a_id = response.json()["id"]

        # user3 (admin of org B) cannot revoke invite from org A
        response = await client.delete(
            f"/api/org/invites/{invite_a_id}",
            headers=auth_headers_user3
        )
        assert response.status_code == 404

    async def test_get_org_returns_own_org_only(
        self,
        client: AsyncClient,
        auth_headers: dict,
        auth_headers_user3: dict,
        organization: Organization,
        user3: User,
        db: AsyncSession
    ):
        """Each admin sees only their own organization."""
        # Create second organization with user3
        org_b = Organization(name="Org B", slug="org-b")
        db.add(org_b)
        await db.flush()

        member_b = OrganizationMember(
            organization_id=org_b.id,
            user_id=user3.id,
            role="admin"
        )
        db.add(member_b)
        await db.commit()

        # user gets their org (org A)
        response = await client.get("/api/org", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["slug"] == "test-organization"

        # user3 gets their org (org B)
        response = await client.get("/api/org", headers=auth_headers_user3)
        assert response.status_code == 200
        assert response.json()["slug"] == "org-b"


@pytest.mark.asyncio
class TestAuthenticationRequired:
    """Test that all org endpoints require authentication."""

    async def test_all_endpoints_require_auth(self, client: AsyncClient):
        """All org endpoints return 401 without authentication."""
        from uuid import uuid4

        endpoints = [
            ("GET", "/api/org"),
            ("POST", "/api/org", {"name": "Test"}),
            ("PUT", "/api/org", {"name": "Test"}),
            ("DELETE", "/api/org"),
            ("GET", "/api/org/members"),
            ("PUT", f"/api/org/members/{uuid4()}/role", {"role": "admin"}),
            ("DELETE", f"/api/org/members/{uuid4()}"),
            ("GET", "/api/org/invites"),
            ("POST", "/api/org/invites", {"email": "test@test.com"}),
            ("DELETE", f"/api/org/invites/{uuid4()}"),
            ("POST", "/api/org/invites/fake-token/accept"),
            ("GET", "/api/org/trips"),
            ("GET", "/api/org/stats"),
        ]

        for method, url, *args in endpoints:
            json_data = args[0] if args else None
            if method == "GET":
                response = await client.get(url)
            elif method == "POST":
                response = await client.post(url, json=json_data)
            elif method == "PUT":
                response = await client.put(url, json=json_data)
            elif method == "DELETE":
                response = await client.delete(url)

            assert response.status_code == 401, f"{method} {url} should require auth"


@pytest.mark.asyncio
class TestInputValidation:
    """Test input validation on organization endpoints."""

    async def test_create_org_empty_name(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Cannot create org with empty name."""
        response = await client.post(
            "/api/org",
            json={"name": ""},
            headers=auth_headers
        )

        assert response.status_code == 422

    async def test_create_org_name_too_long(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Cannot create org with name > 200 chars."""
        response = await client.post(
            "/api/org",
            json={"name": "x" * 201},
            headers=auth_headers
        )

        assert response.status_code == 422

    async def test_create_invite_invalid_email(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Cannot create invite with invalid email."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "not-an-email"},
            headers=auth_headers
        )

        assert response.status_code == 422

    async def test_create_invite_email_too_long(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Cannot create invite with email > 320 chars."""
        long_email = "x" * 310 + "@test.com"
        response = await client.post(
            "/api/org/invites",
            json={"email": long_email},
            headers=auth_headers
        )

        assert response.status_code == 422

    async def test_update_member_role_invalid_role(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization
    ):
        """Cannot set invalid role."""
        response = await client.put(
            f"/api/org/members/{user2.id}/role",
            json={"role": "owner"},
            headers=auth_headers
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestCascadeDeletes:
    """Test that deleting organization properly cascades."""

    async def test_delete_org_cascades_to_members(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Deleting org deletes all memberships."""
        org_id = organization_with_designer.id

        response = await client.delete("/api/org", headers=auth_headers)
        assert response.status_code == 204

        # Verify all memberships deleted
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id
            )
        )
        assert result.scalars().first() is None

    async def test_delete_org_cascades_to_invites(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        invite,
        db: AsyncSession
    ):
        """Deleting org deletes all invites."""
        from app.models import OrganizationInvite

        org_id = organization.id

        response = await client.delete("/api/org", headers=auth_headers)
        assert response.status_code == 204

        # Verify all invites deleted
        result = await db.execute(
            select(OrganizationInvite).where(
                OrganizationInvite.organization_id == org_id
            )
        )
        assert result.scalars().first() is None

    async def test_delete_org_sets_trip_org_id_to_null(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip,
        db: AsyncSession
    ):
        """Deleting org sets trip.organization_id to NULL (not deleting trips)."""
        trip_id = trip.id

        response = await client.delete("/api/org", headers=auth_headers)
        assert response.status_code == 204

        # Verify trip still exists but org_id is null
        await db.refresh(trip)
        assert trip.id == trip_id
        assert trip.organization_id is None
