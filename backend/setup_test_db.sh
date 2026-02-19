#!/bin/bash
# Setup test database for backend integration tests

set -e

echo "Setting up test database for PlanTrip backend tests"
echo "====================================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if plantrip db container exists
if docker ps -a | grep -q plantrip-db; then
    echo "Found PlanTrip database container"

    # Start it if not running
    if ! docker ps | grep -q plantrip-db; then
        echo "Starting database container..."
        docker-compose up -d db
        echo "Waiting for database to be ready..."
        sleep 3
    fi

    # Create test database
    echo "Creating test database 'plantrip_test'..."
    docker exec plantrip-db-1 psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='plantrip_test'" | grep -q 1 && {
        echo "Test database already exists."
    } || {
        docker exec plantrip-db-1 psql -U postgres -c "CREATE DATABASE plantrip_test;"
        echo "Test database created successfully."
    }

    echo ""
    echo "Setup complete!"
    echo ""
    echo "Test database URL: postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip_test"
    echo ""
    echo "To run tests:"
    echo "  ./run_tests.sh"
    echo "  or"
    echo "  pytest"
    echo ""

else
    echo "Error: PlanTrip database container not found."
    echo ""
    echo "Please start the backend services first:"
    echo "  docker-compose up -d db"
    echo ""
    echo "Or if you're using a local PostgreSQL instance:"
    echo "  createdb plantrip_test"
    echo "  export TEST_DATABASE_URL='postgresql+asyncpg://user:pass@localhost:5432/plantrip_test'"
    exit 1
fi
