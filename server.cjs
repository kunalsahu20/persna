/**
 * Storage API Server
 *
 * Stores app data as JSON files on disk.
 * Both PC and phone browsers read/write through this API.
 */

const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json({ limit: '50mb' }))

const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

/** Sanitize key to prevent path traversal */
function safeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function filePath(key) {
  return path.join(DATA_DIR, safeKey(key) + '.json')
}

// ── Request logging ──
app.use('/api', (req, _res, next) => {
  const size = req.headers['content-length'] || '0'
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} (${size} bytes) from ${req.ip}`)
  next()
})

// GET /api/storage/:key — read a single key
app.get('/api/storage/:key', (req, res) => {
  try {
    const fp = filePath(req.params.key)
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf8')
      console.log(`  → returning ${req.params.key}: ${content.length} bytes`)
      res.type('json').send(content)
    } else {
      console.log(`  → ${req.params.key}: not found`)
      res.json(null)
    }
  } catch (e) {
    console.log(`  → ERROR reading ${req.params.key}: ${e.message}`)
    res.json(null)
  }
})

// PUT /api/storage/:key — write a single key
app.put('/api/storage/:key', (req, res) => {
  try {
    const data = JSON.stringify(req.body)
    fs.writeFileSync(filePath(req.params.key), data)
    console.log(`  → saved ${req.params.key}: ${data.length} bytes`)
    res.json({ ok: true })
  } catch (err) {
    console.log(`  → ERROR saving ${req.params.key}: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/storage/:key — delete a single key
app.delete('/api/storage/:key', (req, res) => {
  try { fs.unlinkSync(filePath(req.params.key)) } catch {}
  console.log(`  → deleted ${req.params.key}`)
  res.json({ ok: true })
})

// GET /api/storage — get ALL keys+values at once (for initial sync)
app.get('/api/storage', (_req, res) => {
  const result = {}
  try {
    for (const file of fs.readdirSync(DATA_DIR)) {
      if (!file.endsWith('.json')) continue
      const key = file.replace('.json', '')
      try {
        result[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
      } catch {}
    }
  } catch {}
  const keys = Object.keys(result)
  console.log(`  → returning ALL: ${keys.length} keys [${keys.join(', ')}]`)
  res.json(result)
})

// POST /api/sync — bulk write (for migration)
app.post('/api/sync', (req, res) => {
  try {
    const entries = req.body
    if (entries && typeof entries === 'object') {
      for (const [key, value] of Object.entries(entries)) {
        fs.writeFileSync(filePath(key), JSON.stringify(value))
      }
    }
    console.log(`  → bulk saved ${Object.keys(entries || {}).length} keys`)
    res.json({ ok: true, count: Object.keys(entries || {}).length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = 3001
app.listen(PORT, '0.0.0.0', () => {
  // Show current data summary on startup
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  console.log(`\n💾 Storage API running on http://0.0.0.0:${PORT}`)
  console.log(`   Data directory: ${DATA_DIR}`)
  console.log(`   Existing files: ${files.length}`)
  for (const f of files) {
    const size = fs.statSync(path.join(DATA_DIR, f)).size
    console.log(`     ${f} (${size} bytes)`)
  }
  console.log()
})
