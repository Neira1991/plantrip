# Backend Integration Tests - Complete Guide

Comprehensive integration test suite for the PlanTrip organization management system.

## Overview

This test suite provides full coverage of the organization management features:
- Organization CRUD (create, read, update, delete)
- Team management (members, roles, permissions)
- Invite system (create, list, revoke, accept)
- Trip integration (auto-assignment to org, admin views)
- Permission enforcement (admin vs designer roles)
- Security (last admin protection, cross-org access prevention)

## Quick Start

```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt

# 2. Ensure database is running
docker-compose up -d db

# 3. Create test database (one-time setup)
docker exec plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"

# 4. Run tests
chmod +x run_tests.sh
./run_tests.sh

# Or use pytest directly
export TESTING=true
pytest
```

## Test Files

### Core Organization Tests
- **test_org_crud.py** (18 tests)
  - Create organization with slug generation and uniqueness
  - Get organization with member count
  - Update organization name (admin only)
  - Delete organization with cascades

- **test_org_members.py** (17 tests)
  - List members with trip counts
  - Change member roles (promote/demote)
  - Remove members (admin removes others, self-leave)
  - Last admin protection

- **test_org_invites.py** (24 tests)
  - Create invites (admin only, email validation)
  - List pending invites (excludes expired/accepted)
  - Revoke invites
  - Accept invites (email matching, expiration, validation)

- **test_org_trips.py** (12 tests)
  - Trip auto-assignment to organization
  - Admin view of all org trips
  - Organization stats (trips, members, breakdowns)
  - /api/auth/me includes org info

### Security & Permissions
- **test_org_permissions.py** (20+ tests)
  - Permission boundaries (admin vs designer)
  - Last admin protection scenarios
  - Cross-organization access prevention
  - Authentication requirements
  - Input validation
  - Cascade delete verification

### Infrastructure
- **test_sanity.py** (9 tests)
  - Database connection
  - HTTP client setup
  - Fixtures working correctly
  - Test isolation

## Test Coverage Summary

### Organization CRUD ✅
- [x] Create organization (success, already in org → 409)
- [x] Slug generation (unique, special chars, fallback)
- [x] Get organization (member success, non-member → 403)
- [x] Update organization (admin success, designer → 403)
- [x] Delete organization (admin success, designer → 403)
- [x] Cascade deletes (members, invites, trips set to NULL)

### Team Management ✅
- [x] List members with trip counts (ordered by join date)
- [x] Promote designer to admin
- [x] Demote admin to designer (if not last admin)
- [x] Last admin cannot be demoted
- [x] Admin removes designer
- [x] Member leaves (self-remove)
- [x] Last admin cannot leave
- [x] Designer cannot change roles

### Invite System ✅
- [x] Create invite (admin success, designer → 403)
- [x] Email normalization and validation
- [x] Duplicate email check (case-insensitive)
- [x] List pending invites (excludes expired/accepted)
- [x] Revoke invite (admin only)
- [x] Accept invite (valid token, correct email)
- [x] Expired token → 400
- [x] Wrong email → 400
- [x] Already accepted → 400
- [x] Already in org → 409

### Trip Integration ✅
- [x] New trip auto-gets organization_id
- [x] Trip without org has null organization_id
- [x] GET /api/org/trips (admin sees all)
- [x] GET /api/auth/me includes org info
- [x] Organization stats (trips, members, status breakdown)

### Permission Edge Cases ✅
- [x] Non-member → 403 on all org endpoints
- [x] Designer → 403 on admin-only endpoints
- [x] Last admin protection (demote, remove)
- [x] Cross-organization access prevention
- [x] All endpoints require authentication

## Running Tests

### All tests
```bash
pytest
# or
./run_tests.sh
```

### Specific test file
```bash
pytest tests/test_org_crud.py
```

### Specific test class
```bash
pytest tests/test_org_crud.py::TestCreateOrganization
```

### Specific test
```bash
pytest tests/test_org_crud.py::TestCreateOrganization::test_create_organization_success
```

### With verbose output
```bash
pytest -v
```

### With coverage report
```bash
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

### Run only sanity tests
```bash
pytest tests/test_sanity.py
```

## Test Architecture

### Fixtures (conftest.py)
- **Database**: `db` - Direct database session for setup/assertions
- **HTTP Client**: `client` - Async HTTP client for API calls
- **Users**: `user`, `user2`, `user3` - Test users with emails
- **Auth**: `auth_headers`, `auth_headers_user2`, `auth_headers_user3` - JWT cookies
- **Organization**: `organization` - Org with user as admin
- **Organization+Designer**: `organization_with_designer` - Org with user (admin) + user2 (designer)
- **Invite**: `invite` - Pending invite for organization
- **Trips**: `trip`, `trip_user2` - Test trips in organization

### Test Isolation
- Tables created once per session
- Tables truncated before each test
- Tests can run in any order
- No test pollution between runs

### Test Structure
```python
@pytest.mark.asyncio
class TestFeature:
    """Test a specific feature area."""

    async def test_success_case(self, client, auth_headers, ...):
        """Test the happy path."""
        # Arrange
        # ... setup data

        # Act
        response = await client.post("/api/endpoint", ...)

        # Assert
        assert response.status_code == 200
        assert response.json()["field"] == expected_value

    async def test_error_case(self, client, auth_headers, ...):
        """Test error handling."""
        # ...
```

## Environment Variables

- `TESTING=true` - Disables rate limiting, allows insecure JWT secret
- `TEST_DATABASE_URL` - PostgreSQL connection string (default: localhost)

## Database Setup

### Using Docker (Recommended)
```bash
# Start PostgreSQL via Docker Compose
docker-compose up -d db

# Create test database
docker exec plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"
```

### Using Local PostgreSQL
```bash
createdb plantrip_test

# Set connection string if different from default
export TEST_DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/plantrip_test"
```

### Verify Database
```bash
# Connect to test database
psql -U postgres plantrip_test

# Or via Docker
docker exec -it plantrip-db-1 psql -U postgres plantrip_test
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Create test database
        env:
          PGPASSWORD: postgres
        run: |
          psql -h localhost -U postgres -c "CREATE DATABASE plantrip_test;"

      - name: Run tests
        env:
          TESTING: true
          TEST_DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test
        run: |
          cd backend
          pytest -v
```

## Troubleshooting

### "Connection refused" errors
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL matches your setup
- Verify port 5432 is not blocked

### "Database does not exist"
```bash
docker exec plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"
```

### Import errors
- Run from `backend` directory
- Ensure all dependencies installed: `pip install -r requirements.txt`

### Tests fail with "JWT secret" error
- Set `export TESTING=true`
- This is automatically set by conftest.py

### Slow tests
- Tests use database truncation, which is fast
- If slow, check PostgreSQL performance
- Consider using in-memory SQLite for unit tests (not these integration tests)

### "Table already exists" errors
- Clean DB manually: `docker exec plantrip-db-1 psql -U postgres plantrip_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
- Or drop and recreate DB: `docker exec plantrip-db-1 psql -U postgres -c "DROP DATABASE plantrip_test; CREATE DATABASE plantrip_test;"`

## Test Statistics

- **Total Tests**: 100+
- **Test Files**: 6
- **Coverage Areas**: 8 (CRUD, members, invites, trips, permissions, auth, validation, security)
- **Fixtures**: 15+
- **Average Runtime**: ~10-20 seconds (depends on DB)

## Next Steps

### Adding New Tests
1. Add test to appropriate file or create new `test_*.py` file
2. Use existing fixtures from `conftest.py`
3. Follow arrange/act/assert structure
4. Use descriptive test names: `test_<action>_<scenario>`
5. Run tests: `pytest tests/test_yourfile.py`

### Adding New Fixtures
1. Add to `conftest.py`
2. Use `@pytest.fixture` decorator
3. Use `async def` for async fixtures
4. Leverage existing fixtures as dependencies
5. Document with docstring

### Coverage Gaps
If you need to add tests for:
- Rate limiting (requires TESTING=false)
- Concurrent operations (race conditions)
- Database transaction rollbacks
- Error recovery scenarios

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [HTTPX Documentation](https://www.python-httpx.org/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
