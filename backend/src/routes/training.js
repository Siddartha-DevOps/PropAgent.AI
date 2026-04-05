const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// In-memory knowledge base per builder (replace with vector DB in Phase 3b)
const knowledgeBases = new Map();

// ── GET /api/training/docs — list uploaded documents ──────────
router.get('/docs', authMiddleware, (req, res) => {
  const docs = knowledgeBases.get(req.userId) || [];
  res.json({ docs: docs.map(d => ({ id: d.id, name: d.name, pages: d.pages, uploadedAt: d.uploadedAt, status: d.status })) });
});

// ── POST /api/training/upload — upload text content ───────────
// In Phase 3b, swap this for multer + PDF parsing + Pinecone
router.post('/upload', authMiddleware, (req, res) => {
  const { content, fileName, fileType } = req.body;

  if (!content || !fileName) {
    return res.status(400).json({ error: 'content and fileName are required' });
  }

  if (content.length > 500000) {
    return res.status(400).json({ error: 'Content too large (max 500KB text)' });
  }

  const docs = knowledgeBases.get(req.userId) || [];

  // Chunk content into 500-word segments for retrieval
  const chunks = chunkText(content, 500);

  const doc = {
    id: 'doc_' + Date.now(),
    name: fileName,
    type: fileType || 'text',
    content: content,
    chunks: chunks,
    pages: Math.ceil(content.split(' ').length / 250),
    uploadedAt: new Date().toISOString(),
    status: 'trained',
    wordCount: content.split(' ').length,
  };

  docs.push(doc);
  knowledgeBases.set(req.userId, docs);

  console.log(`✅ Training doc added for builder ${req.userId}: ${fileName} (${doc.wordCount} words, ${chunks.length} chunks)`);

  res.json({
    success: true,
    doc: { id: doc.id, name: doc.name, pages: doc.pages, status: doc.status, wordCount: doc.wordCount },
    message: `"${fileName}" trained successfully. AI will now use this to answer buyer questions.`
  });
});

// ── POST /api/training/scrape — crawl a URL ───────────────────
router.post('/scrape', authMiddleware, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // Basic fetch — in Phase 3b replace with Puppeteer/Playwright
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PropAgent.AI Bot/1.0 (site verification)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Strip HTML tags, extract text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < 100) throw new Error('Page appears to have no readable content');

    const docs = knowledgeBases.get(req.userId) || [];
    const chunks = chunkText(text, 500);
    const hostname = new URL(url).hostname;

    const doc = {
      id: 'doc_' + Date.now(),
      name: `${hostname} (crawled)`,
      type: 'website',
      content: text,
      chunks: chunks,
      pages: Math.ceil(text.split(' ').length / 250),
      sourceUrl: url,
      uploadedAt: new Date().toISOString(),
      status: 'trained',
      wordCount: text.split(' ').length,
    };

    docs.push(doc);
    knowledgeBases.set(req.userId, docs);

    console.log(`✅ URL crawled for builder ${req.userId}: ${url} (${doc.wordCount} words)`);

    res.json({
      success: true,
      doc: { id: doc.id, name: doc.name, pages: doc.pages, wordCount: doc.wordCount },
      message: `"${hostname}" crawled and trained. AI now knows your website content.`
    });
  } catch (err) {
    console.error('Crawl error:', err.message);
    res.status(500).json({ error: 'Failed to crawl URL', details: err.message });
  }
});

// ── DELETE /api/training/docs/:id ─────────────────────────────
router.delete('/docs/:id', authMiddleware, (req, res) => {
  const docs = knowledgeBases.get(req.userId) || [];
  const filtered = docs.filter(d => d.id !== req.params.id);
  knowledgeBases.set(req.userId, filtered);
  res.json({ success: true, message: 'Document removed from training' });
});

// ── EXPORTED: retrieve context for RAG ────────────────────────
function getRelevantContext(builderId, query, maxChunks = 3) {
  const docs = knowledgeBases.get(builderId) || [];
  if (docs.length === 0) return '';

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return '';

  // Score each chunk by keyword overlap
  const scored = [];
  for (const doc of docs) {
    for (const chunk of (doc.chunks || [])) {
      const chunkLower = chunk.toLowerCase();
      const score = queryWords.reduce((s, w) => s + (chunkLower.includes(w) ? 1 : 0), 0);
      if (score > 0) scored.push({ text: chunk, score, docName: doc.name });
    }
  }

  // Return top chunks
  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, maxChunks);

  if (topChunks.length === 0) return '';

  return '\n\n## PROPERTY KNOWLEDGE BASE (use this to answer buyer questions accurately)\n\n' +
    topChunks.map((c, i) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n');
}

function chunkText(text, wordsPerChunk = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.trim().length > 50) chunks.push(chunk);
  }
  return chunks;
}

module.exports = router;
module.exports.getRelevantContext = getRelevantContext;