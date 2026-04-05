/**
 * TrainingDoc.js
 * ---------------
 * Represents a knowledge document uploaded by a builder (real estate developer).
 * Tracks the document's lifecycle: pending → processing → indexed / failed.
 *
 * LOCATION: backend/src/models/TrainingDoc.js
 * STATUS: MODIFIED (adds status, chunkCount, rawText, errorMessage fields)
 */

const mongoose = require('mongoose');

const TrainingDocSchema = new mongoose.Schema(
  {
    // Owner: the real estate developer's user account
    builderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Human-readable name for the document
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Type of source content
    type: {
      type: String,
      enum: ['pdf', 'txt', 'docx', 'url', 'manual'],
      required: true,
    },

    // Original filename (for uploads) or URL (for crawler)
    source: {
      type: String,
    },

    // Full extracted plain text — stored for re-chunking without re-upload
    rawText: {
      type: String,
    },

    // Processing lifecycle status
    status: {
      type: String,
      enum: ['pending', 'processing', 'indexed', 'failed'],
      default: 'pending',
      index: true,
    },

    // How many KnowledgeChunk documents were created from this doc
    chunkCount: {
      type: Number,
      default: 0,
    },

    // File size in bytes (for display in dashboard)
    fileSize: {
      type: Number,
    },

    // Stores error reason if status === 'failed'
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrainingDoc', TrainingDocSchema);