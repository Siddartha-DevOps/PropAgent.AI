# app/routers/health.py
from fastapi import APIRouter
from app.services.db import get_db_pool

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    db_ok = False
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }