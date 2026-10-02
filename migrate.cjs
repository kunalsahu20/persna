/**
 * One-time migration script.
 * Reads velvet-chats from the PC browser via the Vite proxy
 * and writes it to the server's data directory.
 *
 * Run: node migrate.cjs
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')

// Read current velvet-chats.json from server
const currentFile = path.join(DATA_DIR, 'velvet-chats.json')
const current = JSON.parse(fs.readFileSync(currentFile, 'utf8'))
console.log(`Current server data: ${current.length} chats, ${current[0]?.messages?.length || 0} messages`)

// We need the PC localStorage data. Since we can't access the browser directly,
// let's create an API endpoint that the browser calls to dump its data.
// For now, create a page that the user opens on PC.

const html = `<!DOCTYPE html>
<html><head><title>Force Push Chats</title></head>
<body style="background:#111;color:#fff;font-family:monospace;padding:20px">
<h2>Force Push — Chats Migration</h2>
<pre id="log">Reading localStorage...</pre>
<script>
const log = document.getElementById('log')

async function run() {
  const raw = localStorage.getItem('velvet-chats')
  if (!raw) {
    log.textContent = 'ERROR: No velvet-chats in localStorage!'
    return
  }
  
  const chats = JSON.parse(raw)
  const totalMsgs = chats.reduce((sum, c) => sum + (c.messages?.length || 0), 0)
  log.textContent = 'Found: ' + chats.length + ' chats, ' + totalMsgs + ' total messages\\n'
  log.textContent += 'Data size: ' + raw.length + ' bytes\\n\\n'
  log.textContent += 'Pushing to server...\\n'
  
  try {
    const res = await fetch('/api/storage/velvet-chats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: raw  // Send the raw JSON string directly
    })
    const result = await res.text()
    log.textContent += 'Server response: ' + res.status + ' ' + result + '\\n\\n'
    
    // Verify
    const verify = await fetch('/api/storage/velvet-chats')
    const verifyData = await verify.json()
    const verifyMsgs = verifyData?.reduce((sum, c) => sum + (c.messages?.length || 0), 0) || 0
    log.textContent += 'VERIFIED on server: ' + (verifyData?.length || 0) + ' chats, ' + verifyMsgs + ' messages\\n'
    log.textContent += '\\n✅ Done! Now refresh your phone.'
  } catch (err) {
    log.textContent += '❌ Error: ' + err.message
  }
}

run()
<\/script>
</body></html>`

fs.writeFileSync(path.join(__dirname, 'public', 'force-push.html'), html)
console.log('\nCreated public/force-push.html')
console.log('Open http://localhost:5173/force-push.html on your PC browser')
