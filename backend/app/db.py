import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

_HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE = f"sqlite+aiosqlite:///{os.path.join(os.path.dirname(_HERE), 'gapfill.db')}"

# Set DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/gapfill to use Postgres.
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_SQLITE)

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session


def backend_name() -> str:
    return "postgresql" if DATABASE_URL.startswith("postgresql") else "sqlite"
