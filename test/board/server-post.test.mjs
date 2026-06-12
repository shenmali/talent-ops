import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createBoardServer } from '../../board/server.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/jane/profile.md': '---\nname: Jane\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/jane/evidence.md': '---\nclaims: []\n---\n',
    'roles/r/candidates/jane/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\n---\n',
  })
}
let server
async function boot(root, userId = 'ali') {
  server = createBoardServer({ root, userId })
  await new Promise((r) => server.listen(0, r))
  return `http://localhost:${server.address().port}`
}
afterEach(() => server?.close())

function postForm(base, path, fields) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  })
}

describe('board POST /action', () => {
  it('records a decision and 303-redirects to the candidate page', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/decision', {
      role: 'r', slug: 'jane', decision: 'advanced', reason_code: '', reason_detail: 'ok', sinceToken: 'absent',
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/candidate/r/jane')
    const dec = parseFrontmatter(readFileSync(join(root, 'roles/r/candidates/jane/decision.md'), 'utf8')).data
    expect(dec.decided_by).toBe('human:ali') // userId from server, not form
    expect(dec.decision).toBe('advanced')
  })

  it('redirects with ?error=conflict on a stale token and writes nothing', async () => {
    const root = repo()
    const base = await boot(root)
    // create decision first
    await postForm(base, '/action/decision', { role: 'r', slug: 'jane', decision: 'advanced', reason_code: '', sinceToken: 'absent' })
    // second with stale 'absent' → conflict
    const res = await postForm(base, '/action/decision', { role: 'r', slug: 'jane', decision: 'interviewing', reason_code: '', sinceToken: 'absent' })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=conflict')
  })

  it('ignores a form-supplied userId and always stamps the server identity', async () => {
    const root = repo()
    const base = await boot(root, 'ali')
    await postForm(base, '/action/decision', {
      role: 'r', slug: 'jane', decision: 'advanced', reason_code: '', sinceToken: 'absent',
      userId: 'ai:evil', decided_by: 'ai:evil', // attacker-controlled fields — must be ignored
    })
    const dec = parseFrontmatter(readFileSync(join(root, 'roles/r/candidates/jane/decision.md'), 'utf8')).data
    expect(dec.decided_by).toBe('human:ali')
  })

  it('changes stage via POST', async () => {
    const root = repo()
    const base = await boot(root)
    const token = fileToken(join(root, 'roles/r/candidates/jane/profile.md'))
    const res = await postForm(base, '/action/stage', { role: 'r', slug: 'jane', toStage: 'triage', sinceToken: token })
    expect(res.status).toBe(303)
    expect(parseFrontmatter(readFileSync(join(root, 'roles/r/candidates/jane/profile.md'), 'utf8')).data.stage).toBe('triage')
  })

  it('redirects gracefully (no hang) when role/slug are missing', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/decision', { decision: 'advanced', sinceToken: 'absent' })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=bad-request')
  })
})
