/**
 * pineconeService.js
 * -------------------
 * Production vector store for PropAgent.AI's RAG system.
 * Replaces the in-memory cosine similarity in ragService.js
 * with Pinecone's managed vector database.
 *
 * FILE: backend/src/services/pineconeService.js
 * STATUS: NEW — swap into ragService.js for production at scale
 *
 * Why Pinecone over MongoDB in-memory:
 *  - Handles millions of vectors without loading all into RAM
 *  - ANN (Approximate Nearest Neighbour) is orders of magnitude faster
 *  - Per-builder namespacing built in (no index-per-tenant needed)
 *  - Scales horizontally as your SaaS grows
 *
 * Dependencies:
 *   npm install @pinecone-database/pinecone
 *
 * Env vars required:
 *   PINECONE_API_KEY=...
 *   PINECONE_INDEX=propagent-knowledge   (create this in Pinecone dashboard)
 *   PINECONE_ENVIRONMENT=us-east-1-aws   (your index region)
 */

const { Pinecone } = require('@pinecone-database/pinecone');

// ─── Pinecone client (lazy singleton) ────────────────────────────────────────
let _pc = null;
let _index = null;

function getIndex() {
  if (_index) return _index;

  _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  _index = _pc.index(process.env.PINECONE_INDEX || 'propagent-knowledge');
  return _index;
}

// ─── NAMESPACE STRATEGY ──────────────────────────────────────────────────────
// Each builder gets their own Pinecone namespace: "builder_{builderId}"
// This gives hard data isolation — builders can never see each other's vectors.
function builderNamespace(builderId) {
  return `builder_${builderId}`;
}

// ─── UPSERT VECTORS ──────────────────────────────────────────────────────────

/**
 * Store chunk embeddings for a document into Pinecone.
 * Call this from ragService.indexDocument() instead of MongoDB insert.
 *
 * @param {string}   builderId     - Builder's MongoDB _id
 * @param {string}   trainingDocId - TrainingDoc MongoDB _id
 * @param {string[]} chunks        - Array of text chunks
 * @param {number[][]} embeddings  - Parallel array of embedding vectors
 * @param {string}   source        - Source file name or URL
 * @param {string}   docType       - pdf | txt | docx | url | manual
 */
async function upsertChunks({ builderId, trainingDocId, chunks, embeddings, source, docType }) {
  const index = getIndex();
  const ns = builderNamespace(builderId);

  // Pinecone accepts up to 100 vectors per upsert call
  const BATCH = 100;
  const vectors = chunks.map((content, i) => ({
    id: `${trainingDocId}_chunk_${i}`,
    values: embeddings[i],
    metadata: {
      trainingDocId,
      builderId,
      content,             // Store text in metadata for retrieval
      source: source || 'unknown',
      chunkIndex: i,
      docType: docType || 'manual',
    },
  }));

  for (let i = 0; i < vectors.length; i += BATCH) {
    await index.namespace(ns).upsert(vectors.slice(i, i + BATCH));
  }

  console.log(`[Pinecone] Upserted ${vectors.length} vectors for doc ${trainingDocId}`);
}

// ─── QUERY (SEMANTIC SEARCH) ──────────────────────────────────────────────────

/**
 * Find the most relevant chunks for a visitor's query.
 * Returns formatted context string ready for injection into Claude's prompt.
 *
 * @param {number[]} queryEmbedding - Embedded visitor question (1536 dims)
 * @param {string}   builderId      - Scopes the search to this builder's data
 * @param {number}   [topK=5]       - Number of results to return
 * @param {number}   [minScore=0.35]- Minimum cosine similarity threshold
 * @returns {Promise<string>}        - Formatted context for Claude's system prompt
 */
async function queryChunks(queryEmbedding, builderId, topK = 5, minScore = 0.35) {
  const index = getIndex();
  const ns = builderNamespace(builderId);

  const result = await index.namespace(ns).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  const matches = (result.matches || [])
    .filter((m) => m.score >= minScore)
    .filter((m) => m.metadata?.content);

  if (matches.length === 0) return '';

  const contextLines = matches.map((m) =>
    `[Source: ${m.metadata.source}]\n${m.metadata.content}`
  );

  return contextLines.join('\n\n---\n\n');
}

// ─── DELETE DOCUMENT VECTORS ──────────────────────────────────────────────────

/**
 * Delete all vectors for a specific training document.
 * Called when a builder removes a document from their knowledge base.
 *
 * @param {string} trainingDocId
 * @param {string} builderId
 * @param {number} chunkCount - Number of chunks (needed to build vector IDs)
 */
async function deleteDocumentVectors(trainingDocId, builderId, chunkCount) {
  const index = getIndex();
  const ns = builderNamespace(builderId);

  // Build all vector IDs for this document
  const ids = Array.from({ length: chunkCount }, (_, i) => `${trainingDocId}_chunk_${i}`);

  // Pinecone deletes up to 1000 IDs per call
  const BATCH = 1000;
  for (let i = 0; i < ids.length; i += BATCH) {
    await index.namespace(ns).deleteMany(ids.slice(i, i + BATCH));
  }

  console.log(`[Pinecone] Deleted ${ids.length} vectors for doc ${trainingDocId}`);
}

/**
 * Delete ALL vectors for a builder (account deletion / full reset).
 */
async function deleteBuilderNamespace(builderId) {
  const index = getIndex();
  const ns = builderNamespace(builderId);
  await index.namespace(ns).deleteAll();
  console.log(`[Pinecone] Deleted entire namespace for builder ${builderId}`);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

/**
 * Get vector count for a builder's namespace.
 * Useful for the training stats endpoint.
 */
async function getNamespaceStats(builderId) {
  const index = getIndex();
  const stats = await index.describeIndexStats();
  const ns = builderNamespace(builderId);
  const nsStats = stats.namespaces?.[ns];
  return {
    vectorCount: nsStats?.recordCount || 0,
    namespace: ns,
  };
}

module.exports = {
  upsertChunks,
  queryChunks,
  deleteDocumentVectors,
  deleteBuilderNamespace,
  getNamespaceStats,
  builderNamespace,
};