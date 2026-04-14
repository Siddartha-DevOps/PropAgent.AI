# app/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str
    embedding_model: str = "text-embedding-3-small"
    embedding_dims: int = 1536
    chat_model: str = "gpt-4o-mini"

    # Supabase / Postgres (pgvector)
    supabase_url: str
    supabase_service_key: str          # service_role key — bypasses RLS
    postgres_uri: str                  # direct connection for pgvector queries

    # Internal auth between Node and FastAPI
    internal_api_secret: str           # shared secret, set same in Node .env

    # Document processing
    chunk_size: int = 512
    chunk_overlap: int = 64
    max_file_size_mb: int = 50

    # Redis (job queue)
    redis_url: str = "redis://localhost:6379"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()