#!/bin/bash
# Alembic migration helper script
# Usage: ./migrate.sh [command]

set -e

cd "$(dirname "$0")"

case "$1" in
  "upgrade")
    echo "Upgrading database to latest version..."
    alembic upgrade head
    ;;

  "downgrade")
    echo "Downgrading database by 1 revision..."
    alembic downgrade -1
    ;;

  "current")
    echo "Current database revision:"
    alembic current
    ;;

  "history")
    echo "Migration history:"
    alembic history --verbose
    ;;

  "new")
    if [ -z "$2" ]; then
      echo "Error: Migration description required"
      echo "Usage: ./migrate.sh new \"description of changes\""
      exit 1
    fi
    echo "Creating new migration: $2"
    alembic revision --autogenerate -m "$2"
    ;;

  "stamp")
    echo "Stamping database as current version (no migration execution)..."
    alembic stamp head
    ;;

  "reset")
    echo "WARNING: This will drop all tables and re-run migrations from scratch!"
    echo "Press Ctrl+C to cancel, or Enter to continue..."
    read

    # Drop all tables using SQLAlchemy
    python -c "
import asyncio
from app.database import engine
from app.models import Base

async def drop_all():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print('All tables dropped')

asyncio.run(drop_all())
"

    echo "Running migrations from scratch..."
    alembic upgrade head
    echo "Database reset complete!"
    ;;

  *)
    echo "Alembic Migration Helper"
    echo ""
    echo "Usage: ./migrate.sh [command]"
    echo ""
    echo "Commands:"
    echo "  upgrade     - Apply all pending migrations"
    echo "  downgrade   - Rollback the last migration"
    echo "  current     - Show current database revision"
    echo "  history     - Show migration history"
    echo "  new \"desc\"  - Create a new migration with autogenerate"
    echo "  stamp       - Mark database as current without running migrations"
    echo "  reset       - DROP ALL TABLES and re-run migrations (DESTRUCTIVE!)"
    echo ""
    echo "Examples:"
    echo "  ./migrate.sh upgrade"
    echo "  ./migrate.sh new \"add user profile fields\""
    echo "  ./migrate.sh history"
    ;;
esac
