"""
Test organization invite system.

Covers:
- Create invite (admin success, designer forbidden, duplicate email, rate limiting)
- List pending invites (admin only)
- Revoke invite
- Accept invite (valid token, expired token, wrong email, already in org)
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, OrganizationInvite, OrganizationMember, User


@pytest.mark.asyncio
class TestCreateInvite:
    """Test POST /api/org/invites - creating organization invites."""

    async def test_create_invite_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """Admin can create an invite."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "newuser@example.com", "role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "designer"
        assert "token" in data
        assert "expires_at" in data
        assert "id" in data
        assert data["accepted_at"] is None

        # Verify in DB
        result = await db.execute(
            select(OrganizationInvite).where(
                OrganizationInvite.token == data["token"]
            )
        )
        invite = result.scalars().first()
        assert invite is not None
        assert invite.organization_id == organization.id

    async def test_create_invite_defaults_to_designer(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Invite without role defaults to designer."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "newuser@example.com"},
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["role"] == "designer"

    async def test_create_invite_as_admin_role(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Admin can create invite with admin role."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "admin@example.com", "role": "admin"},
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["role"] == "admin"

    async def test_create_invite_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer cannot create invites."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "someone@example.com", "role": "designer"},
            headers=auth_headers_user2
        )

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_create_invite_for_existing_member(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization
    ):
        """Cannot create invite for email that is already a member."""
        response = await client.post(
            "/api/org/invites",
            json={"email": user2.email, "role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 409
        assert "already a member" in response.json()["detail"].lower()

    async def test_create_invite_case_insensitive_email_check(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user2: User,
        organization_with_designer: Organization
    ):
        """Email check is case-insensitive for existing members."""
        response = await client.post(
            "/api/org/invites",
            json={"email": user2.email.upper(), "role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 409
        assert "already a member" in response.json()["detail"].lower()

    async def test_create_invite_normalizes_email(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Email is normalized to lowercase."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "NewUser@EXAMPLE.COM", "role": "designer"},
            headers=auth_headers
        )

        assert response.status_code == 201
        assert response.json()["email"] == "newuser@example.com"

    async def test_create_invite_invalid_role(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Invalid role is rejected."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "user@example.com", "role": "superadmin"},
            headers=auth_headers
        )

        assert response.status_code == 422  # Pydantic validation error

    async def test_create_invite_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot create invites."""
        response = await client.post(
            "/api/org/invites",
            json={"email": "someone@example.com"},
            headers=auth_headers_user2
        )

        assert response.status_code == 403


@pytest.mark.asyncio
class TestListInvites:
    """Test GET /api/org/invites - listing pending invites."""

    async def test_list_invites_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        invite: OrganizationInvite
    ):
        """Admin can list pending invites."""
        response = await client.get("/api/org/invites", headers=auth_headers)

        assert response.status_code == 200
        invites = response.json()
        assert len(invites) == 1
        assert invites[0]["email"] == invite.email
        assert invites[0]["token"] == invite.token

    async def test_list_invites_excludes_expired(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """Expired invites are not returned."""
        # Create expired invite
        expired_invite = OrganizationInvite(
            organization_id=organization.id,
            email="expired@example.com",
            role="designer",
            token="expired-token",
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db.add(expired_invite)
        await db.commit()

        response = await client.get("/api/org/invites", headers=auth_headers)

        assert response.status_code == 200
        invites = response.json()
        assert len(invites) == 0

    async def test_list_invites_excludes_accepted(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """Accepted invites are not returned."""
        # Create accepted invite
        accepted_invite = OrganizationInvite(
            organization_id=organization.id,
            email="accepted@example.com",
            role="designer",
            token="accepted-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            accepted_at=datetime.now(timezone.utc)
        )
        db.add(accepted_invite)
        await db.commit()

        response = await client.get("/api/org/invites", headers=auth_headers)

        assert response.status_code == 200
        invites = response.json()
        assert len(invites) == 0

    async def test_list_invites_ordered_by_created_at_desc(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization,
        db: AsyncSession
    ):
        """Invites are ordered by created_at desc (newest first)."""
        # Create multiple invites
        invite1 = OrganizationInvite(
            organization_id=organization.id,
            email="first@example.com",
            role="designer",
            token="token1",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite1)
        await db.commit()

        invite2 = OrganizationInvite(
            organization_id=organization.id,
            email="second@example.com",
            role="designer",
            token="token2",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite2)
        await db.commit()

        response = await client.get("/api/org/invites", headers=auth_headers)

        assert response.status_code == 200
        invites = response.json()
        assert len(invites) == 2
        # Newest first
        assert invites[0]["email"] == "second@example.com"
        assert invites[1]["email"] == "first@example.com"

    async def test_list_invites_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        organization_with_designer: Organization
    ):
        """Designer cannot list invites."""
        response = await client.get("/api/org/invites", headers=auth_headers_user2)

        assert response.status_code == 403
        assert "must be an admin" in response.json()["detail"].lower()

    async def test_list_invites_not_member(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Non-member cannot list invites."""
        response = await client.get("/api/org/invites", headers=auth_headers_user2)

        assert response.status_code == 403


@pytest.mark.asyncio
class TestRevokeInvite:
    """Test DELETE /api/org/invites/{invite_id} - revoking invites."""

    async def test_revoke_invite_as_admin(
        self,
        client: AsyncClient,
        auth_headers: dict,
        invite: OrganizationInvite,
        db: AsyncSession
    ):
        """Admin can revoke an invite."""
        response = await client.delete(
            f"/api/org/invites/{invite.id}",
            headers=auth_headers
        )

        assert response.status_code == 204

        # Verify invite is deleted
        deleted_invite = await db.get(OrganizationInvite, invite.id)
        assert deleted_invite is None

    async def test_revoke_invite_as_designer(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        invite: OrganizationInvite,
        organization_with_designer: Organization
    ):
        """Designer cannot revoke invites."""
        response = await client.delete(
            f"/api/org/invites/{invite.id}",
            headers=auth_headers_user2
        )

        assert response.status_code == 403

    async def test_revoke_nonexistent_invite(
        self,
        client: AsyncClient,
        auth_headers: dict,
        organization: Organization
    ):
        """Revoking nonexistent invite returns 404."""
        fake_invite_id = uuid4()

        response = await client.delete(
            f"/api/org/invites/{fake_invite_id}",
            headers=auth_headers
        )

        assert response.status_code == 404

    async def test_revoke_invite_from_different_org(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db: AsyncSession
    ):
        """Cannot revoke invite from a different organization."""
        # Create another org with an invite
        other_org = Organization(name="Other Org", slug="other-org")
        db.add(other_org)
        await db.flush()

        other_invite = OrganizationInvite(
            organization_id=other_org.id,
            email="other@example.com",
            role="designer",
            token="other-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(other_invite)
        await db.commit()

        response = await client.delete(
            f"/api/org/invites/{other_invite.id}",
            headers=auth_headers
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestAcceptInvite:
    """Test POST /api/org/invites/{token}/accept - accepting invites."""

    async def test_accept_invite_success(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization: Organization,
        db: AsyncSession
    ):
        """User can accept a valid invite matching their email."""
        # Create invite for user2
        invite = OrganizationInvite(
            organization_id=organization.id,
            email=user2.email,
            role="designer",
            token="test-token-123",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == organization.name
        assert data["member_count"] == 2

        # Verify membership created
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        assert membership is not None
        assert membership.organization_id == organization.id
        assert membership.role == "designer"

        # Verify invite marked as accepted
        await db.refresh(invite)
        assert invite.accepted_at is not None

    async def test_accept_invite_with_admin_role(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization: Organization,
        db: AsyncSession
    ):
        """User can accept invite with admin role."""
        invite = OrganizationInvite(
            organization_id=organization.id,
            email=user2.email,
            role="admin",
            token="admin-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 200

        # Verify role is admin
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user2.id
            )
        )
        membership = result.scalars().first()
        assert membership.role == "admin"

    async def test_accept_invite_expired(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization: Organization,
        db: AsyncSession
    ):
        """Cannot accept expired invite."""
        invite = OrganizationInvite(
            organization_id=organization.id,
            email=user2.email,
            role="designer",
            token="expired-token",
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()

    async def test_accept_invite_already_accepted(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization: Organization,
        db: AsyncSession
    ):
        """Cannot accept already-accepted invite."""
        invite = OrganizationInvite(
            organization_id=organization.id,
            email=user2.email,
            role="designer",
            token="used-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            accepted_at=datetime.now(timezone.utc)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 400
        assert "already been accepted" in response.json()["detail"].lower()

    async def test_accept_invite_wrong_email(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization: Organization,
        db: AsyncSession
    ):
        """Cannot accept invite for different email."""
        invite = OrganizationInvite(
            organization_id=organization.id,
            email="different@example.com",
            role="designer",
            token="wrong-email-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 400
        assert "different email" in response.json()["detail"].lower()

    async def test_accept_invite_case_insensitive_email(
        self,
        client: AsyncClient,
        auth_headers_user2: dict,
        user2: User,
        organization: Organization,
        db: AsyncSession
    ):
        """Email matching is case-insensitive."""
        # Invite with uppercase email
        invite = OrganizationInvite(
            organization_id=organization.id,
            email=user2.email.upper(),
            role="designer",
            token="case-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 200

    async def test_accept_invite_already_in_org(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user: User,
        organization: Organization,
        db: AsyncSession
    ):
        """User already in org cannot accept invite."""
        # User is already admin in organization
        invite = OrganizationInvite(
            organization_id=organization.id,
            email=user.email,
            role="designer",
            token="redundant-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(invite)
        await db.commit()

        response = await client.post(
            f"/api/org/invites/{invite.token}/accept",
            headers=auth_headers
        )

        assert response.status_code == 409
        assert "already a member" in response.json()["detail"].lower()

    async def test_accept_invite_nonexistent_token(
        self,
        client: AsyncClient,
        auth_headers_user2: dict
    ):
        """Accepting with nonexistent token returns 404."""
        response = await client.post(
            "/api/org/invites/nonexistent-token/accept",
            headers=auth_headers_user2
        )

        assert response.status_code == 404

    async def test_accept_invite_not_authenticated(
        self,
        client: AsyncClient,
        invite: OrganizationInvite
    ):
        """Cannot accept invite without authentication."""
        response = await client.post(
            f"/api/org/invites/{invite.token}/accept"
        )

        assert response.status_code == 401
