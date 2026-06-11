// scripts/dedupe.mjs — duplicate suggestions, advisory only (no auto-merge)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { walk } from './lib/walk.mjs'

export function findDuplicates(root, role) {
  const base = join(root, 'roles', role, 'candidates')
  const groups = new Map()
  for (const f of walk(base).filter((x) => x.endsWith('/profile.md'))) {
    const fm = parseFrontmatter(readFileSync(f, 'utf8')).data
    const slug = f.match(/candidates\/(.+?)\/profile\.md$/)[1]
    const keys = []
    if (fm.email) keys.push('email:' + String(fm.email).toLowerCase().trim())
    if (fm.name) keys.push('name:' + String(fm.name).toLowerCase().replace(/[^a-z]/g, ''))
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, new Set())
      groups.get(key).add(slug)
    }
  }
  return [...groups.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([key, s]) => ({ key, candidates: [...s].sort() }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [role, flag] = process.argv.slice(2)
  if (!role) {
    console.error('usage: node scripts/dedupe.mjs <role-slug> [--strict]')
    process.exit(2)
  }
  const dups = findDuplicates(process.cwd(), role)
  if (!dups.length) console.log('dedupe: no duplicates found')
  for (const d of dups)
    console.log(`dedupe: possible duplicate (${d.key}): ${d.candidates.join(' <-> ')} — review and merge manually`)
  if (dups.length && flag === '--strict') process.exit(1)
}
