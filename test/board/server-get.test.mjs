import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/jd.md': '---\nrole: demo-role\n---\n# JD body\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
    'roles/demo-role/candidates/jane-doe/profile.md': '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nCV body\n',
    'roles/demo-role/candidates/jane-doe/evidence.md': '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nscores:\n  skill_match: 5\n---\n',
  })
}

let server
async function boot(root, userId = 'ali') {
  server = createBoardServer({ root, userId })
  await new Promise((r) => server.listen(0, r))
  return `http://localhost:${server.address().port}`
}
afterEach(() => server?.close())

describe('board GET routes', () => {
  it('GET / renders the pipeline with the candidate', async () => {
    const base = await boot(repo())
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Pipeline')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('human:ali')
  })

  it('GET /candidate/:role/:slug renders evidence + write forms', async () => {
    const base = await boot(repo())
    const html = await (await fetch(`${base}/candidate/demo-role/jane-doe`)).text()
    expect(html).toContain('Python')
    expect(html).toContain('action/decision')
    expect(html).toContain('name="sinceToken"')
  })

  it('GET /triage/:role renders the queue', async () => {
    const base = await boot(repo())
    const html = await (await fetch(`${base}/triage/demo-role`)).text()
    expect(html).toContain('Triage')
    expect(html).toContain('Jane Doe')
  })

  it('GET /role/:role and /role/:role/jd work', async () => {
    const base = await boot(repo())
    expect(await (await fetch(`${base}/role/demo-role`)).text()).toContain('drift log')
    const jd = await fetch(`${base}/role/demo-role/jd`)
    expect(jd.status).toBe(200)
    expect(await jd.text()).toContain('JD body')
  })

  it('returns 404 for an unknown candidate', async () => {
    const base = await boot(repo())
    const res = await fetch(`${base}/candidate/demo-role/ghost`)
    expect(res.status).toBe(404)
  })
})
