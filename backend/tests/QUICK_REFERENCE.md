# Test Quick Reference

## Setup (First Time)
```bash
cd backend
pip install -r requirements.txt
chmod +x setup_test_db.sh run_tests.sh
./setup_test_db.sh
```

## Run Tests
```bash
# All tests
pytest

# Or use helper script
./run_tests.sh

# Specific file
pytest tests/test_org_crud.py

# Specific class
pytest tests/test_org_crud.py::TestCreateOrganization

# Specific test
pytest tests/test_org_crud.py::TestCreateOrganization::test_create_organization_success

# Verbose
pytest -v

# Stop on first failure
pytest -x

# Show print statements
pytest -s

# Coverage report
pytest --cov=app --cov-report=html
```

## Common Test Scenarios

### Test Organization CRUD
```bash
pytest tests/test_org_crud.py -v
```
18 tests covering create, get, update, delete with permissions

### Test Team Management
```bash
pytest tests/test_org_members.py -v
```
17 tests covering member listing, role changes, removal

### Test Invite System
```bash
pytest tests/test_org_invites.py -v
```
24 tests covering invite lifecycle and edge cases

### Test Trip Integration
```bash
pytest tests/test_org_trips.py -v
```
12 tests covering org-trip linking and admin views

### Test Permissions & Security
```bash
pytest tests/test_org_permissions.py -v
```
20+ tests covering admin/designer boundaries, last admin protection

### Test Infrastructure
```bash
pytest tests/test_sanity.py -v
```
9 tests verifying test setup is correct

## File Organization

```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Fixtures and test config
│   ├── test_sanity.py           # Infrastructure tests
│   ├── test_org_crud.py         # Organization CRUD
│   ├── test_org_members.py      # Team management
│   ├── test_org_invites.py      # Invite system
│   ├── test_org_trips.py        # Trip integration
│   ├── test_org_permissions.py  # Security & permissions
│   ├── README.md                # Detailed docs
│   └── QUICK_REFERENCE.md       # This file
├── pytest.ini                   # Pytest configuration
├── setup_test_db.sh            # Database setup script
├── run_tests.sh                # Test runner script
└── TESTING.md                  # Complete testing guide
```

## Test Database

### Setup
```bash
./setup_test_db.sh
```

### Manual Setup
```bash
docker exec plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"
```

### Reset (if corrupted)
```bash
docker exec plantrip-db-1 psql -U postgres -c "DROP DATABASE IF EXISTS plantrip_test; CREATE DATABASE plantrip_test;"
```

### Connect Manually
```bash
docker exec -it plantrip-db-1 psql -U postgres plantrip_test
```

## Useful Fixtures

```python
# From conftest.py - use as function parameters:

async def test_something(
    client,              # HTTP client
    db,                  # Database session
    user,                # First test user (test@example.com)
    user2,               # Second test user (test2@example.com)
    auth_headers,        # Auth headers for user
    auth_headers_user2,  # Auth headers for user2
    organization,        # Org with user as admin
    organization_with_designer,  # Org with user (admin) + user2 (designer)
    invite,              # Pending invite
    trip,                # Trip for user in org
    trip_user2,          # Trip for user2 in org
):
    # Your test code
    pass
```

## Common Test Patterns

### Test Successful API Call
```python
async def test_feature_success(self, client, auth_headers):
    response = await client.post(
        "/api/endpoint",
        json={"field": "value"},
        headers=auth_headers
    )
    assert response.status_code == 201
    assert response.json()["field"] == "value"
```

### Test Permission Denied
```python
async def test_feature_forbidden(self, client, auth_headers_user2):
    response = await client.post(
        "/api/admin-endpoint",
        headers=auth_headers_user2
    )
    assert response.status_code == 403
```

### Test Validation Error
```python
async def test_invalid_input(self, client, auth_headers):
    response = await client.post(
        "/api/endpoint",
        json={"field": ""},  # Invalid
        headers=auth_headers
    )
    assert response.status_code == 422
```

### Test Database State
```python
async def test_creates_record(self, client, auth_headers, db):
    response = await client.post("/api/endpoint", ...)

    # Verify in database
    from sqlalchemy import select
    result = await db.execute(select(Model).where(...))
    record = result.scalars().first()
    assert record is not None
    assert record.field == expected_value
```

## Debugging Tests

### Run Single Test with Print
```bash
pytest tests/test_file.py::TestClass::test_name -s
```

### Show Full Traceback
```bash
pytest tests/test_file.py --tb=long
```

### Drop into Debugger on Failure
```bash
pytest tests/test_file.py --pdb
```

### Show Locals in Traceback
```bash
pytest tests/test_file.py -l
```

## Environment Variables

```bash
# Required for tests to run
export TESTING=true

# Optional: custom database URL
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test"
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection refused | `docker-compose up -d db` |
| Database doesn't exist | `./setup_test_db.sh` |
| Import errors | `pip install -r requirements.txt` |
| Slow tests | Check PostgreSQL performance |
| Table exists errors | Reset database (see above) |

## Test Coverage

Run with coverage:
```bash
pytest --cov=app --cov-report=term --cov-report=html
```

View HTML report:
```bash
open htmlcov/index.html
```

Coverage by module:
```bash
pytest --cov=app.routers.org --cov-report=term-missing
```

## CI/CD

Tests are designed to run in CI:
- Automatic database setup
- Clean state before each test
- Fast execution (~10-20s)
- No external dependencies (except PostgreSQL)

## Getting Help

- See `README.md` for detailed setup instructions
- See `TESTING.md` for complete testing guide
- See `conftest.py` for available fixtures
- See individual test files for examples
