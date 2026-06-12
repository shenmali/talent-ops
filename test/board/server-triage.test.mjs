import { describe, it, expect, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  const files = { 'roles/r/role-contract.md': approvedContract }
  for (const slug of ['a', 'b']) {
    files[`roles/r/candidates/${slug}/profile.md`] = `---\nname: ${slug}\napplied_at: 2026-06-01\n---\nb\n`
    files[`roles/r/candidates/${slug}/evidence.md`] = '---\nclaims: []\n---\n'
    files[`roles/r/candidates/${slug}/score.md`] = '---\nweighted_total: 3.0\nconfidence: medium\nrecommendation: hold\nmissing_evidence: []\n---\n'
  }
  return makeRepo(files)
}
let server
async function boot(root) {
  server = createBoardServer({ root, userId: 'ali' })
  await new Promise((r) => server.listen(0, r))
  return `http://localhost:${server.address().port}`
}
afterEach(() => server?.close())

function postForm(base, path, pairs) {
  const body = new URLSearchParams()
  for (const [k, v] of pairs) body.append(k, v)
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'manual' })
}

describe('POST /action/triage-reject', () => {
  it('refuses without the anti-miss confirmation and writes nothing', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/triage-reject', [['role', 'r'], ['reason_code', 'stronger-shortlist'], ['slug', 'a'], ['slug', 'b']])
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=anti-miss-unconfirmed')
    expect(existsSync(join(root, 'roles/r/candidates/a/decision.md'))).toBe(false)
  })

  it('rejects the selected candidates when confirmed', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/triage-reject', [['role', 'r'], ['reason_code', 'stronger-shortlist'], ['antiMissConfirmed', 'yes'], ['slug', 'a'], ['slug', 'b']])
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/triage/r')
    expect(existsSync(join(root, 'roles/r/candidates/a/decision.md'))).toBe(true)
    expect(existsSync(join(root, 'roles/r/candidates/b/decision.md'))).toBe(true)
  })
})
