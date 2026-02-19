# Alembic Migration Setup - Next Steps

Alembic has been configured for the PlanTrip backend. Here's what to do next:

## 1. Install Dependencies

```bash
cd /Users/steven/Dev/SideProjects/plantrip/backend
pip install -r requirements.txt
```

This will install the `alembic` package that was added to requirements.txt.

## 2. Verify Configuration

The following files have been created:

- `/Users/steven/Dev/SideProjects/plantrip/backend/alembic.ini` - Main Alembic config
- `/Users/steven/Dev/SideProjects/plantrip/backend/alembic/env.py` - Async migration environment
- `/Users/steven/Dev/SideProjects/plantrip/backend/alembic/script.py.mako` - Migration template
- `/Users/steven/Dev/SideProjects/plantrip/backend/alembic/versions/001_add_organization_system.py` - Initial migration

## 3. Apply the Initial Migration

If you have an existing database with tables, you need to stamp it as already having the base schema:

```bash
cd /Users/steven/Dev/SideProjects/plantrip/backend

# Check current migration status
alembic current

# If you have existing tables, stamp the database (skip the migration execution)
# alembic stamp head

# OR if this is a fresh database, run the migration
alembic upgrade head
```

## 4. Verify Migration

```bash
cd /Users/steven/Dev/SideProjects/plantrip/backend

# Check that migration was applied
alembic current

# You should see: 001 (head)
```

## 5. Test the Organization Models

Start your FastAPI server and verify the new models work:

```bash
cd /Users/steven/Dev/SideProjects/plantrip/backend
uvicorn app.main:app --reload
```

The server should start without errors. The new organization tables will be created automatically by `create_tables()` on startup (which still runs for development convenience).

## What Changed

### New Models Added

1. **Organization** (`organizations` table):
   - id, name, slug, created_at, updated_at
   - Used for team/agency workspaces

2. **OrganizationMember** (`organization_members` table):
   - Links users to organizations with roles (admin/designer)
   - Unique constraint on (organization_id, user_id)

3. **OrganizationInvite** (`organization_invites` table):
   - Invite tokens for adding users to organizations
   - Tracks expiration and acceptance

### Modified Models

1. **Trip**:
   - Added `organization_id` (nullable, SET NULL on delete)
   - Trips can now belong to an organization

2. **User**:
   - Added `organization_memberships` relationship

### Migration Details

The migration (`001_add_organization_system.py`) creates:
- Three new tables with proper indexes and constraints
- Foreign key from trips.organization_id to organizations.id
- Proper cascade delete behavior

## Future Workflow

When you make schema changes:

```bash
# 1. Update models in app/models.py

# 2. Generate migration
alembic revision --autogenerate -m "description of change"

# 3. Review the generated migration file in alembic/versions/

# 4. Apply migration
alembic upgrade head

# 5. If needed, rollback
alembic downgrade -1
```

## Cascade Delete Behavior

- Organization deleted → Members deleted, Invites deleted, Trips.organization_id set to NULL
- User deleted → OrganizationMembers deleted (cascade)
- No trip data is lost when organizations are deleted

## Database Schema Summary

### organizations
- Primary key: id (UUID)
- Unique: slug
- Timestamps: created_at, updated_at (server-side defaults)

### organization_members
- Primary key: id (UUID)
- Foreign keys: organization_id (CASCADE), user_id (CASCADE)
- Unique: (organization_id, user_id)
- Default role: "designer"

### organization_invites
- Primary key: id (UUID)
- Foreign key: organization_id (CASCADE)
- Unique + Indexed: token
- Nullable: accepted_at (NULL = pending)

### trips (modified)
- New column: organization_id (UUID, nullable, SET NULL on org delete)

## Troubleshooting

### "Table already exists" error
If you run into this, your database already has tables created by `Base.metadata.create_all()`. You need to stamp the current version:

```bash
alembic stamp head
```

### Migration conflicts
If you have local changes and someone else created a migration, you may need to merge:

```bash
alembic merge heads -m "merge migrations"
```

### Reset everything (DESTRUCTIVE)
Only in development:

```bash
# Drop all tables in psql or:
# dropdb plantrip && createdb plantrip

# Then run migrations from scratch:
alembic upgrade head
```

## References

- Alembic docs: https://alembic.sqlalchemy.org/
- SQLAlchemy async: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- Migration README: `/Users/steven/Dev/SideProjects/plantrip/backend/alembic/README.md`
