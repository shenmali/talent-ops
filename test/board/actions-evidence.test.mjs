import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { markEvidence } from '../../board/lib/actions.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/jane/profile.md': '---\nname: Jane\n---\nb\n',
    'roles/r/candidates/jane/evidence.md':
      '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo X"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n  - claim: SQL\n    source: cv\n    evidence: ""\n    evidence_type: none\n    confidence: none\n    status: unverified\n    note: ""\n---\n',
  })
}
const evPath = (root) => join(root, 'roles/r/candidates/jane/evidence.md')
const claims = (root) => parseFrontmatter(readFileSync(evPath(root), 'utf8')).data.claims

describe('markEvidence', () => {
  it('sets a claim status to human-confirmed', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 0, status: 'human-confirmed', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r.ok).toBe(true)
    expect(claims(root)[0].status).toBe('human-confirmed')
    expect(claims(root)[1].status).toBe('unverified') // others untouched
  })

  it('sets a claim status to contradicted', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 1, status: 'contradicted', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r.ok).toBe(true)
    expect(claims(root)[1].status).toBe('contradicted')
  })

  it('refuses a status outside the human-allowed set', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 0, status: 'ai-inferred', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r).toEqual({ ok: false, error: 'status-invalid' })
  })

  it('refuses an out-of-range claim index', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 9, status: 'human-confirmed', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r).toEqual({ ok: false, error: 'claim-index' })
  })

  it('refuses on a stale token (conflict)', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 0, status: 'human-confirmed', userId: 'ali', sinceToken: 'stale' })
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})
