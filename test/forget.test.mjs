import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { forgetCandidate } from '../scripts/forget.mjs'
import { makeRepo, approvedContract, candidateFiles, trackerWith } from './helpers.mjs'

const memory = `# Talent Memory

## demo-role/jane-doe
- decided: rejected (stronger-shortlist) on 2026-06-11 by human:tester
- future_fit: [data-analyst]

## demo-role/bob
- decided: rejected (missing-must-have) on 2026-06-11 by human:tester
`

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    ...candidateFiles('demo-role', 'jane-doe'),
    ...candidateFiles('demo-role', 'bob'),
    'data/tracker.md': trackerWith([
      ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ['bob', 'demo-role', 'rejected', '2.0', 'low', '2026-06-11', ''],
    ]),
    'data/talent-memory.md': memory,
  })
}

describe('forgetCandidate', () => {
  it('removes dir, tracker row, and memory entry — leaves others intact', () => {
    const root = repo()
    const res = forgetCandidate(root, 'demo-role', 'jane-doe')
    expect(res).toEqual({ removedDir: true, trackerRows: 1, memoryEntries: 1 })
    expect(existsSync(join(root, 'roles/demo-role/candidates/jane-doe'))).toBe(false)
    const tracker = readFileSync(join(root, 'data/tracker.md'), 'utf8')
    expect(tracker).not.toMatch(/jane-doe/)
    expect(tracker).toMatch(/bob/)
    const mem = readFileSync(join(root, 'data/talent-memory.md'), 'utf8')
    expect(mem).not.toMatch(/jane-doe/)
    expect(mem).toMatch(/demo-role\/bob/)
  })

  it('dry-run reports but removes nothing', () => {
    const root = repo()
    const res = forgetCandidate(root, 'demo-role', 'jane-doe', { dryRun: true })
    expect(res.removedDir).toBe(true)
    expect(existsSync(join(root, 'roles/demo-role/candidates/jane-doe'))).toBe(true)
    expect(readFileSync(join(root, 'data/tracker.md'), 'utf8')).toMatch(/jane-doe/)
  })
})
