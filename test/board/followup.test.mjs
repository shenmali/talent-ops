import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCadence, collectFollowups } from '../../scripts/followup.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

describe('loadCadence', () => {
  it('returns defaults when no config', () => {
    const root = makeRepo({})
    expect(loadCadence(root)).toEqual({ screened: 5, interview: 7, offer: 5 })
  })
  it('merges config overrides over defaults', () => {
    const root = makeRepo({
      'config/company-profile.yml': 'user:\n  id: ali\ncadence:\n  interview: 3\n',
    })
    expect(loadCadence(root)).toEqual({ screened: 5, interview: 3, offer: 5 })
  })
})

describe('collectFollowups', () => {
  // jane: screened, scored 8 days ago -> awaiting triage, overdue (>5)
  // tom: interview (advanced), decided 2 days ago -> awaiting decision, waiting (<7)
  // ozge: offer, decided 6 days ago -> awaiting candidate-response, overdue (>5)
  // ali: rejected -> terminal, not a followup
  function repo() {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/jane/profile.md': '---\nname: Jane\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/jane/score.md': '---\nweighted_total: 4\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
      'roles/r/candidates/tom/profile.md': '---\nname: Tom\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/tom/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nscored_at: 2026-06-03\n---\n',
      'roles/r/candidates/tom/decision.md': '---\ndecision: advanced\nreason_code: ""\ndecided_by: human:ali\ndecided_at: 2026-06-08\n---\n',
      'roles/r/candidates/ozge/profile.md': '---\nname: Ozge\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/ozge/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
      'roles/r/candidates/ozge/decision.md': '---\ndecision: offer\nreason_code: ""\ndecided_by: human:ali\ndecided_at: 2026-06-04\n---\n',
      'roles/r/candidates/ali/profile.md': '---\nname: Ali\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/ali/score.md': '---\nweighted_total: 2\nconfidence: low\nrecommendation: reject-suggest\nscored_at: 2026-06-02\n---\n',
      'roles/r/candidates/ali/decision.md': '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:ali\ndecided_at: 2026-06-03\n---\n',
    })
    return root
  }
  const now = new Date('2026-06-10')

  it('flags screened (triage), interview (decision), offer (candidate-response); skips terminal', () => {
    const fu = collectFollowups(repo(), { now })
    const bySlug = Object.fromEntries(fu.map((f) => [f.slug, f]))
    expect(bySlug.jane.waitingFor).toBe('triage')
    expect(bySlug.jane.daysWaiting).toBe(8)
    expect(bySlug.jane.urgency).toBe('overdue') // 8 > 5
    expect(bySlug.tom.waitingFor).toBe('decision')
    expect(bySlug.tom.daysWaiting).toBe(2)
    expect(bySlug.tom.urgency).toBe('waiting') // 2 < 7
    expect(bySlug.ozge.waitingFor).toBe('candidate-response')
    expect(bySlug.ozge.urgency).toBe('overdue') // 6 > 5
    expect(bySlug.ali).toBeUndefined() // terminal rejected, not a followup
  })

  it('sorts overdue first, then by daysWaiting desc', () => {
    const fu = collectFollowups(repo(), { now })
    expect(fu[0].urgency).toBe('overdue')
    // jane(8) before ozge(6) among overdue
    const overdue = fu.filter((f) => f.urgency === 'overdue').map((f) => f.slug)
    expect(overdue).toEqual(['jane', 'ozge'])
  })

  it('honors a custom cadence', () => {
    const fu = collectFollowups(repo(), { now, cadence: { screened: 10, interview: 7, offer: 5 } })
    const jane = fu.find((f) => f.slug === 'jane')
    expect(jane.urgency).toBe('waiting') // 8 < 10 now
  })
})
