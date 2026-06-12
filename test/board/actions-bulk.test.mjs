import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { bulkReject } from '../../board/lib/actions.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  const files = { 'roles/r/role-contract.md': approvedContract }
  for (const slug of ['a', 'b', 'c']) {
    files[`roles/r/candidates/${slug}/profile.md`] = `---\nname: ${slug}\napplied_at: 2026-06-01\n---\nb\n`
    files[`roles/r/candidates/${slug}/evidence.md`] = '---\nclaims: []\n---\n'
    files[`roles/r/candidates/${slug}/score.md`] = '---\nweighted_total: 3.0\nconfidence: medium\nrecommendation: hold\nmissing_evidence: []\n---\n'
  }
  return makeRepo(files)
}
const decExists = (root, slug) => existsSync(join(root, `roles/r/candidates/${slug}/decision.md`))

describe('bulkReject', () => {
  it('rejects the selected candidates with the reason code, leaves others untouched', () => {
    const root = repo()
    const r = bulkReject(root, { role: 'r', slugs: ['a', 'c'], reasonCode: 'stronger-shortlist', userId: 'ali', now: new Date('2026-06-11') })
    expect(r.ok).toBe(true)
    expect(r.rejected.sort()).toEqual(['a', 'c'])
    expect(decExists(root, 'a')).toBe(true)
    expect(decExists(root, 'c')).toBe(true)
    expect(decExists(root, 'b')).toBe(false)
  })

  it('refuses an invalid reason code', () => {
    const root = repo()
    expect(bulkReject(root, { role: 'r', slugs: ['a'], reasonCode: 'felt-wrong', userId: 'ali' })).toEqual({ ok: false, error: 'reason-invalid' })
  })

  it('refuses an AI identity', () => {
    const root = repo()
    expect(bulkReject(root, { role: 'r', slugs: ['a'], reasonCode: 'stronger-shortlist', userId: 'ai:x' })).toEqual({ ok: false, error: 'ai-identity' })
  })

  it('refuses an empty selection', () => {
    const root = repo()
    expect(bulkReject(root, { role: 'r', slugs: [], reasonCode: 'stronger-shortlist', userId: 'ali' })).toEqual({ ok: false, error: 'no-selection' })
  })

  it('skips a candidate that already has a decision (conflict), still rejects the rest', () => {
    const root = repo()
    bulkReject(root, { role: 'r', slugs: ['a'], reasonCode: 'stronger-shortlist', userId: 'ali', now: new Date('2026-06-11') })
    const r = bulkReject(root, { role: 'r', slugs: ['a', 'b'], reasonCode: 'stronger-shortlist', userId: 'ali', now: new Date('2026-06-11') })
    expect(r.rejected).toEqual(['b'])
    expect(r.skipped).toEqual([{ slug: 'a', error: 'conflict' }])
  })
})
