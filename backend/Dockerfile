FROM python:3.12-slim

# Install runtime dependencies: curl for healthcheck, postgresql-client for pg_isready
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Copy Alembic configuration and migrations
COPY alembic.ini .
COPY alembic/ ./alembic/

# Copy and make entrypoint script executable
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 8000

# Use entrypoint script to run migrations before starting the app
ENTRYPOINT ["./entrypoint.sh"]

# Default command (passed to entrypoint script as arguments)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
