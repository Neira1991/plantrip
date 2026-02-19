# Backend Integration Tests

Comprehensive integration tests for the PlanTrip organization management system.

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set up test database

The tests use a separate PostgreSQL database to avoid interfering with development data.

**Option A: Using Docker Compose (Recommended)**
```bash
# From project root
docker-compose up -d db

# Create test database
docker exec -it plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"
```

**Option B: Local PostgreSQL**
```bash
createdb plantrip_test
```

### 3. Configure test database URL

Set the `TEST_DATABASE_URL` environment variable (optional, defaults to localhost):

```bash
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test"
```

## Running Tests

### Run all tests
```bash
pytest
```

### Run specific test file
```bash
pytest tests/test_org_crud.py
```

### Run specific test class
```bash
pytest tests/test_org_crud.py::TestCreateOrganization
```

### Run specific test
```bash
pytest tests/test_org_crud.py::TestCreateOrganization::test_create_organization_success
```

### Run with verbose output
```bash
pytest -v
```

### Run with coverage
```bash
pytest --cov=app --cov-report=html
```

## Test Structure

### Test Files
- `test_org_crud.py` - Organization CRUD operations (create, get, update, delete)
- `test_org_members.py` - Team management (list, change roles, remove members)
- `test_org_invites.py` - Invite system (create, list, revoke, accept invites)
- `test_org_trips.py` - Trip integration and admin views (org trips, stats, /me endpoint)

### Fixtures (conftest.py)
- `client` - Async HTTP client for API testing
- `db` - Database session for direct DB operations
- `user`, `user2`, `user3` - Test users
- `auth_headers*` - Authentication headers with JWT tokens
- `organization` - Test organization with user as admin
- `organization_with_designer` - Organization with user as admin and user2 as designer
- `invite` - Pending invite
- `trip`, `trip_user2` - Test trips

## Test Coverage

### Organization CRUD
- ✅ Create organization (success, already in org)
- ✅ Get organization (member sees it, non-member forbidden)
- ✅ Update organization name (admin success, designer forbidden)
- ✅ Delete organization (admin success, designer forbidden)
- ✅ Slug generation and uniqueness

### Team Management
- ✅ List members with trip counts
- ✅ Change member role (promote, demote, last admin protection)
- ✅ Remove member (admin removes designer, self-leave, last admin protection)
- ✅ Permission checks (admin vs designer)

### Invite System
- ✅ Create invite (admin success, designer forbidden, duplicate email)
- ✅ List pending invites (admin only, excludes expired/accepted)
- ✅ Revoke invite
- ✅ Accept invite (valid token, expired, wrong email, already in org)
- ✅ Email normalization and case-insensitive matching

### Trip Integration
- ✅ New trip auto-gets organization_id when user is in org
- ✅ Admin sees all org trips via GET /api/org/trips
- ✅ GET /api/auth/me returns org info with role
- ✅ Organization stats (trips, members, trips by designer, trips by status)

### Permission Edge Cases
- ✅ Non-member accessing any org endpoint → 403
- ✅ Designer accessing admin-only endpoints → 403
- ✅ Last admin cannot be demoted
- ✅ Last admin cannot leave/be removed

## Test Database

The tests use a clean database for each test run:
- All tables are created at session start
- All tables are truncated before each test
- All tables are dropped at session end

This ensures:
- Tests are isolated and don't interfere with each other
- Tests can run in any order
- No test pollution between runs

## Environment Variables

- `TESTING=true` - Automatically set by tests to disable rate limiting
- `TEST_DATABASE_URL` - PostgreSQL connection string for test database (optional)

## Troubleshooting

### Database connection errors
- Ensure PostgreSQL is running
- Check the `TEST_DATABASE_URL` matches your PostgreSQL setup
- Verify the test database exists: `psql -U postgres -c "\l"`

### Import errors
- Ensure you're running from the `backend` directory
- Install all dependencies: `pip install -r requirements.txt`

### Async warnings
- These are expected and can be ignored
- They're filtered in `pytest.ini`

## CI/CD Integration

For CI environments (GitHub Actions, etc.):

```yaml
- name: Set up PostgreSQL
  run: |
    docker run -d -p 5432:5432 \
      -e POSTGRES_PASSWORD=postgres \
      postgres:16

- name: Create test database
  run: |
    PGPASSWORD=postgres psql -h localhost -U postgres \
      -c "CREATE DATABASE plantrip_test;"

- name: Run tests
  env:
    TESTING: true
    TEST_DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test
  run: pytest
```
