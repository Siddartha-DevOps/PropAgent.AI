# app/services/db.py
import asyncpg
from typing import Optional
from app.config import get_settings

_pool: Optional[asyncpg.Pool] = None


async def get_db_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            dsn=settings.postgres_uri,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    return _pool


async def close_db_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None