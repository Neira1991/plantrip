# Alembic Database Migrations

This directory contains Alembic database migrations for the PlanTrip backend.

## Setup

Alembic is configured to use the async PostgreSQL engine via asyncpg. The configuration:

- `alembic.ini`: Main Alembic configuration (sqlalchemy.url is overridden in env.py)
- `env.py`: Migration environment setup with async support
- `versions/`: Migration scripts directory

## Common Commands

### Create a new migration

Auto-generate a migration from model changes:
```bash
cd backend
alembic revision --autogenerate -m "description of changes"
```

Create an empty migration (for data migrations or custom changes):
```bash
cd backend
alembic revision -m "description of changes"
```

### Apply migrations

Upgrade to the latest version:
```bash
cd backend
alembic upgrade head
```

Upgrade to a specific revision:
```bash
cd backend
alembic upgrade <revision_id>
```

### Rollback migrations

Downgrade one revision:
```bash
cd backend
alembic downgrade -1
```

Downgrade to a specific revision:
```bash
cd backend
alembic downgrade <revision_id>
```

### View migration history

Show current revision:
```bash
cd backend
alembic current
```

Show migration history:
```bash
cd backend
alembic history
```

## Migration Best Practices

1. **Always review auto-generated migrations** - Alembic's autogenerate is helpful but not perfect
2. **Test both upgrade and downgrade** - Ensure rollbacks work correctly
3. **Use server_default for timestamps** - Use `func.now()` via `server_default=sa.text('now()')`
4. **Handle data migrations separately** - For complex data changes, create a separate migration
5. **Use batch operations for large tables** - Consider performance impact on production data
6. **Version control** - Always commit migration files to git

## Current Migrations

- `001_add_organization_system.py`: Initial migration adding organization, organization_members, organization_invites tables and organization_id to trips

## Architecture Notes

### Async Support

The migrations use SQLAlchemy's async engine via `async_engine_from_config`. The `env.py` file contains:

- `run_migrations_online()`: Async migration runner using `asyncio.run()`
- `run_async_migrations()`: Creates async engine and runs migrations in sync context
- `do_run_migrations()`: Actual migration execution in sync context

This pattern is necessary because:
1. The backend uses asyncpg for async PostgreSQL connections
2. Alembic's migration operations are synchronous
3. We bridge async/sync using `connection.run_sync()`

### Database URL Configuration

The database URL is pulled from `app.config.settings.DATABASE_URL` rather than `alembic.ini`:

```python
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
```

This ensures:
- Migrations use the same connection string as the application
- Environment variables (`.env` file) control the database connection
- No need to maintain database URLs in multiple places

## Future Migrations

When the schema changes:

1. Update the SQLAlchemy models in `app/models.py`
2. Generate a migration: `alembic revision --autogenerate -m "description"`
3. Review and edit the generated migration file
4. Test the migration: `alembic upgrade head` (on dev database)
5. Test the rollback: `alembic downgrade -1`
6. Commit the migration file to version control

## Production Deployment

In production:

1. **DO NOT** rely on `Base.metadata.create_all()` in `app/database.py`
2. Run migrations as part of deployment: `alembic upgrade head`
3. Consider running migrations in a separate deployment step before app deployment
4. Monitor migration execution time for large tables
5. Have a rollback plan for each migration

## Troubleshooting

### "Target database is not up to date"

This means migrations have been applied that aren't in your current codebase. Pull latest code and check `alembic history`.

### "Can't locate revision identified by 'xyz'"

The migration file is missing. Check git history or restore from version control.

### "Multiple head revisions are present"

You have divergent migration branches. This can happen when multiple developers create migrations simultaneously. Resolve by creating a merge migration:
```bash
alembic merge heads -m "merge divergent migrations"
```

### Connection errors

Ensure:
- PostgreSQL is running
- `DATABASE_URL` in `.env` is correct
- Database exists: `createdb plantrip`
- User has necessary permissions
