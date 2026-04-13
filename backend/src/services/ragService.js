/**
 * ragService.js
 * --------------
 * Core RAG (Retrieval-Augmented Generation) service for PropAgent.AI.
 *
 * Responsibilities:
 *  1. Extract plain text from PDF / DOCX / TXT files
 *  2. Split text into overlapping chunks
 *  3. Generate embeddings via OpenAI API
 *  4. Store chunks + embeddings in MongoDB (KnowledgeChunk collection)
 *  5. At query time: embed the visitor's question and retrieve top-K chunks
 *     via cosine similarity for injection into the Claude prompt
 *
 * LOCATION: backend/src/services/ragService.js
 * STATUS: NEW FILE
 *
 * Dependencies (add to package.json):
 *   npm install openai pdf-parse mammoth multer
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const TrainingDoc = require('../models/TrainingDoc');
const KnowledgeChunk = require('../models/KnowledgeChunk');
const pinecone = require('./pineconeService');
// ─── OpenAI client (used only for embeddings) ───────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Chunking configuration ──────────────────────────────────────────────────
const CHUNK_SIZE = 500;       // Target characters per chunk
const CHUNK_OVERLAP = 80;     // Characters of overlap between consecutive chunks
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims, fast & cheap

// ─── 1. TEXT EXTRACTION ──────────────────────────────────────────────────────

/**
 * Extract plain text from a file on disk.
 * Supports: .pdf, .docx, .txt
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} mimeType - e.g. 'application/pdf'
 * @returns {Promise<string>} Extracted plain text
 */
async function extractTextFromFile(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    ext === '.docx' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === '.txt' || mimeType === 'text/plain') {
    return fs.readFileSync(filePath, 'utf8');
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// ─── 2. TEXT CHUNKING ────────────────────────────────────────────────────────

/**
 * Split a long text into overlapping chunks.
 * Strategy: split on sentence boundaries ('. ') then group into chunks
 * respecting CHUNK_SIZE, with CHUNK_OVERLAP carry-over.
 *
 * @param {string} text - Full document text
 * @returns {string[]} Array of text chunks
 */
function splitIntoChunks(text) {
  // Normalise whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();

  // Split into sentences (simple heuristic — good enough for property docs)
  const sentences = cleaned.split(/(?<=[.!?])\s+/);

  const chunks = [];
  let current = '';
  let overlapBuffer = '';

  for (const sentence of sentences) {
    // If adding this sentence keeps us under CHUNK_SIZE, append it
    if ((current + ' ' + sentence).length <= CHUNK_SIZE) {
      current = current ? current + ' ' + sentence : sentence;
    } else {
      // Save the current chunk
      if (current) {
        chunks.push(current.trim());
        // Keep last CHUNK_OVERLAP chars as the start of the next chunk
        overlapBuffer = current.slice(-CHUNK_OVERLAP);
      }
      // Start next chunk from overlap + new sentence
      current = overlapBuffer ? overlapBuffer + ' ' + sentence : sentence;
      overlapBuffer = '';
    }
  }

  // Push the final partial chunk
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 20); // discard tiny leftover fragments
}

// ─── 3. EMBEDDING GENERATION ─────────────────────────────────────────────────

/**
 * Generate an embedding vector for a single text string.
 * @param {string} text
 * @returns {Promise<number[]>} Embedding vector
 */
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Generate embeddings for an array of texts in batches.
 * OpenAI supports up to 2048 inputs per request but we batch conservatively.
 * @param {string[]} texts
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function embedBatch(texts) {
  const BATCH_SIZE = 100;
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    embeddings.push(...response.data.map((d) => d.embedding));
  }

  return embeddings;
}

// ─── 4. INDEX A DOCUMENT ─────────────────────────────────────────────────────

/**
 * Full pipeline: extract → chunk → embed → store in MongoDB.
 * Called after a file is uploaded or a URL is crawled.
 *
 * @param {Object} options
 * @param {string} options.trainingDocId - MongoDB _id of the TrainingDoc
 * @param {string} options.builderId     - MongoDB _id of the builder
 * @param {string} [options.filePath]    - Absolute path to uploaded file
 * @param {string} [options.mimeType]    - MIME type of the file
 * @param {string} [options.rawText]     - Pre-extracted text (for URL/manual)
 * @param {string} [options.source]      - Label: filename or URL
 * @param {string} [options.docType]     - 'pdf' | 'txt' | 'docx' | 'url' | 'manual'
 */
async function indexDocument(trainingDocId, builderId, chunks, embeddings, source, docType) {
  await pinecone.upsertChunks({
    builderId,
    trainingDocId,
    chunks,
    embeddings,
    source,
    docType,
  });
}
 {
  // Mark document as processing
  await TrainingDoc.findByIdAndUpdate(trainingDocId, { status: 'processing' });

  try {
    // Step 1: Get plain text
    let text = rawText;
    if (!text && filePath) {
      text = await extractTextFromFile(filePath, mimeType);
    }

    if (!text || text.trim().length < 10) {
      throw new Error('Could not extract meaningful text from this document.');
    }

    // Save rawText to the TrainingDoc for potential re-indexing
    await TrainingDoc.findByIdAndUpdate(trainingDocId, { rawText: text });

    // Step 2: Chunk the text
    const chunks = splitIntoChunks(text);

    if (chunks.length === 0) {
      throw new Error('Document produced no usable text chunks.');
    }

    // Step 3: Generate embeddings for all chunks in batch
    const embeddings = await embedBatch(chunks);

    // Step 4: Build KnowledgeChunk documents
    const chunkDocs = chunks.map((content, idx) => ({
      builderId,
      trainingDocId,
      content,
      embedding: embeddings[idx],
      metadata: {
        source: source || 'unknown',
        chunkIndex: idx,
        totalChunks: chunks.length,
        docType: docType || 'manual',
      },
    }));

    // Step 5: Delete old chunks for this doc (in case of re-index)
    await KnowledgeChunk.deleteMany({ trainingDocId });

    // Step 6: Insert all chunks in one bulk operation
    await KnowledgeChunk.insertMany(chunkDocs);

    // Step 7: Mark document as successfully indexed
    await TrainingDoc.findByIdAndUpdate(trainingDocId, {
      status: 'indexed',
      chunkCount: chunks.length,
    });

    return { success: true, chunkCount: chunks.length };
  } catch (err) {
    // Mark document as failed and store the reason
    await TrainingDoc.findByIdAndUpdate(trainingDocId, {
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  } finally {
    // Clean up temp file if it was uploaded to disk
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// ─── 5. COSINE SIMILARITY ────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between 0 (unrelated) and 1 (identical direction).
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── 6. RETRIEVE RELEVANT CONTEXT ────────────────────────────────────────────

/**
 * Given a visitor's query, find the most relevant knowledge chunks
 * for a specific builder using cosine similarity.
 *
 * For small knowledge bases (< 5,000 chunks) in-process similarity is fast.
 * For production scale, migrate to MongoDB Atlas Vector Search.
 *
 * @param {string} query       - The visitor's question
 * @param {string} builderId   - MongoDB _id of the builder
 * @param {number} [topK=5]    - Number of chunks to return
 * @returns {Promise<string>}  - Formatted context string for Claude's prompt
 */
async function getRelevantContext(queryEmbedding, builderId, topK = 5) {
  return await pinecone.queryChunks(queryEmbedding, builderId, topK);
}
  // Step 1: Embed the query
  const queryEmbedding = await embedText(query);

  // Step 2: Load all chunks for this builder
  // (Only pulls content + embedding — not the full document)
  const chunks = await KnowledgeChunk.find(
    { builderId },
    { content: 1, embedding: 1, 'metadata.source': 1 }
  ).lean();

  if (chunks.length === 0) {
    return ''; // No knowledge base yet — Claude will answer from base training
  }

  // Step 3: Score each chunk
  const scored = chunks.map((chunk) => ({
    content: chunk.content,
    source: chunk.metadata?.source || 'document',
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Step 4: Sort by descending similarity and take top-K
  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, topK);

  // Step 5: Filter out low-relevance chunks (score < 0.35)
  const relevant = topChunks.filter((c) => c.score > 0.35);

  if (relevant.length === 0) {
    return '';
  }

  // Step 6: Format context for injection into Claude's system prompt
  const contextLines = relevant.map(
    (c, i) => `[Source: ${c.source}]\n${c.content}`
  );

  return contextLines.join('\n\n---\n\n');
}

// ─── 7. DELETE A DOCUMENT'S CHUNKS ───────────────────────────────────────────

/**
 * Remove all KnowledgeChunks and the TrainingDoc itself.
 * Called when a builder deletes a training document from the dashboard.
 *
 * @param {string} trainingDocId
 * @param {string} builderId - Used to scope the delete (security check)
 */
async function deleteDocument(trainingDocId, builderId) {
  await KnowledgeChunk.deleteMany({ trainingDocId, builderId });
  await TrainingDoc.findOneAndDelete({ _id: trainingDocId, builderId });
}

module.exports = {
  indexDocument,
  retrieveContext,
  deleteDocument,
  splitIntoChunks,    // Exported for unit testing
  cosineSimilarity,   // Exported for unit testing
};