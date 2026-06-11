import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '../scripts/lib/frontmatter.mjs'

describe('parseFrontmatter', () => {
  it('parses yaml frontmatter and preserves body', () => {
    const text = '---\nrole: demo\nweights:\n  skill_match: 0.3\n---\n# Body\n\ntext here\n'
    const { data, body } = parseFrontmatter(text)
    expect(data.role).toBe('demo')
    expect(data.weights.skill_match).toBe(0.3)
    expect(body).toBe('# Body\n\ntext here\n')
  })

  it('throws on missing frontmatter', () => {
    expect(() => parseFrontmatter('# just markdown\n')).toThrow(/frontmatter/)
  })

  it('returns empty object for empty frontmatter block', () => {
    const { data, body } = parseFrontmatter('---\n---\nbody\n')
    expect(data).toEqual({})
    expect(body).toBe('body\n')
  })
})

describe('serializeFrontmatter', () => {
  it('round-trips with parseFrontmatter', () => {
    const out = serializeFrontmatter({ a: 1, list: ['x'] }, 'hello\n')
    const { data, body } = parseFrontmatter(out)
    expect(data).toEqual({ a: 1, list: ['x'] })
    expect(body).toBe('hello\n')
  })
})
