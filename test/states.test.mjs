// test/states.test.mjs
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStates } from '../scripts/lib/states.mjs'

describe('loadStates', () => {
  it('loads the real repo states.yml', () => {
    const s = loadStates(process.cwd())
    expect(s.stages).toContain('triage')
    expect(s.terminal).toEqual(['hired', 'rejected', 'withdrawn'])
    expect(s.decisions.offer).toBe('decision')
    expect(s.reason_codes).toContain('missing-must-have')
  })

  it('throws when terminal stage is not in stages', () => {
    const root = mkdtempSync(join(tmpdir(), 'to-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(
      join(root, 'templates/states.yml'),
      'stages: [a]\nterminal: [zzz]\ndecisions: {}\nreason_codes: [x]\n'
    )
    expect(() => loadStates(root)).toThrow(/terminal/)
  })

  it('throws when a required key is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'to-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(join(root, 'templates/states.yml'), 'stages: [a]\n')
    expect(() => loadStates(root)).toThrow(/missing/)
  })

  it('throws when a decision target is not in stages', () => {
    const root = mkdtempSync(join(tmpdir(), 'to-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(
      join(root, 'templates/states.yml'),
      'stages: [a]\nterminal: [a]\ndecisions: {ok: zzz}\nreason_codes: [x]\n'
    )
    expect(() => loadStates(root)).toThrow(/decision targets/)
  })

  it('throws a clear error when a key has the wrong type', () => {
    const root = mkdtempSync(join(tmpdir(), 'to-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(
      join(root, 'templates/states.yml'),
      'stages: inbox\nterminal: [inbox]\ndecisions: {}\nreason_codes: [x]\n'
    )
    expect(() => loadStates(root)).toThrow(/must be a list/)
  })
})
