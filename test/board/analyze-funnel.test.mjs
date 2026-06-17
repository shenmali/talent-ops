import { describe, it, expect } from 'vitest'
import { analyzeFunnel } from '../../scripts/analyze-funnel.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

// 4 candidates: 1 parsed, 1 screened, 2 decided (1 rejected no-override,
// 1 advanced override). Two sources.
function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/p/profile.md': '---\nname: P\nsource: "inbound:p.txt"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/s/profile.md': '---\nname: S\nsource: "inbound:s.txt"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/s/score.md': '---\nweighted_total: 4\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
    'roles/r/candidates/d1/profile.md': '---\nname: D1\nsource: "csv:applicants.csv"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/d1/score.md': '---\nweighted_total: 2\nconfidence: low\nrecommendation: reject-suggest\nscored_at: 2026-06-02\n---\n',
    'roles/r/candidates/d1/decision.md': '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:ali\noverride: false\ndecided_at: 2026-06-05\n---\n',
    'roles/r/candidates/d2/profile.md': '---\nname: D2\nsource: "csv:applicants.csv"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/d2/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
    'roles/r/candidates/d2/decision.md': '---\ndecision: rejected\nreason_code: stronger-shortlist\ndecided_by: human:ali\noverride: true\ndecided_at: 2026-06-07\n---\n',
  })
}

describe('analyzeFunnel', () => {
  it('counts the funnel by stage', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.total).toBe(4)
    expect(a.funnel.parsed).toBe(1)
    expect(a.funnel.screened).toBe(1)
    expect(a.funnel.rejected).toBe(2)
  })
  it('distributes reason codes for terminal decisions', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.reasonCodes['insufficient-evidence']).toBe(1)
    expect(a.reasonCodes['stronger-shortlist']).toBe(1)
  })
  it('computes the override rate over decided candidates', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.overrideRate.decided).toBe(2)
    expect(a.overrideRate.overrides).toBe(1)
    expect(a.overrideRate.ratePct).toBe(50)
  })
  it('breaks down source -> qualified (screened and beyond)', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    // inbound:s.txt -> screened (qualified); inbound:p.txt -> parsed (not)
    // csv -> 2 rejected (were screened-then-decided; qualified = reached screened+)
    expect(a.source['inbound:s.txt'].total).toBe(1)
    expect(a.source['inbound:s.txt'].qualified).toBe(1)
    expect(a.source['inbound:p.txt'].qualified).toBe(0)
  })
  it('always includes a fairness disclaimer (not a protected-class audit)', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.fairnessSignals.disclaimer).toMatch(/not.*protected-class|protected nitelik|NOT a protected/i)
    expect(typeof a.fairnessSignals.disclaimer).toBe('string')
  })
})
