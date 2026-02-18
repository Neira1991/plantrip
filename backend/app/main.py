import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.database import create_tables
from app.routers import activities, auth, movements, stops, trips

_testing = os.environ.get("TESTING", "").lower() == "true"
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    enabled=not _testing,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title="PlanTrip API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(trips.router, prefix="/api")
app.include_router(stops.router, prefix="/api")
app.include_router(movements.router, prefix="/api")
app.include_router(activities.router, prefix="/api")

if os.environ.get("TESTING", "").lower() == "true":
    from app.routers import test_utils
    app.include_router(test_utils.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
