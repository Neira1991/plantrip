"""
Test organization team management operations.

Covers:
- List members with trip counts
- Change member role (admin->designer, designer->admin, last admin protection)
- Remove member (admin removes designer, self-leave, last admin protection)
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, OrganizationMember, User


@pytest.mark.asyncio
class TestListMembers:
    """Test GET /api/org/members - listing organization members."""

    async def test_list_members_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        user: User
    ):
        """Admin can list members with trip counts."""
        response = await client.get("/api/org/members", headers=auth_headers)

        assert response.status_code == 200
        members = response.json()
        assert len(members) == 1
        assert members[0]["email"] == user.email
        assert members[0]["role"] == "admin"
        assert members[0]["trip_count"] == 0
        assert str(members[0]["user_id"]) == str(user.id)

    async def test_list_members_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer can also list members."""
        response = await client.get("/api/org/members", headers=auth_headers_user2)

        assert response.status_code == 200
        members = response.json()
        assert len(members) == 2

    async def test_list_members_includes_trip_counts(
        self,
        client: AsyncClient,
        auth_headers: dict,
        trip,
        trip_user2,
        organization_with_designer: Organization
    ):
        """Members are shown with accurate trip counts."""
        response = await client.get("/api/org/members", headers=auth_headers)

        assert response.status_code == 200
        members = response.json()
        assert len(members) == 2

        # Find each member's trip count
        member_emails = {m["email"]: m["trip_count"] for m in members}
        assert member_emails["test@example.com"] == 1
        assert member_emails["test2@example.com"] == 1

    async def test_list_members_ordered_by_join_date(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization_with_designer: Organization
    ):
        """Members are ordered by created_at (join date)."""
        response = await client.get("/api/org/members", headers=auth_headers)

        assert response.status_code == 200
        members = response.json()
        # user (admin) joined first, user2 (designer) joined second
        assert members[0]["email"] == "test@example.com"
        assert members[1]["email"] == "test2@example.com"

    async def test_list_members_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot list any org members."""
        response = await client.get("/api/org/members", headers=auth_headers_user2)

        assert response.status_code == 403


@pytest.mark.asyncio
class TestUpdateMemberRole:
    """Test PUT /api/org/members/{user_id}/role - changing member roles."""

    async def test_promote_designer_to_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Admin can promote designer to admin."""
        response = await client.put(
            f"/api/org/members/{user2.id}/role",
            json={"role": "admin"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert data["email"] == user2.email

        # Verify in DB
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        assert membership.role == "admin"

    async def test_demote_admin_to_designer(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Admin can demote another admin to designer if not last admin."""
        # First promote user2 to admin
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        membership.role = "admin"
        await db.commit()

        # Now there are 2 admins, so we can demote one
        response = await client.put(
            f"/api/org/members/{user2.id}/role",
            json={"role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["role"] == "designer"

    async def test_cannot_demote_last_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        organization: Organization
    ):
        """Cannot demote the last admin in organization."""
        response = await client.put(
            f"/api/org/members/{user.id}/role",
            json={"role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "last admin" in response.json()["detail"].lower()

    async def test_designer_cannot_change_roles(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user: User,
        organization_with_designer: Organization
    ):
        """Designer cannot change anyone's role."""
        response = await client.put(
            f"/api/org/members/{user.id}/role",
            json={"role": "designer"},
            headers=auth_headers_user2
        )

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_update_role_nonexistent_member(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Updating role for non-member returns 404."""
        from uuid import uuid4
        fake_user_id = uuid4()

        response = await client.put(
            f"/api/org/members/{fake_user_id}/role",
            json={"role": "admin"},
            headers=auth_headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_update_role_invalid_role(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization
    ):
        """Invalid role value is rejected."""
        response = await client.put(
            f"/api/org/members/{user2.id}/role",
            json={"role": "superuser"},
            headers=auth_headers
        )

        assert response.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
class TestRemoveMember:
    """Test DELETE /api/org/members/{user_id} - removing members."""

    async def test_admin_removes_designer(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Admin can remove a designer from organization."""
        response = await client.delete(
            f"/api/org/members/{user2.id}",
            headers=auth_headers
        )

        assert response.status_code == 204

        # Verify membership is deleted
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        assert result.scalars().first() is None

    async def test_member_leaves_organization(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Any member can leave (remove themselves) from organization."""
        response = await client.delete(
            f"/api/org/members/{user2.id}",
            headers=auth_headers_user2
        )

        assert response.status_code == 204

        # Verify they're removed
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        assert result.scalars().first() is None

    async def test_cannot_remove_last_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        organization: Organization
    ):
        """Cannot remove the last admin from organization."""
        response = await client.delete(
            f"/api/org/members/{user.id}",
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "last admin" in response.json()["detail"].lower()

    async def test_admin_can_remove_another_admin_if_not_last(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization,
        db: AsyncSession
    ):
        """Admin can remove another admin if there are multiple admins."""
        # Promote user2 to admin
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        membership.role = "admin"
        await db.commit()

        # Now remove user2
        response = await client.delete(
            f"/api/org/members/{user2.id}",
            headers=auth_headers
        )

        assert response.status_code == 204

    async def test_designer_cannot_remove_others(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user: User,
        organization_with_designer: Organization
    ):
        """Designer cannot remove other members."""
        response = await client.delete(
            f"/api/org/members/{user.id}",
            headers=auth_headers_user2
        )

        assert response.status_code == 403
        assert "only remove yourself" in response.json()["detail"].lower()

    async def test_remove_nonexistent_member(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Removing non-member returns 404."""
        from uuid import uuid4
        fake_user_id = uuid4()

        response = await client.delete(
            f"/api/org/members/{fake_user_id}",
            headers=auth_headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_non_member_cannot_remove_anyone(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user: User
    ):
        """Non-member of any org cannot remove members."""
        response = await client.delete(
            f"/api/org/members/{user.id}",
            headers=auth_headers_user2
        )

        assert response.status_code == 403
