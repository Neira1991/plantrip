from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/test", tags=["test"])


@router.post("/reset")
async def reset_database(db: AsyncSession = Depends(get_db)):
    """Truncate all tables in FK-safe order. Only available when TESTING=true."""
    await db.execute(text("TRUNCATE activities, movements, trip_stops, trips CASCADE"))
    await db.commit()
    return {"status": "reset"}
