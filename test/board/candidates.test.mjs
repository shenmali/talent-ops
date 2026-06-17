import { describe, it, expect } from 'vitest'
import { deriveStage, deriveUpdatedAt, collectCandidates } from '../../scripts/lib/candidates.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

describe('deriveStage', () => {
  const states = { stages: ['inbox','parsed','screened','triage','interview','decision','hired','rejected','withdrawn'], terminal: ['hired','rejected','withdrawn'], decisions: { advanced: 'interview', interviewing: 'interview', offer: 'decision', hired: 'hired', rejected: 'rejected', withdrawn: 'withdrawn' } }
  it('decision wins over everything', () => {
    expect(deriveStage(states, { decision: { decision: 'rejected' }, stageOverride: 'triage', hasScore: true, hasProfile: true })).toBe('rejected')
  })
  it('non-terminal stage override beats score', () => {
    expect(deriveStage(states, { decision: null, stageOverride: 'triage', hasScore: true, hasProfile: true })).toBe('triage')
  })
  it('terminal stage override is ignored', () => {
    expect(deriveStage(states, { decision: null, stageOverride: 'rejected', hasScore: true, hasProfile: true })).toBe('screened')
  })
  it('score -> screened, profile -> parsed', () => {
    expect(deriveStage(states, { decision: null, stageOverride: undefined, hasScore: true, hasProfile: true })).toBe('screened')
    expect(deriveStage(states, { decision: null, stageOverride: undefined, hasScore: false, hasProfile: true })).toBe('parsed')
  })
})

describe('deriveUpdatedAt', () => {
  it('prefers decided_at, then scored_at, then applied_at', () => {
    expect(deriveUpdatedAt({ decision: { decided_at: '2026-06-04' }, score: { scored_at: '2026-06-02' }, profile: { applied_at: '2026-06-01' } })).toBe('2026-06-04')
    expect(deriveUpdatedAt({ decision: null, score: { scored_at: '2026-06-02' }, profile: { applied_at: '2026-06-01' } })).toBe('2026-06-02')
    expect(deriveUpdatedAt({ decision: null, score: null, profile: { applied_at: '2026-06-01' } })).toBe('2026-06-01')
    expect(deriveUpdatedAt({ decision: null, score: null, profile: {} })).toBe(null)
  })
})

describe('collectCandidates', () => {
  function repo() {
    return makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      'roles/demo-role/candidates/jane/profile.md': '---\nname: Jane\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nb\n',
      'roles/demo-role/candidates/jane/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
      'roles/demo-role/candidates/bob/profile.md': '---\nname: Bob\nsource: "csv:applicants.csv"\napplied_at: 2026-06-01\n---\nb\n',
      'roles/demo-role/candidates/bob/score.md': '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: reject-suggest\nscored_at: 2026-06-03\n---\n',
      'roles/demo-role/candidates/bob/decision.md': '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:ali\noverride: false\ndecided_at: 2026-06-04\n---\n',
    })
  }
  it('normalizes each candidate with stage, updatedAt, source and outcome fields', () => {
    const root = repo()
    const states = loadStates(root)
    const list = collectCandidates(root, states).sort((a, b) => a.slug.localeCompare(b.slug))
    expect(list).toHaveLength(2)
    const bob = list.find((c) => c.slug === 'bob')
    expect(bob.role).toBe('demo-role')
    expect(bob.stage).toBe('rejected')
    expect(bob.updatedAt).toBe('2026-06-04')
    expect(bob.source).toBe('csv:applicants.csv')
    expect(bob.reasonCode).toBe('insufficient-evidence')
    expect(bob.override).toBe(false)
    const jane = list.find((c) => c.slug === 'jane')
    expect(jane.stage).toBe('screened')
    expect(jane.updatedAt).toBe('2026-06-02')
    expect(jane.weightedTotal).toBe(4.3)
    expect(jane.recommendation).toBe('advance')
    expect(jane.decision).toBe(null)
  })
  it('filters by role when a roleFilter is given', () => {
    const root = makeRepo({
      'roles/r1/role-contract.md': approvedContract,
      'roles/r1/candidates/a/profile.md': '---\nname: A\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r2/role-contract.md': approvedContract,
      'roles/r2/candidates/b/profile.md': '---\nname: B\napplied_at: 2026-06-01\n---\nb\n',
    })
    const states = loadStates(root)
    expect(collectCandidates(root, states, 'r1').map((c) => c.slug)).toEqual(['a'])
  })
})
