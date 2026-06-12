// board/server.mjs — Talent-Ops local board (zero-build, zero runtime dep).
import { createServer } from 'node:http'
import { readFileSync, existsSync, watch } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { buildModel, loadCandidate, triageQueue } from './lib/model.mjs'
import { applyDecision, changeStage, markEvidence, addNote, bulkReject } from './lib/actions.mjs'
import { renderPage, renderPipeline, renderCandidate, renderTriage, renderRole } from './lib/render.mjs'
import { loadStates } from '../scripts/lib/states.mjs'
import { fileToken } from '../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const HERE = join(fileURLToPath(import.meta.url), '..')
const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': type })
  res.end(body)
}
const page = (res, status, title, body, userId) => send(res, status, renderPage({ title, body, userId }))

function serveStatic(res, name) {
  const file = join(HERE, 'public', name)
  if (!name || name.includes('..') || !existsSync(file)) return send(res, 404, 'not found', 'text/plain')
  send(res, 200, readFileSync(file), MIME[extname(name)] || 'application/octet-stream')
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(new URLSearchParams(data)))
  })
}

export function createBoardServer({ root = process.cwd(), userId = 'unknown' } = {}) {
  const clients = new Set()
  function broadcast(msg) {
    for (const res of clients) res.write(`data: ${msg}\n\n`)
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain')

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write('data: connected\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    if (parts[0] === 'public') return serveStatic(res, parts[1])

    if (req.method === 'POST' && parts[0] === 'action' && parts[1]) {
      try {
        const form = await readBody(req)
        const role = form.get('role')
        const slug = form.get('slug')
        const sinceToken = form.get('sinceToken')
        // slug-based actions need both; triage-reject (added later) handles its own missing-slug case
        if (parts[1] !== 'triage-reject' && (!role || !slug)) {
          res.writeHead(303, { location: '/?error=bad-request' })
          return res.end()
        }
        const dest = `/candidate/${role}/${slug}`
        let result
        // userId ALWAYS from the server config — never from the form
        if (parts[1] === 'decision') {
          result = applyDecision(root, { role, slug, decision: form.get('decision'), reasonCode: form.get('reason_code'), reasonDetail: form.get('reason_detail') || '', userId, sinceToken })
        } else if (parts[1] === 'stage') {
          result = changeStage(root, { role, slug, toStage: form.get('toStage'), userId, sinceToken })
        } else if (parts[1] === 'evidence') {
          result = markEvidence(root, { role, slug, claimIndex: form.get('claimIndex'), status: form.get('status'), userId, sinceToken })
        } else if (parts[1] === 'note') {
          result = addNote(root, { role, slug, text: form.get('text'), userId, sinceToken })
        } else if (parts[1] === 'triage-reject') {
          const tdest = `/triage/${role}`
          if (form.get('antiMissConfirmed') !== 'yes') {
            res.writeHead(303, { location: `${tdest}?error=anti-miss-unconfirmed` })
            return res.end()
          }
          const r = bulkReject(root, { role, slugs: form.getAll('slug'), reasonCode: form.get('reason_code'), userId })
          res.writeHead(303, { location: r.ok ? `${tdest}?rejected=${r.rejected.length}` : `${tdest}?error=${encodeURIComponent(r.error)}` })
          return res.end()
        } else {
          return send(res, 404, 'unknown action', 'text/plain')
        }
        const location = result.ok ? dest : `${dest}?error=${encodeURIComponent(result.error)}`
        res.writeHead(303, { location })
        return res.end()
      } catch {
        res.writeHead(303, { location: '/?error=server-error' })
        return res.end()
      }
    }

    if (req.method === 'GET') {
      try {
        if (url.pathname === '/') {
          return page(res, 200, 'Pipeline', renderPipeline(buildModel(root)), userId)
        }
        if (parts[0] === 'role' && parts[1] && parts[2] === 'jd') {
          const jd = join(root, 'roles', parts[1], 'jd.md')
          if (!existsSync(jd)) return send(res, 404, 'no JD', 'text/plain')
          return page(res, 200, 'JD', `<h1>JD — ${parts[1]}</h1><pre>${readFileSync(jd, 'utf8').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`, userId)
        }
        if (parts[0] === 'role' && parts[1]) {
          const role = buildModel(root).roles.find((r) => r.slug === parts[1])
          if (!role) return send(res, 404, 'no role', 'text/plain')
          const cPath = join(root, 'roles', parts[1], 'role-contract.md')
          const body = existsSync(cPath) ? parseFrontmatter(readFileSync(cPath, 'utf8')).body : ''
          return page(res, 200, role.title, renderRole(role, body), userId)
        }
        if (parts[0] === 'triage' && parts[1]) {
          const model = buildModel(root)
          const role = model.roles.find((r) => r.slug === parts[1])
          if (!role) return send(res, 404, 'no role', 'text/plain')
          const states = loadStates(root)
          return page(res, 200, 'Triage', renderTriage(role, triageQueue(role, states), states, { userId }), userId)
        }
        if (parts[0] === 'candidate' && parts[1] && parts[2]) {
          const cdir = join(root, 'roles', parts[1], 'candidates', parts[2])
          if (!existsSync(join(cdir, 'profile.md'))) return send(res, 404, 'no candidate', 'text/plain')
          const detail = loadCandidate(root, parts[1], parts[2])
          const tokens = {
            decision: fileToken(join(cdir, 'decision.md')),
            profileToken: fileToken(join(cdir, 'profile.md')),
            evidence: fileToken(join(cdir, 'evidence.md')),
          }
          return page(res, 200, detail.name, renderCandidate(detail, loadStates(root), { tokens, userId }), userId)
        }
        return send(res, 404, 'not found', 'text/plain')
      } catch (err) {
        return send(res, 500, `board error: ${err.message}`, 'text/plain')
      }
    }
    return send(res, 405, 'method not allowed', 'text/plain')
  })
  const watchers = []
  for (const dir of ['roles', 'data']) {
    const p = join(root, dir)
    if (existsSync(p)) {
      try {
        watchers.push(watch(p, { recursive: true }, () => broadcast('reload')))
      } catch {
        // recursive watch unsupported on some platforms — board still works, just no live refresh
      }
    }
  }
  server.on('close', () => {
    for (const w of watchers) w.close()
    for (const res of clients) res.end()
    clients.clear()
  })

  return server
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd()
  const cfgPath = join(root, 'config/company-profile.yml')
  const userId = existsSync(cfgPath) ? (parseYaml(readFileSync(cfgPath, 'utf8'))?.user?.id ?? 'unknown') : 'unknown'
  const port = Number(process.env.PORT) || 4319
  const server = createBoardServer({ root, userId })
  server.listen(port, () => console.log(`talent-ops board → http://localhost:${port} (acting as human:${userId})`))
}
