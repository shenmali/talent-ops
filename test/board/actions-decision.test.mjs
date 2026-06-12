import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { applyDecision } from '../../board/lib/actions.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/candidates/jane-doe/profile.md': '---\nname: Jane Doe\napplied_at: 2026-06-01\n---\nb\n',
    'roles/demo-role/candidates/jane-doe/evidence.md': '---\nclaims: []\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\n---\n',
  })
}
const decPath = (root) => join(root, 'roles/demo-role/candidates/jane-doe/decision.md')
const fm = (root) => parseFrontmatter(readFileSync(decPath(root), 'utf8')).data

describe('applyDecision', () => {
  it('writes a human-stamped decision and rebuilds the tracker', () => {
    const root = repo()
    const r = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'advanced',
      reasonCode: '', reasonDetail: 'strong', userId: 'ali',
      sinceToken: 'absent', now: new Date('2026-06-11'),
    })
    expect(r.ok).toBe(true)
    expect(fm(root).decided_by).toBe('human:ali')
    expect(fm(root).decision).toBe('advanced')
    expect(fm(root).ai_recommendation).toBe('advance')
    expect(readFileSync(join(root, 'data/tracker.md'), 'utf8')).toMatch(/jane-doe \| demo-role \| interview/)
  })

  it('refuses to stamp an AI identity', () => {
    const root = repo()
    const r = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'advanced',
      reasonCode: '', userId: 'ai:claude', sinceToken: 'absent',
    })
    expect(r).toEqual({ ok: false, error: 'ai-identity' })
    expect(existsSync(decPath(root))).toBe(false)
  })

  it('requires a valid reason_code for terminal decisions', () => {
    const root = repo()
    const bad = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'rejected',
      reasonCode: '', userId: 'ali', sinceToken: 'absent',
    })
    expect(bad).toEqual({ ok: false, error: 'reason-required' })
    const bogus = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'rejected',
      reasonCode: 'felt-wrong', userId: 'ali', sinceToken: 'absent',
    })
    expect(bogus).toEqual({ ok: false, error: 'reason-invalid' })
    expect(existsSync(decPath(root))).toBe(false)
  })

  it('computes override via the alignment table, not string equality', () => {
    const root = repo()
    // recommendation=advance ; decision=advanced → aligned → override false
    applyDecision(root, { role: 'demo-role', slug: 'jane-doe', decision: 'advanced', reasonCode: '', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11') })
    expect(fm(root).override).toBe(false)
  })

  it('flags override true when the human diverges from the recommendation', () => {
    const root = repo()
    // recommendation=advance ; decision=rejected → not aligned → override true
    const r = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'rejected',
      reasonCode: 'stronger-shortlist', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11'),
    })
    expect(r.ok).toBe(true)
    expect(fm(root).override).toBe(true)
  })

  it('refuses on a stale sinceToken (conflict)', () => {
    const root = repo()
    // first write creates decision.md
    applyDecision(root, { role: 'demo-role', slug: 'jane-doe', decision: 'advanced', reasonCode: '', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11') })
    // second write with the now-stale 'absent' token must conflict
    const r = applyDecision(root, { role: 'demo-role', slug: 'jane-doe', decision: 'interviewing', reasonCode: '', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11') })
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})
