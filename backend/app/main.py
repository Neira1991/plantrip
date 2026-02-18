import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routers import activities, movements, stops, trips


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title="PlanTrip API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
