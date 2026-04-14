# app/main.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time

from app.config import get_settings
from app.routers import embed, rag, health

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("propagent.ai")

app = FastAPI(
    title="PropAgent.AI — AI Service",
    description="Document ingestion, embedding, and RAG retrieval service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS (Node backend only in prod) ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Internal auth middleware ───────────────────────────────────────────────────
@app.middleware("http")
async def verify_internal_secret(request: Request, call_next):
    # Health check is public
    if request.url.path in ("/health", "/", "/docs", "/redoc", "/openapi.json"):
        return await call_next(request)

    secret = request.headers.get("X-Internal-Secret")
    if secret != settings.internal_api_secret:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)

# ── Request timing ─────────────────────────────────────────────────────────────
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = str(round((time.perf_counter() - start) * 1000))
    return response

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(embed.router,  prefix="/embed",  tags=["Ingestion"])
app.include_router(rag.router,    prefix="/rag",    tags=["Retrieval"])