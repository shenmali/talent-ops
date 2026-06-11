// scripts/forget.mjs — GDPR art.17 erasure helper (spec §8)
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

function writeAtomic(path, content) {
  writeFileSync(path + '.tmp', content)
  renameSync(path + '.tmp', path)
}

export function forgetCandidate(root, role, slug, { dryRun = false } = {}) {
  const result = { removedDir: false, trackerRows: 0, memoryEntries: 0, batchRows: 0 }

  const dir = join(root, 'roles', role, 'candidates', slug)
  if (existsSync(dir)) {
    result.removedDir = true
    if (!dryRun) rmSync(dir, { recursive: true })
  }

  const trackerPath = join(root, 'data/tracker.md')
  if (existsSync(trackerPath)) {
    const kept = readFileSync(trackerPath, 'utf8').split('\n').filter((line) => {
      const t = line.trim()
      if (!t.startsWith('|')) return true
      const cells = t.split('|').slice(1, -1).map((c) => c.trim())
      const match = cells[0] === slug && cells[1] === role
      if (match) result.trackerRows++
      return !match
    })
    if (!dryRun && result.trackerRows) writeAtomic(trackerPath, kept.join('\n'))
  }

  const memPath = join(root, 'data/talent-memory.md')
  if (existsSync(memPath)) {
    const kept = []
    let skipping = false
    for (const line of readFileSync(memPath, 'utf8').split('\n')) {
      if (line.startsWith('## ')) {
        skipping = line.trim() === `## ${role}/${slug}`
        if (skipping) {
          result.memoryEntries++
          continue
        }
      }
      if (!skipping) kept.push(line)
    }
    if (!dryRun && result.memoryEntries) writeAtomic(memPath, kept.join('\n'))
  }

  const batchPath = join(root, 'data/batch-state.md')
  if (existsSync(batchPath)) {
    const kept = readFileSync(batchPath, 'utf8').split('\n').filter((line) => {
      const t = line.trim()
      if (!t.startsWith('|')) return true
      const cells = t.split('|').slice(1, -1).map((c) => c.trim())
      const match = cells[0] === slug // batch-state has no role column
      if (match) result.batchRows++
      return !match
    })
    if (!dryRun && result.batchRows) writeAtomic(batchPath, kept.join('\n'))
  }

  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
  const dryRun = process.argv.includes('--dry-run')
  const [role, slug] = args
  if (!role || !slug) {
    console.error('usage: node scripts/forget.mjs <role-slug> <candidate-slug> [--dry-run]')
    process.exit(2)
  }
  const res = forgetCandidate(process.cwd(), role, slug, { dryRun })
  console.log(`${dryRun ? '[dry-run] ' : ''}forget ${role}/${slug}: dir=${res.removedDir} trackerRows=${res.trackerRows} memoryEntries=${res.memoryEntries} batchRows=${res.batchRows}`)
  console.log(
    'WARNING: removing files does NOT rewrite git history. For full erasure in a\n' +
      'version-controlled repo, also rewrite history, e.g.:\n' +
      `  git filter-repo --invert-paths --path roles/${role}/candidates/${slug}\n` +
      'or keep real candidate data out of version control entirely.\n' +
      'Note: data/inbox and data/quarantine.md are not candidate records and\n' +
      'are not touched — review them manually if the person\u2019s documents were\n' +
      'never imported.'
  )
}
