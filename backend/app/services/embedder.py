# app/services/embedder.py
"""
Handles:
  - Batch embedding generation via OpenAI text-embedding-3-small
  - Exponential-backoff retry on rate limits
  - Bulk upsert of chunks + embeddings into pgvector
"""
import asyncio
import logging
from uuid import UUID

import openai
from app.config import get_settings
from app.services.db import get_db_pool

logger = logging.getLogger("propagent.embedder")
settings = get_settings()

_client: openai.AsyncOpenAI | None = None


def _get_client() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def _embed_with_retry(texts: list[str], retries: int = 4) -> list[list[float]]:
    """Call OpenAI embeddings API with exponential backoff."""
    delay = 1.0
    last_err = None
    for attempt in range(retries):
        try:
            resp = await _get_client().embeddings.create(
                model=settings.embedding_model,
                input=texts,
            )
            return [item.embedding for item in resp.data]
        except openai.RateLimitError as e:
            last_err = e
            logger.warning("Rate limit hit, retry %d/%d in %.1fs", attempt + 1, retries, delay)
            await asyncio.sleep(delay)
            delay *= 2
        except openai.APIError as e:
            last_err = e
            logger.error("OpenAI API error on attempt %d: %s", attempt + 1, e)
            await asyncio.sleep(delay)
            delay *= 2
    raise RuntimeError(f"Embedding failed after {retries} attempts: {last_err}")


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    vectors = await _embed_with_retry([text])
    return vectors[0]


async def embed_chunks(
    bot_id: UUID,
    document_id: UUID,
    chunks: list[dict],
    batch_size: int = 100,
) -> None:
    """
    Embed all chunks in batches and bulk-insert into the chunks table.
    Each chunk dict: {content, chunk_index, metadata}
    """
    pool = await get_db_pool()

    # Process in batches to respect OpenAI token limits
    for batch_start in range(0, len(chunks), batch_size):
        batch = chunks[batch_start : batch_start + batch_size]
        texts = [c["content"] for c in batch]

        logger.info(
            "Embedding batch %d-%d / %d for doc %s",
            batch_start, batch_start + len(batch), len(chunks), document_id
        )
        vectors = await _embed_with_retry(texts)

        # Bulk upsert — one round-trip per batch
        rows = [
            (
                str(bot_id),
                str(document_id),
                chunk["content"],
                chunk["chunk_index"],
                chunk["metadata"],   # JSONB
                vec,                 # vector(1536)
            )
            for chunk, vec in zip(batch, vectors)
        ]

        async with pool.acquire() as conn:
            await conn.executemany(
                """INSERT INTO chunks
                     (bot_id, document_id, content, chunk_index, metadata, embedding)
                   VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector)""",
                rows,
            )

        logger.info("Upserted %d chunks (batch starting at %d)", len(batch), batch_start)