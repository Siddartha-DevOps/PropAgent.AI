/**
 * ragService.js
 * Core RAG service for PropAgent.AI
 */

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const TrainingDoc = require("../models/TrainingDoc");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const pinecone = require("./pineconeService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;
const EMBEDDING_MODEL = "text-embedding-3-small";

/* ---------------------------------------------------------
 TEXT EXTRACTION
----------------------------------------------------------*/

async function extractTextFromFile(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf" || mimeType === "application/pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    ext === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".txt" || mimeType === "text/plain") {
    return fs.readFileSync(filePath, "utf8");
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

/* ---------------------------------------------------------
 TEXT CHUNKING
----------------------------------------------------------*/

function splitIntoChunks(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  const sentences = cleaned.split(/(?<=[.!?])\s+/);

  const chunks = [];
  let current = "";
  let overlapBuffer = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).length <= CHUNK_SIZE) {
      current = current ? current + " " + sentence : sentence;
    } else {
      if (current) {
        chunks.push(current.trim());
        overlapBuffer = current.slice(-CHUNK_OVERLAP);
      }

      current = overlapBuffer
        ? overlapBuffer + " " + sentence
        : sentence;

      overlapBuffer = "";
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 20);
}

/* ---------------------------------------------------------
 EMBEDDINGS
----------------------------------------------------------*/

async function embedText(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

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

/* ---------------------------------------------------------
 INDEX DOCUMENT (MAIN PIPELINE)
----------------------------------------------------------*/

async function indexDocument({
  trainingDocId,
  builderId,
  filePath,
  mimeType,
  rawText,
  source,
  docType,
}) {
  try {
    await TrainingDoc.findByIdAndUpdate(trainingDocId, {
      status: "processing",
    });

    let text = rawText;

    if (!text && filePath) {
      text = await extractTextFromFile(filePath, mimeType);
    }

    if (!text || text.trim().length < 10) {
      throw new Error("Could not extract meaningful text.");
    }

    await TrainingDoc.findByIdAndUpdate(trainingDocId, {
      rawText: text,
    });

    const chunks = splitIntoChunks(text);

    if (chunks.length === 0) {
      throw new Error("No usable chunks generated.");
    }

    const embeddings = await embedBatch(chunks);

    await pinecone.upsertChunks({
      builderId,
      trainingDocId,
      chunks,
      embeddings,
      source,
      docType,
    });

    const chunkDocs = chunks.map((content, idx) => ({
      builderId,
      trainingDocId,
      content,
      embedding: embeddings[idx],
      metadata: {
        source: source || "unknown",
        chunkIndex: idx,
        totalChunks: chunks.length,
        docType: docType || "manual",
      },
    }));

    await KnowledgeChunk.deleteMany({ trainingDocId });

    await KnowledgeChunk.insertMany(chunkDocs);

    await TrainingDoc.findByIdAndUpdate(trainingDocId, {
      status: "indexed",
      chunkCount: chunks.length,
    });

    return { success: true, chunkCount: chunks.length };
  } catch (err) {
    await TrainingDoc.findByIdAndUpdate(trainingDocId, {
      status: "failed",
      errorMessage: err.message,
    });

    throw err;
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/* ---------------------------------------------------------
 COSINE SIMILARITY
----------------------------------------------------------*/

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

/* ---------------------------------------------------------
 RETRIEVE CONTEXT
----------------------------------------------------------*/

async function getRelevantContext(query, builderId, topK = 5) {
  const queryEmbedding = await embedText(query);

  const results = await pinecone.queryChunks(
    queryEmbedding,
    builderId,
    topK
  );

  if (!results || results.length === 0) {
    return "";
  }

  const contextLines = results.map(
    (c) => `[Source: ${c.source}]\n${c.content}`
  );

  return contextLines.join("\n\n---\n\n");
}

/* ---------------------------------------------------------
 DELETE DOCUMENT
----------------------------------------------------------*/

async function deleteDocument(trainingDocId, builderId) {
  await KnowledgeChunk.deleteMany({
    trainingDocId,
    builderId,
  });

  await TrainingDoc.findOneAndDelete({
    _id: trainingDocId,
    builderId,
  });
}

/* ---------------------------------------------------------
 EXPORTS
----------------------------------------------------------*/

module.exports = {
  indexDocument,
  getRelevantContext,
  deleteDocument,
  splitIntoChunks,
  cosineSimilarity,
};