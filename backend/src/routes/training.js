/**
 * training.js (Routes)
 * ---------------------
 * REST API endpoints for PropAgent.AI's RAG knowledge base management.
 * Builders use these endpoints from the CRM Dashboard to upload training docs.
 *
 * LOCATION: backend/src/routes/training.js
 * STATUS: MODIFIED (full RAG integration added)
 *
 * Endpoints:
 *   POST   /api/training/upload          Upload a PDF/DOCX/TXT file
 *   POST   /api/training/manual          Add plain text manually
 *   GET    /api/training/documents       List all training docs for this builder
 *   GET    /api/training/documents/:id   Get single document details
 *   DELETE /api/training/documents/:id   Delete document + all its chunks
 *   POST   /api/training/reindex/:id     Re-process a failed document
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { authMiddleware } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGate');
const TrainingDoc = require('../models/TrainingDoc');
const KnowledgeChunk = require('../models/KnowledgeChunk');
const ragService = require('../services/ragService');

// ─── Multer configuration ────────────────────────────────────────────────────
// Files are temporarily saved to /tmp/uploads before processing
const UPLOAD_DIR = path.join(__dirname, '../../tmp/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive doc type string from MIME type.
 */
function mimeToDocType(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (mimeType === 'text/plain') return 'txt';
  return 'manual';
}

// ─── All routes require authentication ───────────────────────────────────────
router.use(authMiddleware);

// ─── POST /api/training/upload ───────────────────────────────────────────────
/**
 * Upload a PDF / DOCX / TXT document.
 * The file is processed asynchronously — caller gets a trainingDocId immediately
 * and polls GET /documents/:id to check when status === 'indexed'.
 */
router.post(
  '/upload',
  requirePlan('basic'), // Requires at least a basic plan
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const builderId = req.user._id;
      const docType = mimeToDocType(req.file.mimetype);

      // Create the TrainingDoc record immediately (status: pending)
      const trainingDoc = await TrainingDoc.create({
        builderId,
        name: req.body.name || req.file.originalname,
        type: docType,
        source: req.file.originalname,
        fileSize: req.file.size,
        status: 'pending',
      });

      // Process asynchronously so the HTTP response is instant
      setImmediate(async () => {
        try {
          await ragService.indexDocument({
            trainingDocId: trainingDoc._id.toString(),
            builderId: builderId.toString(),
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            source: req.file.originalname,
            docType,
          });
        } catch (err) {
          console.error(`[RAG] Indexing failed for ${trainingDoc._id}:`, err.message);
        }
      });

      return res.status(202).json({
        message: 'Document received. Indexing in progress.',
        trainingDocId: trainingDoc._id,
        status: 'pending',
      });
    } catch (err) {
      console.error('[Training] Upload error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── POST /api/training/manual ───────────────────────────────────────────────
/**
 * Add knowledge manually as plain text (e.g. paste property description).
 * Useful for quick additions without needing a file.
 *
 * Body: { name: string, content: string }
 */
router.post('/manual', requirePlan('basic'), async (req, res) => {
  try {
    const { name, content } = req.body;

    if (!name || !content || content.trim().length < 20) {
      return res
        .status(400)
        .json({ error: 'name and content (min 20 chars) are required.' });
    }

    const builderId = req.user._id;

    const trainingDoc = await TrainingDoc.create({
      builderId,
      name,
      type: 'manual',
      source: 'manual-entry',
      rawText: content,
      status: 'pending',
    });

    setImmediate(async () => {
      try {
        await ragService.indexDocument({
          trainingDocId: trainingDoc._id.toString(),
          builderId: builderId.toString(),
          rawText: content,
          source: 'Manual Entry',
          docType: 'manual',
        });
      } catch (err) {
        console.error(`[RAG] Manual indexing failed for ${trainingDoc._id}:`, err.message);
      }
    });

    return res.status(202).json({
      message: 'Content received. Indexing in progress.',
      trainingDocId: trainingDoc._id,
      status: 'pending',
    });
  } catch (err) {
    console.error('[Training] Manual add error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/training/documents ─────────────────────────────────────────────
/**
 * List all training documents for the authenticated builder.
 * Returns summary info (no rawText or embeddings).
 */
router.get('/documents', async (req, res) => {
  try {
    const docs = await TrainingDoc.find(
      { builderId: req.user._id },
      { rawText: 0 } // Exclude large field from list view
    )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ documents: docs, total: docs.length });
  } catch (err) {
    console.error('[Training] List error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/training/documents/:id ─────────────────────────────────────────
/**
 * Get details of a single training document.
 * Includes chunk count and status — used for polling after upload.
 */
router.get('/documents/:id', async (req, res) => {
  try {
    const doc = await TrainingDoc.findOne({
      _id: req.params.id,
      builderId: req.user._id,
    }).lean();

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    return res.json({ document: doc });
  } catch (err) {
    console.error('[Training] Get doc error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/training/documents/:id ──────────────────────────────────────
/**
 * Delete a training document and all its associated knowledge chunks.
 * The AI agent will no longer have access to this knowledge.
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const builderId = req.user._id.toString();
    const trainingDocId = req.params.id;

    // Verify ownership before deleting
    const doc = await TrainingDoc.findOne({
      _id: trainingDocId,
      builderId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    await ragService.deleteDocument(trainingDocId, builderId);

    return res.json({ message: 'Document and all associated knowledge deleted.' });
  } catch (err) {
    console.error('[Training] Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/training/reindex/:id ──────────────────────────────────────────
/**
 * Re-attempt indexing of a document that previously failed.
 * Uses the rawText already stored in MongoDB (no re-upload needed).
 */
router.post('/reindex/:id', async (req, res) => {
  try {
    const doc = await TrainingDoc.findOne({
      _id: req.params.id,
      builderId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (!doc.rawText) {
      return res
        .status(400)
        .json({ error: 'No stored text to re-index. Please re-upload the file.' });
    }

    // Reset to pending before re-indexing
    await TrainingDoc.findByIdAndUpdate(doc._id, {
      status: 'pending',
      errorMessage: null,
    });

    setImmediate(async () => {
      try {
        await ragService.indexDocument({
          trainingDocId: doc._id.toString(),
          builderId: req.user._id.toString(),
          rawText: doc.rawText,
          source: doc.source,
          docType: doc.type,
        });
      } catch (err) {
        console.error(`[RAG] Re-index failed for ${doc._id}:`, err.message);
      }
    });

    return res.json({ message: 'Re-indexing started.', status: 'pending' });
  } catch (err) {
    console.error('[Training] Reindex error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/training/stats ──────────────────────────────────────────────────
/**
 * Get knowledge base stats for the builder's dashboard widget.
 * Returns: total docs, indexed docs, total chunks
 */
router.get('/stats', async (req, res) => {
  try {
    const builderId = req.user._id;

    const [totalDocs, indexedDocs, totalChunks] = await Promise.all([
      TrainingDoc.countDocuments({ builderId }),
      TrainingDoc.countDocuments({ builderId, status: 'indexed' }),
      KnowledgeChunk.countDocuments({ builderId }),
    ]);

    return res.json({ totalDocs, indexedDocs, totalChunks });
  } catch (err) {
    console.error('[Training] Stats error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;