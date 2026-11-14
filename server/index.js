import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyze } from './ai.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'studysage-ai', ai: 'local-rule-based', version: '1.0.0' })
})

app.post('/api/analyze', (req, res) => {
  const { text } = req.body || {}
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Send JSON { "text": "your notes..." }.' })
  }
  try {
    res.json(analyze(text))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// In production, serve the built Vite frontend from dist/.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Frontend not built yet — run npm run build.' })
  })
})

app.listen(PORT, () => {
  console.log(`StudySage AI server running on http://localhost:${PORT}`)
  console.log('AI: local, rule-based — no external API, no key needed.')
})
