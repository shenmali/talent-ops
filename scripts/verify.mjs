// scripts/verify.mjs — integrity checks (spec §9). Pure core + thin CLI.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { loadStates } from './lib/states.mjs'
import { walk } from './lib/walk.mjs'

const readFm = (path) => parseFrontmatter(readFileSync(path, 'utf8')).data

export function parseTrackerRows(root) {
  const p = join(root, 'data/tracker.md')
  if (!existsSync(p)) return []
  const rows = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.split('|').slice(1, -1).map((c) => c.trim())
    if (!cells.length || cells[0] === 'candidate' || /^-+$/.test(cells[0])) continue
    const [candidate, role, stage, total, confidence, updated_at, note = ''] = cells
    rows.push({ candidate, role, stage, total, confidence, updated_at, note })
  }
  return rows
}

export function collectViolations(root = process.cwd()) {
  const states = loadStates(root)
  const v = []
  const rolesDir = join(root, 'roles')
  const files = walk(rolesDir)
  const TERMINAL = states.terminal

  for (const f of files.filter((x) => x.endsWith('role-contract.md'))) {
    let fm
    try {
      fm = readFm(f)
    } catch {
      v.push(`${f}: unparseable frontmatter`)
      continue
    }
    if (fm.scoring_weights) {
      const sum = Object.values(fm.scoring_weights).reduce((a, b) => a + b, 0)
      if (Math.abs(sum - 1) > 0.001) v.push(`${f}: scoring_weights sum to ${sum}, expected 1.0`)
    }
  }

  for (const f of files.filter((x) => x.endsWith('/decision.md'))) {
    let fm
    try {
      fm = readFm(f)
    } catch {
      v.push(`${f}: unparseable frontmatter`)
      continue
    }
    if (!String(fm.decided_by ?? '').startsWith('human:'))
      v.push(`${f}: decided_by must start with "human:" (got "${fm.decided_by}")`)
    if (!(fm.decision in states.decisions))
      v.push(`${f}: unknown decision "${fm.decision}"`)
    if (TERMINAL.includes(fm.decision) && !states.reason_codes.includes(fm.reason_code))
      v.push(`${f}: terminal decision requires a reason_code from states.yml (got "${fm.reason_code}")`)
  }

  for (const f of files.filter((x) => x.endsWith('/score.md'))) {
    const dir = f.slice(0, -'/score.md'.length)
    if (!existsSync(join(dir, 'evidence.md'))) v.push(`${f}: score without evidence.md`)
    const contractPath = join(dir, '..', '..', 'role-contract.md')
    if (existsSync(contractPath)) {
      let cfm
      try {
        cfm = readFm(contractPath)
      } catch {
        continue // already flagged as unparseable by the contracts loop
      }
      if (cfm.status !== 'approved')
        v.push(`${f}: scored while contract status is "${cfm.status}" (needs approved)`)
    } else {
      v.push(`${f}: no role-contract.md found for this role`)
    }
  }

  const rows = parseTrackerRows(root)
  for (const r of rows) {
    if (!states.stages.includes(r.stage))
      v.push(`tracker: unknown stage "${r.stage}" for ${r.candidate}`)
    if (!existsSync(join(rolesDir, r.role, 'candidates', r.candidate)))
      v.push(`tracker: row for missing candidate dir ${r.role}/${r.candidate}`)
  }
  const tracked = new Set(rows.map((r) => `${r.role}/${r.candidate}`))
  for (const f of files.filter((x) => x.endsWith('/profile.md'))) {
    const m = f.match(/roles\/(.+?)\/candidates\/(.+?)\/profile\.md$/)
    if (m && !tracked.has(`${m[1]}/${m[2]}`))
      v.push(`tracker: missing row for ${m[1]}/${m[2]}`)
  }
  return v
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = collectViolations(process.cwd())
  if (violations.length) {
    console.error(`verify: ${violations.length} violation(s)`)
    for (const x of violations) console.error(' - ' + x)
    process.exit(1)
  }
  console.log('verify: OK')
}
