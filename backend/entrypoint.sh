#!/bin/bash
set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting backend entrypoint script...${NC}"

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"

    # Extract host and port from DATABASE_URL
    # Expected format: postgresql+asyncpg://user:pass@host:port/db
    if [[ $DATABASE_URL =~ @([^:]+):([0-9]+)/ ]]; then
        DB_HOST="${BASH_REMATCH[1]}"
        DB_PORT="${BASH_REMATCH[2]}"
    else
        echo "Warning: Could not parse DATABASE_URL, using defaults"
        DB_HOST="db"
        DB_PORT="5432"
    fi

    # Wait for PostgreSQL (max 30 seconds)
    RETRIES=30
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q || [ $RETRIES -eq 0 ]; do
        echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT, $((RETRIES--)) remaining attempts..."
        sleep 1
    done

    if [ $RETRIES -eq 0 ]; then
        echo -e "${YELLOW}Warning: PostgreSQL may not be ready, continuing anyway...${NC}"
    else
        echo -e "${GREEN}PostgreSQL is ready!${NC}"
    fi
}

# Function to run Alembic migrations
run_migrations() {
    echo -e "${YELLOW}Running Alembic migrations...${NC}"

    # Check if alembic_version table exists (i.e., has Alembic ever run?)
    if alembic current 2>/dev/null | grep -q "(head)"; then
        echo -e "${GREEN}Database already at head, nothing to do.${NC}"
    elif alembic current 2>/dev/null | grep -q "001"; then
        # Alembic knows about a revision, try to upgrade
        alembic upgrade head
    else
        # Fresh database (created by init.sql) - stamp it at head
        echo -e "${YELLOW}Fresh database detected, stamping at head...${NC}"
        alembic stamp head
    fi

    echo -e "${GREEN}Migrations completed successfully!${NC}"
}

# Main execution
wait_for_postgres
run_migrations

echo -e "${GREEN}Starting Uvicorn server...${NC}"

# Execute the CMD from Dockerfile (passed as arguments to this script)
exec "$@"
