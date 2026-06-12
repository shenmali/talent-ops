import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic, fileToken, writeIfUnchanged } from '../../scripts/lib/atomic.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'atomic-'))

describe('fileToken', () => {
  it('returns "absent" for a missing file and a stable hash for content', () => {
    const root = tmp()
    const p = join(root, 'f.md')
    expect(fileToken(p)).toBe('absent')
    writeFileSync(p, 'hello')
    const t1 = fileToken(p)
    expect(t1).not.toBe('absent')
    expect(fileToken(p)).toBe(t1) // stable
    writeFileSync(p, 'world')
    expect(fileToken(p)).not.toBe(t1) // content-sensitive
  })
})

describe('writeAtomic', () => {
  it('writes via a temp file and leaves no .tmp behind', () => {
    const root = tmp()
    const p = join(root, 'out.md')
    writeAtomic(p, 'data\n')
    expect(readFileSync(p, 'utf8')).toBe('data\n')
    expect(existsSync(p + '.tmp')).toBe(false)
  })
})

describe('writeIfUnchanged', () => {
  it('writes when the current token matches sinceToken', () => {
    const root = tmp()
    const p = join(root, 'c.md')
    writeFileSync(p, 'v1')
    const token = fileToken(p)
    const r = writeIfUnchanged(p, 'v2', token)
    expect(r).toEqual({ ok: true })
    expect(readFileSync(p, 'utf8')).toBe('v2')
  })

  it('refuses (conflict) when the file changed since sinceToken', () => {
    const root = tmp()
    const p = join(root, 'c.md')
    writeFileSync(p, 'v1')
    const stale = fileToken(p)
    writeFileSync(p, 'v1-edited-elsewhere') // someone else wrote
    const r = writeIfUnchanged(p, 'v2', stale)
    expect(r).toEqual({ ok: false, error: 'conflict' })
    expect(readFileSync(p, 'utf8')).toBe('v1-edited-elsewhere') // untouched
  })

  it('treats creating a new file as unchanged when sinceToken is "absent"', () => {
    const root = tmp()
    const p = join(root, 'new.md')
    const r = writeIfUnchanged(p, 'fresh', 'absent')
    expect(r).toEqual({ ok: true })
    expect(readFileSync(p, 'utf8')).toBe('fresh')
  })
})
