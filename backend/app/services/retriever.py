# app/services/retriever.py
"""
Vector similarity retrieval from pgvector using the match_chunks SQL function
defined in schema.sql.
"""
import logging
from uuid import UUID

from app.services.db import get_db_pool

logger = logging.getLogger("propagent.retriever")


async def retrieve_chunks(
    bot_id: UUID,
    query_embedding: list[float],
    top_k: int = 5,
    min_score: float = 0.7,
) -> list[dict]:
    """
    Run cosine similarity search via pgvector using the match_chunks function.
    Returns chunks sorted by relevance score descending.
    """
    pool = await get_db_pool()

    # Format vector as Postgres literal: '[0.1, 0.2, ...]'
    vec_literal = "[" + ",".join(str(round(v, 8)) for v in query_embedding) + "]"

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, content, metadata, doc_name, score
            FROM match_chunks(
              query_embedding := $1::vector,
              match_bot_id    := $2::uuid,
              match_count     := $3,
              min_score       := $4
            )
            """,
            vec_literal,
            str(bot_id),
            top_k,
            min_score,
        )

    results = [
        {
            "chunk_id": str(row["id"]),
            "content":  row["content"],
            "metadata": dict(row["metadata"]) if row["metadata"] else {},
            "doc_name": row["doc_name"],
            "score":    float(row["score"]),
        }
        for row in rows
    ]

    logger.info(
        "Retrieved %d chunks for bot=%s (top_k=%d, min_score=%.2f)",
        len(results), bot_id, top_k, min_score
    )
    return results