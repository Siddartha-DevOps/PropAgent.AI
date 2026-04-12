const express  = require('express')
const router   = express.Router()
const multer   = require('multer')
const pdfParse = require('pdf-parse')
const path     = require('path')
const fs       = require('fs')
const { v4: uuidv4 } = require('uuid')

const { authMiddleware: auth } = require('../middleware/auth')
const pineconeService = require('../services/pineconeService')

let TrainingDoc, KnowledgeChunk
try { TrainingDoc    = require('../../../models/TrainingDoc') }    catch (_) {
  try { TrainingDoc  = require('../../models/TrainingDoc') }       catch (_) { TrainingDoc = null } }
try { KnowledgeChunk = require('../../../models/Knowledgechunk') } catch (_) {
  try { KnowledgeChunk = require('../../models/Knowledgechunk') }  catch (_) { KnowledgeChunk = null } }

function getTrainingDoc() {
  if (TrainingDoc) return TrainingDoc
  const mongoose = require('mongoose')
  TrainingDoc = mongoose.models.TrainingDoc || mongoose.model('TrainingDoc', new mongoose.Schema({
    botId:      { type: String, required: true, index: true },
    builderId:  { type: String, required: true },
    type:       { type: String, enum: ['pdf','url','text'], required: true },
    name:       { type: String, required: true },
    sourceUrl:  { type: String, default: '' },
    status:     { type: String, default: 'processing', enum: ['processing','ready','error'] },
    chunkCount: { type: Number, default: 0 },
  }, { timestamps: true }))
  return TrainingDoc
}

function getChunk() {
  if (KnowledgeChunk) return KnowledgeChunk
  const mongoose = require('mongoose')
  KnowledgeChunk = mongoose.models.KnowledgeChunk || mongoose.model('KnowledgeChunk', new mongoose.Schema({
    botId:      { type: String, required: true, index: true },
    docId:      { type: String, required: true },
    content:    { type: String, required: true },
    metadata:   { type: Object, default: {} },
    pineconeId: { type: String },
  }, { timestamps: true }))
  return KnowledgeChunk
}

const upload = multer({
  dest: path.join(__dirname, '../../tmp/uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files allowed'), false)
  },
})

function chunkText(text, chunkSize = 1800, overlap = 200) {
  const clean = text.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim()
  const paragraphs = clean.split(/\n\n+/)
  const chunks = []
  let current = [], currentLen = 0
  for (const para of paragraphs) {
    if (currentLen + para.length > chunkSize && current.length > 0) {
      chunks.push(current.join('\n\n'))
      const tail = current.slice(-1).join('\n\n')
      current    = tail.length < overlap ? [tail, para] : [para]
      currentLen = current.reduce((s, p) => s + p.length, 0)
    } else {
      current.push(para)
      currentLen += para.length
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'))
  return chunks.filter(c => c.trim().length > 50)
}

async function embedAndStore(botId, docId, chunks, docName) {
  const ChunkModel = getChunk()
  const vectors    = []
  for (let i = 0; i < chunks.length; i++) {
    const content    = chunks[i]
    const pineconeId = `${botId}-${docId}-${i}`
    let embedding
    try {
      embedding = await pineconeService.getEmbedding(content)
    } catch {
      const { OpenAI } = require('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res    = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content.replace(/\n/g, ' '),
      })
      embedding = res.data[0].embedding
    }
    await ChunkModel.create({ botId, docId, content, metadata: { docName, chunkIndex: i }, pineconeId })
    vectors.push({
      id: pineconeId, values: embedding,
      metadata: { botId, docId, docName, content: content.slice(0, 500), chunkIndex: i },
    })
  }
  for (let i = 0; i < vectors.length; i += 100) {
    try {
      await pineconeService.upsertVectors(vectors.slice(i, i + 100), botId)
    } catch {
      const { Pinecone } = require('@pinecone-database/pinecone')
      const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
      const index = pc.index(process.env.PINECONE_INDEX || 'propagent')
      await index.namespace(botId).upsert(vectors.slice(i, i + 100))
    }
  }
  return vectors.length
}

// POST /api/training/pdf
router.post('/pdf', auth, upload.single('file'), async (req, res) => {
  const filePath = req.file?.path
  try {
    const { botId } = req.body
    if (!botId)    return res.status(400).json({ error: 'botId is required' })
    if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' })
    const docId    = uuidv4()
    const docName  = req.file.originalname
    const DocModel = getTrainingDoc()
    await DocModel.create({ _id: docId, botId, builderId: req.userId, type: 'pdf', name: docName, status: 'processing' })
    res.status(202).json({ docId, status: 'processing', message: 'PDF received. Training in progress.' })
    ;(async () => {
      try {
        const parsed = await pdfParse(fs.readFileSync(filePath))
        if (!parsed.text || parsed.text.trim().length < 50)
          return await DocModel.findByIdAndUpdate(docId, { status: 'error' })
        const chunks = chunkText(parsed.text)
        const count  = await embedAndStore(botId, docId, chunks, docName)
        await DocModel.findByIdAndUpdate(docId, { status: 'ready', chunkCount: count })
      } catch (e) {
        console.error('[PDF background]', e.message)
        await DocModel.findByIdAndUpdate(docId, { status: 'error' }).catch(() => {})
      } finally { fs.unlink(filePath, () => {}) }
    })()
  } catch (err) {
    if (filePath) fs.unlink(filePath, () => {})
    res.status(500).json({ error: err.message })
  }
})

// POST /api/training/url
router.post('/url', auth, async (req, res) => {
  try {
    const { botId, url, name } = req.body
    if (!botId || !url) return res.status(400).json({ error: 'botId and url required' })
    const docId    = uuidv4()
    const docName  = name || url
    const DocModel = getTrainingDoc()
    await DocModel.create({ _id: docId, botId, builderId: req.userId, type: 'url', name: docName, sourceUrl: url, status: 'processing' })
    res.status(202).json({ docId, status: 'processing' })
    ;(async () => {
      try {
        const fetch = (await import('node-fetch')).default
        const html  = await (await fetch(url, { timeout: 15000 })).text()
        const text  = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const count = await embedAndStore(botId, docId, chunkText(text), docName)
        await DocModel.findByIdAndUpdate(docId, { status: 'ready', chunkCount: count })
      } catch (e) {
        await DocModel.findByIdAndUpdate(docId, { status: 'error' }).catch(() => {})
      }
    })()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/training/text
router.post('/text', auth, async (req, res) => {
  try {
    const { botId, text, name } = req.body
    if (!botId || !text || !name) return res.status(400).json({ error: 'botId, text and name required' })
    const docId    = uuidv4()
    const DocModel = getTrainingDoc()
    await DocModel.create({ _id: docId, botId, builderId: req.userId, type: 'text', name, status: 'processing' })
    const count = await embedAndStore(botId, docId, chunkText(text), name)
    await DocModel.findByIdAndUpdate(docId, { status: 'ready', chunkCount: count })
    res.json({ docId, status: 'ready', chunkCount: count })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/training/:botId/documents
router.get('/:botId/documents', auth, async (req, res) => {
  try {
    const DocModel = getTrainingDoc()
    const docs = await DocModel.find({ botId: req.params.botId, builderId: req.userId }).sort({ createdAt: -1 })
    res.json(docs)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/training/:botId/documents/:docId
router.delete('/:botId/documents/:docId', auth, async (req, res) => {
  try {
    const DocModel   = getTrainingDoc()
    const ChunkModel = getChunk()
    const doc = await DocModel.findOneAndDelete({ _id: req.params.docId, botId: req.params.botId, builderId: req.userId })
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    await ChunkModel.deleteMany({ docId: req.params.docId })
    try {
      const chunks = await ChunkModel.find({ docId: req.params.docId })
      const ids    = chunks.map(c => c.pineconeId).filter(Boolean)
      if (ids.length) {
        const { Pinecone } = require('@pinecone-database/pinecone')
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
        await pc.index(process.env.PINECONE_INDEX || 'propagent').namespace(req.params.botId).deleteMany(ids)
      }
    } catch (_) {}
    res.json({ message: 'Document deleted' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router