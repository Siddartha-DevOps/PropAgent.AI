/**
 * KnowledgeChunk.js
 * ------------------
 * Stores individual text chunks extracted from training documents.
 * Each chunk holds its embedding vector for semantic similarity search.
 *
 * LOCATION: backend/src/models/KnowledgeChunk.js
 */

const mongoose = require('mongoose');

const KnowledgeChunkSchema = new mongoose.Schema(
  {
    // Which builder (developer) this chunk belongs to
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Reference back to the source training document
    trainingDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingDoc',
      required: true,
      index: true,
    },

    // The actual text content of this chunk
    content: {
      type: String,
      required: true,
    },

    // OpenAI embedding vector (1536 dims for text-embedding-3-small)
    // Used for cosine similarity search at query time
    embedding: {
      type: [Number],
      required: true,
    },

    // Metadata for traceability and filtering
    metadata: {
      source: { type: String },       // Original filename or URL
      chunkIndex: { type: Number },   // Position of this chunk in the document
      totalChunks: { type: Number },  // Total chunks from this document
      docType: {
        type: String,
        enum: ['pdf', 'txt', 'docx', 'url', 'manual'],
      },
    },
  },
  { timestamps: true }
);

// Compound index for fast per-builder retrieval
KnowledgeChunkSchema.index({ builderId: 1, trainingDocId: 1 });

module.exports = mongoose.model('KnowledgeChunk', KnowledgeChunkSchema);