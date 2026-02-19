#!/bin/bash
# Script to set up and run backend integration tests

set -e

echo "PlanTrip Backend Integration Tests"
echo "===================================="
echo ""

# Set test environment
export TESTING=true
export TEST_DATABASE_URL=${TEST_DATABASE_URL:-"postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test"}

echo "Test database URL: $TEST_DATABASE_URL"
echo ""

# Check if test database exists, create if not
echo "Checking test database..."
if docker ps | grep -q plantrip-db; then
    echo "Creating test database via Docker..."
    docker exec plantrip-db-1 psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='plantrip_test'" | grep -q 1 || \
    docker exec plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"
    echo "Test database ready."
else
    echo "Warning: Docker container not found. Assuming test database exists."
    echo "If tests fail, create it manually: createdb plantrip_test"
fi

echo ""
echo "Running tests..."
echo ""

# Run pytest with all arguments passed to this script
pytest "$@"
