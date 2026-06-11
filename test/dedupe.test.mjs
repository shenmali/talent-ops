// test/dedupe.test.mjs
import { describe, it, expect } from 'vitest'
import { findDuplicates } from '../scripts/dedupe.mjs'
import { makeRepo } from './helpers.mjs'

describe('findDuplicates', () => {
  it('groups candidates sharing a normalized email', () => {
    const root = makeRepo({
      'roles/r/candidates/jane-doe/profile.md': '---\nname: Jane Doe\nemail: Jane@X.dev\n---\n',
      'roles/r/candidates/jane-d/profile.md': '---\nname: J. Doe\nemail: jane@x.dev\n---\n',
      'roles/r/candidates/bob/profile.md': '---\nname: Bob\nemail: bob@x.dev\n---\n',
    })
    const dups = findDuplicates(root, 'r')
    expect(dups).toHaveLength(1)
    expect(dups[0].candidates).toEqual(['jane-d', 'jane-doe'])
  })

  it('returns [] when no duplicates', () => {
    const root = makeRepo({
      'roles/r/candidates/a/profile.md': '---\nname: A\nemail: a@x.dev\n---\n',
      'roles/r/candidates/b/profile.md': '---\nname: B\nemail: b@x.dev\n---\n',
    })
    expect(findDuplicates(root, 'r')).toEqual([])
  })

  it('groups candidates sharing a normalized name with different emails', () => {
    const root = makeRepo({
      'roles/r/candidates/jane-doe/profile.md': '---\nname: Jane Doe\nemail: jd1@x.dev\n---\n',
      'roles/r/candidates/jane-doe-2/profile.md': '---\nname: jane doe\nemail: jd2@y.dev\n---\n',
    })
    const dups = findDuplicates(root, 'r')
    expect(dups).toHaveLength(1)
    expect(dups[0].key).toBe('name:janedoe')
    expect(dups[0].candidates).toEqual(['jane-doe', 'jane-doe-2'])
  })

  it('skips malformed profile frontmatter instead of crashing', () => {
    const root = makeRepo({
      'roles/r/candidates/ok/profile.md': '---\nname: OK\nemail: ok@x.dev\n---\n',
      'roles/r/candidates/bad/profile.md': 'not frontmatter\n',
    })
    expect(findDuplicates(root, 'r')).toEqual([])
  })
})
