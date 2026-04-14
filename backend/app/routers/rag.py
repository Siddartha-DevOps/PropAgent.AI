# app/routers/rag.py
"""
RAG query endpoints:
  POST /rag/query   — embed a question, retrieve context, stream answer
  POST /rag/context — retrieve context only (no LLM call, for Node to use)
"""
import logging
from uuid import UUID
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import openai

from app.config import get_settings
from app.services.embedder import embed_query
from app.services.retriever import retrieve_chunks

logger = logging.getLogger("propagent.rag")
router = APIRouter()
settings = get_settings()


# ── Models ─────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    bot_id: UUID
    question: str
    conversation_history: list[dict] = []   # [{role, content}, ...]
    system_prompt: Optional[str] = None
    top_k: int = 5
    min_score: float = 0.7
    stream: bool = True

class ContextRequest(BaseModel):
    bot_id: UUID
    question: str
    top_k: int = 5
    min_score: float = 0.7

class ChunkResult(BaseModel):
    chunk_id: str
    content: str
    doc_name: str
    score: float
    metadata: dict

class ContextResponse(BaseModel):
    chunks: list[ChunkResult]
    tokens_estimate: int


# ── Context-only endpoint (Node calls this, runs its own LLM) ─────────────────

@router.post("/context", response_model=ContextResponse)
async def get_context(req: ContextRequest):
    """
    Embed the question and return the most relevant chunks.
    Node.js uses this to inject context into its own chat completion call.
    """
    try:
        query_vec = await embed_query(req.question)
        chunks = await retrieve_chunks(
            bot_id=req.bot_id,
            query_embedding=query_vec,
            top_k=req.top_k,
            min_score=req.min_score,
        )
        token_est = sum(len(c["content"].split()) * 4 // 3 for c in chunks)

        return ContextResponse(
            chunks=[ChunkResult(**c) for c in chunks],
            tokens_estimate=token_est,
        )
    except Exception as exc:
        logger.error("Context retrieval failed bot=%s: %s", req.bot_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Full RAG query with streaming LLM response ────────────────────────────────

@router.post("/query")
async def rag_query(req: QueryRequest):
    """
    Full RAG pipeline: embed → retrieve → stream GPT answer.
    Returns Server-Sent Events stream when req.stream=True.
    """
    try:
        query_vec = await embed_query(req.question)
        chunks = await retrieve_chunks(
            bot_id=req.bot_id,
            query_embedding=query_vec,
            top_k=req.top_k,
            min_score=req.min_score,
        )
    except Exception as exc:
        logger.error("RAG retrieval failed bot=%s: %s", req.bot_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))

    context_text = "\n\n---\n\n".join(
        f"[Source: {c['doc_name']}]\n{c['content']}" for c in chunks
    )

    system = req.system_prompt or (
        "You are a helpful real estate assistant. "
        "Answer only using the context provided. "
        "If the answer is not in the context, say so politely. "
        "Be concise, friendly, and factual."
    )

    messages = [
        {"role": "system", "content": f"{system}\n\nContext:\n{context_text}"},
        *req.conversation_history[-10:],          # last 10 turns to cap tokens
        {"role": "user", "content": req.question},
    ]

    sources = [
        {"doc_name": c["doc_name"], "chunk_id": c["chunk_id"], "score": round(c["score"], 4)}
        for c in chunks
    ]

    if req.stream:
        return StreamingResponse(
            _stream_completion(messages, sources),
            media_type="text/event-stream",
            headers={"X-Sources": str(sources)},
        )

    # Non-streaming fallback
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=settings.chat_model,
        messages=messages,
        temperature=0.3,
    )
    return {
        "answer": response.choices[0].message.content,
        "sources": sources,
        "tokens_used": response.usage.total_tokens,
    }


async def _stream_completion(messages: list, sources: list) -> AsyncGenerator[str, None]:
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        yield f"data: {{'type':'sources','data':{sources}}}\n\n"

        async with client.chat.completions.stream(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
        ) as stream:
            async for text in stream.text_stream:
                safe = text.replace("\n", "\\n")
                yield f"data: {{'type':'token','data':'{safe}'}}\n\n"

        yield "data: [DONE]\n\n"
    except Exception as exc:
        logger.error("Streaming completion error: %s", exc)
        yield f"data: {{'type':'error','data':'{str(exc)}'}}\n\n"