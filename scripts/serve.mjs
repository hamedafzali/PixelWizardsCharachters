// Zero-dependency static server for the demo studio. Serves the package root so
// examples/studio.html can import ../dist/index.js, then opens the browser.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = Number(process.env.PORT) || 4180
const entry = process.env.ENTRY || '/examples/studio.html'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0])
    if (path === '/') path = entry
    // keep within the package root
    const filePath = normalize(join(root, path))
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    const body = await readFile(filePath)
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
  }
})

// A port somebody chose (PORT=…, or the browser tests) is a contract: if it is
// taken, say so and stop. The default one just moves to the next free port,
// so a studio left running in another terminal does not block a new one.
const explicit = Boolean(process.env.PORT)
const TRIES = 10
let tried = 0

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err
  const busy = port + tried
  if (!explicit && ++tried < TRIES) {
    server.listen(port + tried)
    return
  }
  console.error(explicit
    ? `\n  Port ${busy} is already in use. Stop whatever holds it, or pick another: PORT=${busy + 1} npm run …\n`
    : `\n  Ports ${port}–${busy} are all in use. Pick a free one: PORT=… npm run …\n`)
  process.exit(1)
})

server.listen(port, () => {
  const url = `http://localhost:${server.address().port}${entry}`
  console.log(`\n  🎭  PixelWizardsCharachters studio → ${url}\n  (Ctrl+C to stop)\n`)
  // Headless runs (the browser smoke tests) start this server too, and must
  // not pop a window on the developer's desktop.
  if (process.env.NO_OPEN) return
  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try { spawn(opener, args, { stdio: 'ignore', detached: true }).unref() } catch { /* open manually */ }
})
