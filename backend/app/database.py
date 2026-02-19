from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session


async def create_tables():
    """Create all tables using SQLAlchemy metadata.

    Note: This is kept for development convenience and backwards compatibility.
    In production, use Alembic migrations instead:
        alembic upgrade head

    For new deployments, run migrations before starting the application.
    """
    from app.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
