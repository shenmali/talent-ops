import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildModel } from '../../board/lib/model.mjs'
import { makeRepo, approvedContract, candidateFiles, trackerWith } from '../helpers.mjs'

// A repo with three candidates at three stages.
function repo() {
  const root = makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/jd.md': '---\nrole: demo-role\n---\nbody\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
    // jane: screened (score, no decision)
    'roles/demo-role/candidates/jane-doe/profile.md':
      '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\nlinks: ["https://github.com/jane"]\n---\nbody\n',
    'roles/demo-role/candidates/jane-doe/evidence.md': '---\nclaims: []\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: ["link unverified"]\nscored_at: 2026-06-02\n---\n',
    // bob: rejected (decision present)
    ...candidateFiles('demo-role', 'bob-smith'),
    // cara: parsed only (profile, no score)
    'roles/demo-role/candidates/cara-lee/profile.md':
      '---\nname: Cara Lee\nsource: "csv:applicants.csv"\napplied_at: 2026-06-10\n---\nbody\n',
  })
  // give bob a scored_at/decided_at-bearing decision + score for stage+sla
  writeFileSync(
    join(root, 'roles/demo-role/candidates/bob-smith/score.md'),
    '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: reject-suggest\nmissing_evidence: ["Python"]\nrisks: []\nscored_at: 2026-06-03\n---\n'
  )
  writeFileSync(
    join(root, 'roles/demo-role/candidates/bob-smith/decision.md'),
    '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:tester\ndecided_at: 2026-06-04\n---\n'
  )
  return root
}

describe('buildModel', () => {
  it('derives stages from files present', () => {
    const m = buildModel(repo(), { now: new Date('2026-06-11') })
    const role = m.roles.find((r) => r.slug === 'demo-role')
    const bySlug = Object.fromEntries(role.candidates.map((c) => [c.slug, c]))
    expect(bySlug['jane-doe'].stage).toBe('screened')
    expect(bySlug['bob-smith'].stage).toBe('rejected')
    expect(bySlug['cara-lee'].stage).toBe('parsed')
  })

  it('surfaces score fields and a missing-evidence count on the card', () => {
    const role = buildModel(repo(), { now: new Date('2026-06-11') }).roles[0]
    const jane = role.candidates.find((c) => c.slug === 'jane-doe')
    expect(jane.weightedTotal).toBe(4.3)
    expect(jane.confidence).toBe('high')
    expect(jane.recommendation).toBe('advance')
    expect(jane.missingCount).toBe(0)
    expect(jane.source).toBe('inbound:jane.txt')
  })

  it('counts candidates per stage and exposes role meta', () => {
    const role = buildModel(repo(), { now: new Date('2026-06-11') }).roles[0]
    expect(role.title).toBe('Demo Role')
    expect(role.status).toBe('approved')
    expect(role.jdExists).toBe(true)
    expect(role.hasDisclosure).toBe(true)
    expect(role.counts.screened).toBe(1)
    expect(role.counts.parsed).toBe(1)
    expect(role.counts.rejected).toBe(1)
    expect(role.counts.total).toBe(3)
  })

  it('derives updatedAt and an SLA flag from the right timestamp', () => {
    // jane screened, scored_at 2026-06-02, now 2026-06-11 → 9 days awaiting triage → over (>5)
    const role = buildModel(repo(), { now: new Date('2026-06-11') }).roles[0]
    const jane = role.candidates.find((c) => c.slug === 'jane-doe')
    expect(jane.updatedAt).toBe('2026-06-02')
    expect(jane.daysInStage).toBe(9)
    expect(jane.sla).toBe('over')
    // bob rejected = terminal → no SLA pressure
    const bob = role.candidates.find((c) => c.slug === 'bob-smith')
    expect(bob.sla).toBe('ok')
  })

  it('honors an explicit non-terminal stage override on the profile', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/inrev/profile.md': '---\nname: In Review\nstage: triage\napplied_at: 2026-06-05\n---\nb\n',
      'roles/r/candidates/inrev/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/inrev/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nmissing_evidence: []\n---\n',
    })
    const role = buildModel(root, { now: new Date('2026-06-11') }).roles[0]
    expect(role.candidates[0].stage).toBe('triage') // override beats derived 'screened'
  })

  it('summarizes authenticity signals on the card (count + max severity), null when none', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/flagged/profile.md': '---\nname: Flagged\napplied_at: 2026-06-05\n---\nb\n',
      'roles/r/candidates/flagged/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/flagged/score.md':
        '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: hold\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-06\nauthenticity_signals:\n  - signal: evidence-absence\n    severity: high\n    basis: "most must-haves unbacked"\n  - signal: unverifiable-exaggeration\n    severity: medium\n    basis: "grandiose claim, no metric"\n---\n',
      'roles/r/candidates/clean/profile.md': '---\nname: Clean\napplied_at: 2026-06-05\n---\nb\n',
      'roles/r/candidates/clean/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/clean/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-06\n---\n',
    })
    const role = buildModel(root, { now: new Date('2026-06-11') }).roles[0]
    const flagged = role.candidates.find((c) => c.slug === 'flagged')
    const clean = role.candidates.find((c) => c.slug === 'clean')
    expect(flagged.authenticity).toEqual({ count: 2, maxSeverity: 'high' })
    expect(clean.authenticity).toBe(null)
  })
})
