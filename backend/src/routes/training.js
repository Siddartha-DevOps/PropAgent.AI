// backend/src/routes/training.js
// UPDATED — adds PDF text extraction, chunking, and Pinecone embedding
// Merges with your existing training.js — ADD the new routes below your existing ones
//
// npm install multer pdf-parse uuid  (if not already installed)

const express   = require('express')
const router    = express.Router()
const multer    = require('multer')
const pdfParse  = require('pdf-parse')
const path      = require('path')
const fs        = require('fs')
const { v4: uuidv4 } = require('uuid')
const auth      = require('../middleware/auth')

// ── Import your existing RAG / Pinecone services ──────────────────────────────
const ragService     = require('../services/ragService')
const pineconeService = require('../services/pineconeService')

// ── Multer config — stores to tmp/uploads ─────────────────────────────────────
const upload = multer({
  dest: path.join(__dirname, '../../tmp/uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are allowed'), false)
  },
})

// ── Models ────────────────────────────────────────────────────────────────────
let TrainingDoc, KnowledgeChunk
try {
  TrainingDoc    = require('../../models/TrainingDoc')
  KnowledgeChunk = require('../../models/Knowledgechunk')
} catch {
  const mongoose = require('mongoose')

  const trainingDocSchema = new mongoose.Schema({
    botId:      { type: String, required: true, index: true },
    builderId:  { type: String, required: true },
    type:       { type: String, enum: ['pdf','url','text'], required: true },
    name:       { type: String, required: true },
    sourceUrl:  { type: String, default: '' },
    status:     { type: String, default: 'processing', enum: ['processing','ready','error'] },
    chunkCount: { type: Number, default: 0 },
  }, { timestamps: true })
  TrainingDoc = mongoose.model('TrainingDoc', trainingDocSchema)

  const chunkSchema = new mongoose.Schema({
    botId:      { type: String, required: true, index: true },
    docId:      { type: String, required: true },
    content:    { type: String, required: true },
    metadata:   { type: Object, default: {} },
    pineconeId: { type: String },
  }, { timestamps: true })
  KnowledgeChunk = mongoose.model('KnowledgeChunk', chunkSchema)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split text into overlapping chunks (~500 tokens each) */
function chunkText(text, chunkSize = 1800, overlap = 200) {
  // Clean up whitespace
  const clean = text.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim()

  const paragraphs = clean.split(/\n\n+/)
  const chunks = []
  let current = []
  let currentLen = 0

  for (const para of paragraphs) {
    if (currentLen + para.length > chunkSize && current.length > 0) {
      chunks.push(current.join('\n\n'))
      // Keep overlap: last paragraph(s) as context for next chunk
      const overlapText = current.slice(-1).join('\n\n')
      current = overlapText.length < overlap ? [overlapText, para] : [para]
      currentLen = current.reduce((s, p) => s + p.length, 0)
    } else {
      current.push(para)
      currentLen += para.length
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'))
  return chunks.filter(c => c.trim().length > 50)
}

/** Embed chunks and upsert to Pinecone */
async function embedAndStore(botId, docId, chunks, docName) {
  const pineconeVectors = []

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i]

    // Get embedding — calls your existing pineconeService or OpenAI
    let embedding
    try {
      // Try your existing service first
      embedding = await pineconeService.getEmbedding(content)
    } catch {
      // Fallback: call OpenAI directly
      const { OpenAI } = require('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content.replace(/\n/g, ' '),
      })
      embedding = res.data[0].embedding
    }

    const pineconeId = `${botId}-${docId}-${i}`

    // Save to MongoDB
    await KnowledgeChunk.create({
      botId, docId,
      content,
      metadata: { docName, chunkIndex: i },
      pineconeId,
    })

    pineconeVectors.push({
      id: pineconeId,
      values: embedding,
      metadata: { botId, docId, docName, content: content.slice(0, 500), chunkIndex: i },
    })
  }

  // Upsert to Pinecone in batches of 100
  for (let i = 0; i < pineconeVectors.length; i += 100) {
    const batch = pineconeVectors.slice(i, i + 100)
    try {
      await pineconeService.upsertVectors(batch, botId)
    } catch {
      // Fallback: use pinecone client directly
      const { Pinecone } = require('@pinecone-database/pinecone')
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
      const index = pc.index(process.env.PINECONE_INDEX || 'propagent')
      const ns = index.namespace(botId)
      await ns.upsert(batch)
    }
  }

  return pineconeVectors.length
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/training/pdf  — upload and process a PDF ───────────────────────
router.post('/pdf', auth, upload.single('file'), async (req, res) => {
  const filePath = req.file?.path

  try {
    const { botId } = req.body
    if (!botId)      return res.status(400).json({ error: 'botId is required' })
    if (!req.file)   return res.status(400).json({ error: 'No PDF file uploaded' })

    const docId  = uuidv4()
    const docName = req.file.originalname

    // Create DB record immediately (status: processing)
    await TrainingDoc.create({
      _id: docId,
      botId,
      builderId: req.user.id,
      type: 'pdf',
      name: docName,
      status: 'processing',
    })

    // Respond immediately — process in background
    res.status(202).json({
      docId,
      status: 'processing',
      message: 'PDF received. Training will complete in a few minutes.',
    })

    // Background processing
    ;(async () => {
      try {
        // 1. Extract text
        const pdfBuffer = fs.readFileSync(filePath)
        const parsed    = await pdfParse(pdfBuffer)
        const rawText   = parsed.text

        if (!rawText || rawText.trim().length < 50) {
          await TrainingDoc.findByIdAndUpdate(docId, { status: 'error' })
          return
        }

        // 2. Chunk
        const chunks = chunkText(rawText)

        // 3. Embed + store
        const count = await embedAndStore(botId, docId, chunks, docName)

        // 4. Mark ready
        await TrainingDoc.findByIdAndUpdate(docId, { status: 'ready', chunkCount: count })
      } catch (bgErr) {
        console.error('[Training PDF] background error:', bgErr.message)
        await TrainingDoc.findByIdAndUpdate(docId, { status: 'error' }).catch(() => {})
      } finally {
        // Clean up temp file
        fs.unlink(filePath, () => {})
      }
    })()

  } catch (err) {
    if (filePath) fs.unlink(filePath, () => {})
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/training/url  — crawl a URL ────────────────────────────────────
router.post('/url', auth, async (req, res) => {
  try {
    const { botId, url, name } = req.body
    if (!botId || !url) return res.status(400).json({ error: 'botId and url are required' })

    const docId   = uuidv4()
    const docName = name || url

    await TrainingDoc.create({
      _id: docId, botId,
      builderId: req.user.id,
      type: 'url',
      name: docName,
      sourceUrl: url,
      status: 'processing',
    })

    res.status(202).json({ docId, status: 'processing' })

    // Background crawl
    ;(async () => {
      try {
        const fetch  = (await import('node-fetch')).default
        const resp   = await fetch(url, { timeout: 15000 })
        const html   = await resp.text()

        // Strip HTML tags
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        const chunks = chunkText(text)
        const count  = await embedAndStore(botId, docId, chunks, docName)
        await TrainingDoc.findByIdAndUpdate(docId, { status: 'ready', chunkCount: count })
      } catch (e) {
        console.error('[Training URL] error:', e.message)
        await TrainingDoc.findByIdAndUpdate(docId, { status: 'error' }).catch(() => {})
      }
    })()

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/training/text  — paste raw text ────────────────────────────────
router.post('/text', auth, async (req, res) => {
  try {
    const { botId, text, name } = req.body
    if (!botId || !text || !name) return res.status(400).json({ error: 'botId, text, name required' })

    const docId = uuidv4()
    await TrainingDoc.create({
      _id: docId, botId,
      builderId: req.user.id,
      type: 'text', name, status: 'processing',
    })

    const chunks = chunkText(text)
    const count  = await embedAndStore(botId, docId, chunks, name)
    await TrainingDoc.findByIdAndUpdate(docId, { status: 'ready', chunkCount: count })

    res.json({ docId, status: 'ready', chunkCount: count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/training/:botId/documents  — list docs ──────────────────────────
router.get('/:botId/documents', auth, async (req, res) => {
  try {
    const docs = await TrainingDoc
      .find({ botId: req.params.botId, builderId: req.user.id })
      .sort({ createdAt: -1 })
    res.json(docs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/training/:botId/documents/:docId  ─────────────────────────────
router.delete('/:botId/documents/:docId', auth, async (req, res) => {
  try {
    const doc = await TrainingDoc.findOneAndDelete({
      _id: req.params.docId,
      botId: req.params.botId,
      builderId: req.user.id,
    })
    if (!doc) return res.status(404).json({ error: 'Document not found' })

    // Delete chunks from MongoDB
    await KnowledgeChunk.deleteMany({ docId: req.params.docId })

    // Delete from Pinecone namespace (best-effort)
    try {
      const { Pinecone } = require('@pinecone-database/pinecone')
      const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
      const index = pc.index(process.env.PINECONE_INDEX || 'propagent')
      const ns    = index.namespace(req.params.botId)
      // Get pinecone IDs for this doc
      const chunks = await KnowledgeChunk.find({ docId: req.params.docId })
      const ids    = chunks.map(c => c.pineconeId).filter(Boolean)
      if (ids.length) await ns.deleteMany(ids)
    } catch (_) {}

    res.json({ message: 'Document and all its chunks deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router