# ─── PropAgent.AI — New Dependencies for RAG System ─────────────────────────
# Run this command from your /backend directory:

npm install openai pdf-parse mammoth multer @anthropic-ai/sdk

# ─── What each package does ───────────────────────────────────────────────────

# openai
#   Used ONLY for text embedding (text-embedding-3-small model).
#   ragService.js calls the OpenAI Embeddings API to convert text chunks
#   and visitor queries into 1536-dimensional vectors for similarity search.
#   Cost: ~$0.02 per 1 million tokens — extremely cheap.

# pdf-parse
#   Extracts plain text from uploaded PDF files.
#   Used inside ragService.extractTextFromFile() for .pdf uploads.

# mammoth
#   Extracts plain text from DOCX (Microsoft Word) files.
#   Used inside ragService.extractTextFromFile() for .docx uploads.

# multer
#   Handles multipart/form-data file uploads in Express.
#   Used in training.js routes to receive uploaded files and
#   save them temporarily to /backend/tmp/uploads/ before processing.

# @anthropic-ai/sdk
#   Official Anthropic SDK — used by claudeAgent.js to call Claude.
#   May already be installed. Add if not present.

# ─── Updated package.json dependencies section ────────────────────────────────
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0",
    "mammoth": "^1.7.0",
    "mongoose": "^8.0.0",
    "multer": "^1.4.5",
    "nodemailer": "^6.9.0",
    "openai": "^4.47.0",
    "pdf-parse": "^1.1.1"
  }
}

# ─── Create the tmp/uploads directory ────────────────────────────────────────
# The training.js route auto-creates this, but you can pre-create it:
mkdir -p backend/tmp/uploads
echo "tmp/" >> backend/.gitignore