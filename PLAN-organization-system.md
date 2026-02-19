# Organization Management System - Implementation Plan

## Context

PlanTrip is a luxury travel planning app used by travel agencies and MDCs. Currently, users operate independently — each user owns their trips with no team structure. We need a multi-tenant organization system where agencies can manage teams of travel designers, control permissions, and have visibility across all trips.

---

## Current Architecture Summary

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite, Zustand, React Router v6 |
| Backend | FastAPI (async), SQLAlchemy 2.x, PostgreSQL, asyncpg |
| Auth | JWT via HTTP-only cookies (access + refresh tokens) |
| DB Migrations | None (auto `create_all` at startup) |

**Key limitation:** No Alembic. Schema changes on existing DBs require manual migration or adding Alembic now.

---

## Phase 1: Database Schema (data-engineer)

### New Tables

#### `organizations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String(200) | Org display name |
| slug | String(100) | URL-friendly unique identifier |
| created_at | DateTime(tz) | Auto |
| updated_at | DateTime(tz) | Auto |

#### `organization_members`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK -> organizations.id |
| user_id | UUID | FK -> users.id |
| role | String(20) | `"admin"` or `"designer"` |
| created_at | DateTime(tz) | Auto |

**Constraints:** UNIQUE(organization_id, user_id)

#### `organization_invites`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK -> organizations.id |
| email | String(320) | Invited email |
| role | String(20) | Role to assign on accept |
| token | String(64) | Unique invite token |
| expires_at | DateTime(tz) | 7 days from creation |
| accepted_at | DateTime(tz) | Nullable, set when accepted |
| created_at | DateTime(tz) | Auto |

### Modified Tables

#### `trips` — add column
| Column | Type | Notes |
|--------|------|-------|
| organization_id | UUID, nullable | FK -> organizations.id, nullable for backward compat |

Trips created by org members automatically get `organization_id` set. Existing trips remain with `organization_id = NULL`.

### Setup Alembic

Before any schema changes, introduce Alembic for proper migration management:
- `alembic init` in the backend directory
- Generate initial migration from current models
- All subsequent changes via migrations
- Update startup to run `alembic upgrade head` instead of `create_all`

---

## Phase 2: Backend API (backend-engineer)

### New Router: `/api/org`

#### Organization CRUD
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/org` | Yes | Any | Create organization (creator becomes admin) |
| GET | `/api/org` | Yes | Member | Get current user's organization |
| PUT | `/api/org` | Yes | Admin | Update org name/slug |
| DELETE | `/api/org` | Yes | Admin | Delete organization (removes all memberships) |

#### Team Management
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/org/members` | Yes | Member | List all members with trip counts |
| PUT | `/api/org/members/{user_id}/role` | Yes | Admin | Change member role |
| DELETE | `/api/org/members/{user_id}` | Yes | Admin | Remove member from org |
| POST | `/api/org/invites` | Yes | Admin | Send invite (by email + role) |
| GET | `/api/org/invites` | Yes | Admin | List pending invites |
| DELETE | `/api/org/invites/{invite_id}` | Yes | Admin | Revoke invite |
| POST | `/api/org/invites/{token}/accept` | Yes | Any | Accept invite (logged-in user joins org) |

#### Organization Trips (admin visibility)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/org/trips` | Yes | Admin | List ALL trips in the org (with designer name) |

#### Dashboard Stats
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/org/stats` | Yes | Admin | Org-level stats (total trips, trips per designer, trips by status) |

### Permission Dependency

New FastAPI dependency functions:

```python
async def get_org_membership(user, db) -> OrganizationMember | None
async def require_org_admin(user, db) -> OrganizationMember  # raises 403
async def require_org_member(user, db) -> OrganizationMember  # raises 403
```

### Modified Endpoints

- **`POST /api/trips`** — if user belongs to an org, auto-set `organization_id`
- **`GET /api/trips`** — no change (designers still see only their own trips)
- **`GET /api/auth/me`** — include org info in response: `{ ...user, organization: { id, name, slug, role } | null }`

---

## Phase 3: Security (security-engineer)

### Authorization Rules

| Action | Admin | Designer |
|--------|-------|----------|
| View org settings | Yes | Yes (read-only) |
| Edit org name/settings | Yes | No |
| Invite members | Yes | No |
| Remove members | Yes | No |
| Change roles | Yes | No |
| View all org trips | Yes | No |
| View own trips | Yes | Yes |
| Create trips | Yes | Yes |
| Delete org | Yes | No |

### Security Considerations

- **Admin cannot remove themselves** if they're the last admin (prevent orphaned orgs)
- **Rate limit invites** to 10/hour per org to prevent spam
- **Invite tokens** must be cryptographically random (`secrets.token_urlsafe(32)`)
- **Org slug** must be validated (alphanumeric + hyphens only, 3-50 chars)
- **Row-level access:** Every org endpoint must verify the user belongs to that org
- **Trip isolation:** Designers in the same org cannot see each other's trip details unless admin
- **Invite email** must be case-insensitive (normalize to lowercase)

---

## Phase 4: Frontend — Organization Page (frontend-engineer + ux-designer)

### New Route

```
/organization → OrganizationPage.jsx
```

Add to `App.jsx` router as a protected route.

### Page Layout (designed by ux-designer)

The page has 3 sections:

#### 1. Org Header
- Organization name (editable by admin)
- Member count badge
- "Leave organization" for non-admins / "Delete" for admin

#### 2. Team Members Table
| Column | Description |
|--------|-------------|
| Name/Email | Member identity |
| Role | Badge: "Admin" or "Designer" |
| Trips Created | Count of trips |
| Joined | Date joined |
| Actions | Change role / Remove (admin only) |

With an "Invite Member" button that opens an invite form (email + role picker).

#### 3. All Trips Overview (admin only)
A table/list of all trips across the org:
| Column | Description |
|--------|-------------|
| Trip Name | Link to trip |
| Country | Country code/flag |
| Designer | Who created it |
| Status | Planning/Booked/Completed |
| Created | Date |

### New Frontend Files

```
src/pages/Organization.jsx        — Main page component
src/pages/Organization.css         — Styles
src/stores/orgStore.js             — Zustand store for org state
src/components/InviteMemberModal.jsx — Invite form overlay
```

### Navigation Changes

- Add org icon/link in the Home page header (next to the trips trigger)
- Show org badge on the user's profile area
- If user has no org, show a "Create Organization" CTA

### State Management (new Zustand store)

```javascript
// orgStore.js
{
  organization: null,     // { id, name, slug, role }
  members: [],            // [{ id, email, role, tripCount, createdAt }]
  invites: [],            // [{ id, email, role, expiresAt }]
  orgTrips: [],           // admin only: all org trips
  stats: null,            // { totalTrips, tripsByDesigner, tripsByStatus }
  isLoading: false,

  loadOrganization(),
  createOrganization(name),
  updateOrganization(data),
  loadMembers(),
  inviteMember(email, role),
  removeMember(userId),
  updateMemberRole(userId, role),
  loadOrgTrips(),
  loadStats(),
}
```

### Auth Store Changes

Update `authStore.js` to include org data in the user object:
- After login/register, fetch org info
- `GET /api/auth/me` now returns org context
- Store `user.organization` in auth state

---

## Phase 5: UX Design (ux-designer)

### Design Decisions Needed

1. **Organization page layout** — sidebar nav vs tab sections vs single scroll page
2. **Empty state** — when user has no org: show create/join CTA centered on page
3. **Invite flow** — inline form vs modal vs separate page
4. **Admin trip view** — table vs card grid vs list (matching existing trip card style)
5. **Role badges** — color coding for admin vs designer
6. **Mobile responsiveness** — how the team table collapses on small screens
7. **Navigation entry point** — where does the org link go? (header icon, sidebar, user menu)

### Design System Consistency

Follow existing patterns:
- Dark theme: `#0f0f0f` bg, `#2a2a2a` borders
- Accent gradient: `#667eea` -> `#764ba2`
- Cards: `border-radius: 16px`, `border: 1px solid #2a2a2a`
- Overlays: `rgba(0,0,0,0.7)` + `backdrop-filter: blur(4px)`
- Buttons: `.btn-save` (gradient), `.btn-cancel` (neutral)

---

## Phase 6: Testing (qa-engineer)

### Backend Tests

- **Unit tests** for permission dependencies (admin vs designer vs non-member)
- **Integration tests** for full org lifecycle: create -> invite -> accept -> manage -> delete
- **Edge cases:**
  - Last admin cannot leave
  - Expired invites are rejected
  - Duplicate invite to same email
  - Non-member accessing org endpoints → 403
  - Designer accessing admin-only endpoints → 403
  - Deleted user's trips still visible to admin

### Frontend Tests (Playwright)

- Create organization flow
- Invite member flow
- Admin sees all trips, designer sees only theirs
- Role change reflects immediately
- Member removal flow
- Navigation to/from org page
- Mobile responsive layout

---

## Phase 7: DevOps (devops-engineer)

### Migration Strategy

- Introduce Alembic to the backend
- Write migration for new tables + `trips.organization_id` column
- Ensure migration is backward-compatible (all new columns nullable)
- Add migration step to Docker entrypoint / startup

### Environment Changes

- No new env vars required initially
- Consider `MAX_ORG_MEMBERS` config for future scaling
- Consider email service integration for invite notifications (future)

---

## Implementation Order

```
Step 1: [data-engineer]      Set up Alembic + write migrations for new tables
Step 2: [backend-engineer]   Implement models + org API endpoints
Step 3: [security-engineer]  Review + harden permission layer
Step 4: [ux-designer]        Design org page wireframes and flows
Step 5: [frontend-engineer]  Build org store + page + components
Step 6: [qa-engineer]        Write and run tests
Step 7: [devops-engineer]    Update Docker + deployment pipeline
```

Steps 1-3 can run in sequence (backend-first).
Steps 4-5 can overlap (design informs frontend).
Steps 6-7 run after implementation is complete.

---

## Open Questions

1. **Can a user belong to multiple organizations?** (Current plan: No, 1 user = 1 org max)
2. **Should we send real emails for invites?** (Current plan: No, use invite links/tokens only)
3. **Should designers see other designers' names?** (Current plan: No, only admins see the full team)
4. **Should there be an "owner" role above admin?** (Current plan: No, admin is the highest role, first admin is the creator)
5. **What happens to trips if a designer is removed from the org?** (Proposed: trips stay in org, reassignable by admin)
