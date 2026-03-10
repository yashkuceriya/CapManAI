"""Database setup with async SQLAlchemy."""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# PostgreSQL needs connection pool settings; SQLite does not support them
_is_postgres = settings.DATABASE_URL.startswith("postgresql")

_engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,   # verify connections before use — prevents stale connections after idle
}
if _is_postgres:
    _engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,   # recycle connections every 30 min
    })
else:
    # SQLite-specific: recycle connections to avoid "database is locked" after idle
    _engine_kwargs.update({
        "pool_recycle": 600,    # recycle every 10 min for SQLite
    })

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            # Commit any pending changes. If a StreamingResponse endpoint
            # already committed mid-stream, this is a harmless no-op.
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
