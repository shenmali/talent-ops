import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { changeStage, addNote } from '../../board/lib/actions.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/jane/profile.md': '---\nname: Jane\napplied_at: 2026-06-01\n---\nCV body\n',
    'roles/r/candidates/jane/evidence.md': '---\nclaims: []\n---\n',
    'roles/r/candidates/jane/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nmissing_evidence: []\n---\n',
  })
}
const profPath = (root) => join(root, 'roles/r/candidates/jane/profile.md')

describe('changeStage', () => {
  it('writes a non-terminal stage override onto the profile and rebuilds the tracker', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'triage', userId: 'ali', sinceToken: token, now: new Date('2026-06-11') })
    expect(r.ok).toBe(true)
    expect(parseFrontmatter(readFileSync(profPath(root), 'utf8')).data.stage).toBe('triage')
    expect(readFileSync(join(root, 'data/tracker.md'), 'utf8')).toMatch(/jane \| r \| triage/)
  })

  it('refuses a move to a terminal stage', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'rejected', userId: 'ali', sinceToken: token })
    expect(r).toEqual({ ok: false, error: 'terminal-stage' })
  })

  it('refuses an unknown stage', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'flying', userId: 'ali', sinceToken: token })
    expect(r).toEqual({ ok: false, error: 'stage-invalid' })
  })

  it('refuses on a stale token (conflict)', () => {
    const root = repo()
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'triage', userId: 'ali', sinceToken: 'stale-token' })
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})

describe('addNote', () => {
  it('appends a timestamped human note to the profile body', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = addNote(root, { role: 'r', slug: 'jane', text: 'Called, available from July', userId: 'ali', sinceToken: token, now: new Date('2026-06-11') })
    expect(r.ok).toBe(true)
    const txt = readFileSync(profPath(root), 'utf8')
    expect(txt).toMatch(/## Notes/)
    expect(txt).toMatch(/human:ali/)
    expect(txt).toMatch(/Called, available from July/)
    expect(txt).toMatch(/CV body/) // original body preserved
  })
})
