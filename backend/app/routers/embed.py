# app/routers/embed.py
"""
Document ingestion pipeline:
  POST /embed/document   — ingest a single document (PDF, URL, raw text)
  DELETE /embed/document/{document_id}  — remove a document + its chunks
  GET  /embed/status/{document_id}      — poll processing status
"""
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, HttpUrl
from typing import Optional

from app.services.splitter import split_text, extract_text_from_pdf, fetch_url_text
from app.services.embedder import embed_chunks
from app.services.db import get_db_pool

logger = logging.getLogger("propagent.embed")
router = APIRouter()


# ── Request / Response models ──────────────────────────────────────────────────

class TextIngestRequest(BaseModel):
    bot_id: UUID
    document_id: UUID          # pre-created row in documents table by Node
    name: str
    content: str               # raw text
    metadata: dict = {}

class UrlIngestRequest(BaseModel):
    bot_id: UUID
    document_id: UUID
    name: str
    url: HttpUrl
    metadata: dict = {}

class IngestResponse(BaseModel):
    document_id: UUID
    chunk_count: int
    status: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _mark_document(document_id: UUID, status: str, chunk_count: int = 0, error: str = None):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE documents
               SET status = $1, chunk_count = $2, error_msg = $3, updated_at = NOW()
               WHERE id = $4""",
            status, chunk_count, error, str(document_id)
        )


async def _ingest(bot_id: UUID, document_id: UUID, text: str, metadata: dict) -> int:
    """Split → embed → upsert chunks. Returns chunk count."""
    chunks = split_text(text, metadata)
    if not chunks:
        raise ValueError("Document produced zero chunks after splitting")

    await embed_chunks(bot_id=bot_id, document_id=document_id, chunks=chunks)
    return len(chunks)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/text", response_model=IngestResponse)
async def ingest_text(req: TextIngestRequest):
    """Ingest raw text (property descriptions, custom knowledge base entries)."""
    await _mark_document(req.document_id, "processing")
    try:
        count = await _ingest(req.bot_id, req.document_id, req.content, req.metadata)
        await _mark_document(req.document_id, "ready", count)
        return IngestResponse(document_id=req.document_id, chunk_count=count, status="ready")
    except Exception as exc:
        logger.error("Text ingest failed doc=%s: %s", req.document_id, exc)
        await _mark_document(req.document_id, "error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/url", response_model=IngestResponse)
async def ingest_url(req: UrlIngestRequest):
    """Fetch a URL, extract text, ingest."""
    await _mark_document(req.document_id, "processing")
    try:
        text = await fetch_url_text(str(req.url))
        count = await _ingest(req.bot_id, req.document_id, text, {"source_url": str(req.url)})
        await _mark_document(req.document_id, "ready", count)
        return IngestResponse(document_id=req.document_id, chunk_count=count, status="ready")
    except Exception as exc:
        logger.error("URL ingest failed doc=%s url=%s: %s", req.document_id, req.url, exc)
        await _mark_document(req.document_id, "error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/pdf", response_model=IngestResponse)
async def ingest_pdf(
    bot_id: UUID        = Form(...),
    document_id: UUID   = Form(...),
    file: UploadFile    = File(...),
):
    """Upload and ingest a PDF brochure / document."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    await _mark_document(document_id, "processing")
    try:
        raw_bytes = await file.read()
        text = extract_text_from_pdf(raw_bytes)
        count = await _ingest(bot_id, document_id, text, {"filename": file.filename})
        await _mark_document(document_id, "ready", count)
        return IngestResponse(document_id=document_id, chunk_count=count, status="ready")
    except Exception as exc:
        logger.error("PDF ingest failed doc=%s file=%s: %s", document_id, file.filename, exc)
        await _mark_document(document_id, "error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/document/{document_id}")
async def delete_document(document_id: UUID):
    """Remove all chunks for a document (cascades via FK, but explicit for clarity)."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        deleted = await conn.fetchval(
            "DELETE FROM chunks WHERE document_id = $1 RETURNING COUNT(*)", str(document_id)
        )
        await conn.execute(
            "UPDATE documents SET status = 'outdated', chunk_count = 0 WHERE id = $1",
            str(document_id)
        )
    return {"document_id": document_id, "chunks_deleted": deleted or 0}


@router.get("/status/{document_id}")
async def get_document_status(document_id: UUID):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, status, chunk_count, error_msg, updated_at FROM documents WHERE id = $1",
            str(document_id)
        )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return dict(row)