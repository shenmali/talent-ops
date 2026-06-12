// board/server.mjs — Talent-Ops local board (zero-build, zero runtime dep).
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

export function createBoardServer({ root = process.cwd(), userId = 'unknown' } = {}) {
  return createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><title>talent-ops board</title><p>boot ok</p>')
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 4319
  const server = createBoardServer({ root: process.cwd() })
  server.listen(port, () => {
    console.log(`talent-ops board → http://localhost:${port}`)
  })
}
