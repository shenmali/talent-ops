import { describe, it, expect } from 'vitest'
import { collectViolations } from '../scripts/verify.mjs'
import { makeRepo, approvedContract, candidateFiles, trackerWith } from './helpers.mjs'

const cleanRepo = () =>
  makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    ...candidateFiles('demo-role', 'jane-doe'),
    'data/tracker.md': trackerWith([
      ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
    ]),
  })

describe('collectViolations', () => {
  it('returns [] for a clean repo', () => {
    expect(collectViolations(cleanRepo())).toEqual([])
  })

  it('flags ai:* decided_by', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'jane-doe', { decidedBy: 'ai:claude' }),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/decided_by must start with "human:"/)
  })

  it('flags terminal decision without valid reason_code', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'jane-doe', { reasonCode: 'felt-wrong' }),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/reason_code/)
  })

  it('flags score.md without evidence.md', () => {
    const files = candidateFiles('demo-role', 'jane-doe')
    delete files['roles/demo-role/candidates/jane-doe/evidence.md']
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...files,
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/score without evidence/)
  })

  it('flags candidates scored under a non-approved contract', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract.replace('status: approved', 'status: draft'),
      ...candidateFiles('demo-role', 'jane-doe'),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/contract status is "draft"/)
  })

  it('flags weights that do not sum to 1', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract.replace('skill_match: 0.3', 'skill_match: 0.2'),
    })
    expect(collectViolations(root).join()).toMatch(/scoring_weights sum/)
  })

  it('flags tracker rows with unknown stage or missing candidate dir, and untracked candidates', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'jane-doe'),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'flying', '3.9', 'medium', '2026-06-11', ''],
        ['ghost', 'demo-role', 'parsed', '-', '-', '2026-06-11', ''],
      ]),
    })
    const out = collectViolations(root).join('\n')
    expect(out).toMatch(/unknown stage "flying"/)
    expect(out).toMatch(/missing candidate dir demo-role\/ghost/)
  })
})
