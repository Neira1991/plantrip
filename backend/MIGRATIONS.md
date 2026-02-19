# Alembic Database Migrations Guide

This document explains how to work with Alembic migrations in the PlanTrip backend.

## Overview

The Docker setup automatically runs `alembic upgrade head` before starting the backend service. This ensures your database schema is always up-to-date when the container starts.

## Automatic Migration on Startup

When you run `docker-compose up`, the following happens:

1. PostgreSQL starts and waits until healthy
2. Backend container starts and runs `entrypoint.sh`
3. Entrypoint script waits for PostgreSQL to be ready
4. Entrypoint script runs `alembic upgrade head`
5. Uvicorn server starts

## Creating New Migrations

### Auto-generate migration from model changes

```bash
# Inside the backend container
docker-compose exec backend alembic revision --autogenerate -m "description of changes"

# Or locally (if you have the same Python environment)
cd /Users/steven/Dev/SideProjects/plantrip/backend
alembic revision --autogenerate -m "description of changes"
```

### Create empty migration file

```bash
docker-compose exec backend alembic revision -m "description of changes"
```

## Running Migrations

### Upgrade to latest

```bash
# Automatically done on container startup, or manually:
docker-compose exec backend alembic upgrade head
```

### Upgrade by one version

```bash
docker-compose exec backend alembic upgrade +1
```

### Downgrade by one version

```bash
docker-compose exec backend alembic downgrade -1
```

### View current version

```bash
docker-compose exec backend alembic current
```

### View migration history

```bash
docker-compose exec backend alembic history --verbose
```

## Development Workflow

### 1. Modify your SQLAlchemy models

Edit files in `/Users/steven/Dev/SideProjects/plantrip/backend/app/models/`

### 2. Generate migration

```bash
docker-compose exec backend alembic revision --autogenerate -m "add user preferences table"
```

### 3. Review the generated migration

Check the new file in `/Users/steven/Dev/SideProjects/plantrip/backend/alembic/versions/`

### 4. Test the migration

```bash
# Apply migration
docker-compose exec backend alembic upgrade head

# If issues, rollback
docker-compose exec backend alembic downgrade -1
```

### 5. Commit the migration file

```bash
git add backend/alembic/versions/xxxx_description.py
git commit -m "Add migration for user preferences"
```

## Troubleshooting

### Migration fails on startup

If a migration fails, the container will exit. Check logs:

```bash
docker-compose logs backend
```

### Reset database (development only)

```bash
# Stop containers
docker-compose down

# Remove database volume
docker volume rm plantrip_postgres_data

# Restart (will run all migrations from scratch)
docker-compose up
```

### Skip migrations temporarily (not recommended)

If you need to start the backend without running migrations:

```bash
# Override entrypoint
docker-compose run --rm --entrypoint bash backend
# Then manually start uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Connection issues

If `pg_isready` is not working, verify:

1. `DATABASE_URL` environment variable is set correctly
2. PostgreSQL service is healthy: `docker-compose ps`
3. Network connectivity: `docker-compose exec backend ping db`

## Environment Variables

The migration system uses:

- `DATABASE_URL`: PostgreSQL connection string (set in `.env`)
  - Format: `postgresql+asyncpg://user:password@host:port/database`
  - Example: `postgresql+asyncpg://plantrip:secret@db:5432/plantrip_db`

## File Structure

```
backend/
├── alembic/
│   ├── versions/          # Migration files (auto-generated)
│   ├── env.py            # Alembic environment config
│   ├── script.py.mako    # Template for new migrations
│   └── README.md         # Alembic auto-generated docs
├── alembic.ini           # Alembic configuration
├── entrypoint.sh         # Startup script (runs migrations)
└── app/
    └── models/           # SQLAlchemy models
```

## Security Considerations

- Never commit database credentials to version control
- Use environment variables for `DATABASE_URL`
- In production, consider running migrations as a separate job/container
- Always test migrations on staging before production
- Keep migration rollback scripts tested and ready

## Production Deployment

For zero-downtime deployments:

1. **Backward-compatible migrations**: New migrations should work with old code
2. **Two-phase deployment**:
   - Phase 1: Deploy migration (backward compatible with old code)
   - Phase 2: Deploy new code
3. **Separate migration job**: Run migrations in a separate container/job before deploying new code
4. **Database backups**: Always backup before running migrations in production

Example separate migration job:

```yaml
# In docker-compose.prod.yml or CI/CD pipeline
migration:
  build: ./backend
  command: alembic upgrade head
  environment:
    DATABASE_URL: ${DATABASE_URL}
  depends_on:
    db:
      condition: service_healthy
```

## Rollback Strategy

1. Identify the target revision: `alembic history`
2. Downgrade: `alembic downgrade <revision_id>`
3. If downgrade fails, restore from database backup
4. Always test downgrades in staging first

## Common Patterns

### Adding a nullable column (safe)

```python
def upgrade():
    op.add_column('users', sa.Column('bio', sa.String(), nullable=True))
```

### Adding a non-nullable column (requires default)

```python
def upgrade():
    # Add column with default
    op.add_column('users', sa.Column('status', sa.String(), nullable=False, server_default='active'))
    # Optionally remove server default after backfill
    op.alter_column('users', 'status', server_default=None)
```

### Renaming a column (two-phase)

```python
# Phase 1: Add new column, copy data
def upgrade():
    op.add_column('users', sa.Column('full_name', sa.String()))
    op.execute("UPDATE users SET full_name = name")

# Phase 2 (separate migration after code update): Drop old column
def upgrade():
    op.drop_column('users', 'name')
```
