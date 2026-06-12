import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCandidate, triageQueue, writeTracker, buildModel } from '../../board/lib/model.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { makeRepo, approvedContract, candidateFiles } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/candidates/jane-doe/profile.md':
      '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nCV body here\n',
    'roles/demo-role/candidates/jane-doe/evidence.md':
      '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo X"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-02\nscores:\n  skill_match: 5\n  experience_match: 4\n  evidence_match: 4\n  behavior_signals: 3\n---\nLayer rationale body\n',
  })
}

describe('loadCandidate', () => {
  it('assembles profile, claims, score breakdown, and stage', () => {
    const d = loadCandidate(repo(), 'demo-role', 'jane-doe')
    expect(d.name).toBe('Jane Doe')
    expect(d.stage).toBe('screened')
    expect(d.claims).toHaveLength(1)
    expect(d.claims[0].claim).toBe('Python')
    expect(d.score.scores.skill_match).toBe(5)
    expect(d.score.weighted_total).toBe(4.3)
    expect(d.decision).toBeNull()
  })
})

describe('triageQueue', () => {
  it('sorts by confidence band then total, isolates hard-filter fails, flags calibration', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/hi/profile.md': '---\nname: Hi\n---\nb\n',
      'roles/r/candidates/hi/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/hi/score.md': '---\nweighted_total: 4.0\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nscores:\n  hard_filters: pass\n---\n',
      'roles/r/candidates/lo/profile.md': '---\nname: Lo\n---\nb\n',
      'roles/r/candidates/lo/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/lo/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nmissing_evidence: []\nscores:\n  hard_filters: pass\n---\n',
      'roles/r/candidates/bad/profile.md': '---\nname: Bad\n---\nb\n',
      'roles/r/candidates/bad/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/bad/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: reject-suggest\nmissing_evidence: []\nscores:\n  hard_filters: fail(work_permit)\n---\n',
    })
    const q = triageQueue(buildModel(root).roles[0], loadStates(root))
    expect(q.calibrate).toBe(true) // no decisions yet
    expect(q.entries.map((e) => e.slug)).toEqual(['hi', 'lo']) // high band before medium; bad excluded
    expect(q.needsHumanLook.map((e) => e.slug)).toEqual(['bad']) // hard fail isolated
  })
})

describe('writeTracker', () => {
  it('rebuilds data/tracker.md from the model with the canonical header', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'bob-smith'),
    })
    writeTracker(root, { now: new Date('2026-06-11') })
    const t = readFileSync(join(root, 'data/tracker.md'), 'utf8')
    expect(t.split('\n')[0]).toBe('| candidate | role | stage | weighted_total | confidence | updated_at | note |')
    expect(t).toMatch(/\| bob-smith \| demo-role \| rejected \|/)
  })
})
