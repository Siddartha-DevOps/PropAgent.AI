# app/services/splitter.py
"""
Handles:
  - PDF text extraction (via pymupdf — fast, no poppler needed)
  - URL fetching and HTML→text
  - Recursive character text splitting
"""
import io
import re
import logging
import httpx
import fitz                          # pymupdf
from bs4 import BeautifulSoup
from app.config import get_settings

logger = logging.getLogger("propagent.splitter")
settings = get_settings()


def extract_text_from_pdf(raw_bytes: bytes) -> str:
    """Extract all text from a PDF binary blob using pymupdf."""
    doc = fitz.open(stream=raw_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text("text"))
    text = "\n\n".join(pages)
    doc.close()
    logger.info("PDF extracted: %d pages, %d chars", len(pages), len(text))
    return text


async def fetch_url_text(url: str) -> str:
    """Fetch a URL and return clean text (strips nav/footer/scripts)."""
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "PropAgent-Bot/1.0"})
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    # Collapse excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    logger.info("URL fetched: %s — %d chars", url, len(text))
    return text


def split_text(text: str, metadata: dict = {}) -> list[dict]:
    """
    Recursive character splitter that respects paragraph and sentence boundaries.
    Returns list of {"content": str, "metadata": dict, "chunk_index": int}
    """
    chunk_size    = settings.chunk_size
    chunk_overlap = settings.chunk_overlap

    # Separator priority: paragraph > sentence > word
    separators = ["\n\n", "\n", ". ", " ", ""]

    def _split(text: str, separators: list[str]) -> list[str]:
        if not separators:
            return _fixed_split(text, chunk_size, chunk_overlap)

        sep = separators[0]
        splits = text.split(sep) if sep else list(text)
        chunks, current = [], ""

        for part in splits:
            candidate = (current + sep + part).strip() if current else part.strip()
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                if len(part) > chunk_size:
                    chunks.extend(_split(part, separators[1:]))
                    current = ""
                else:
                    current = part

        if current:
            chunks.append(current)
        return chunks

    def _fixed_split(text: str, size: int, overlap: int) -> list[str]:
        chunks = []
        start = 0
        while start < len(text):
            chunks.append(text[start:start + size])
            start += size - overlap
        return chunks

    raw_chunks = _split(text.strip(), separators)

    # Filter empties, add metadata and index
    results = []
    for i, content in enumerate(raw_chunks):
        if len(content.strip()) < 20:       # skip tiny fragments
            continue
        results.append({
            "content":     content.strip(),
            "chunk_index": i,
            "metadata":    {**metadata, "char_count": len(content)},
        })

    logger.info("Split complete: %d chunks from %d chars", len(results), len(text))
    return results