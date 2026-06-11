// scripts/export-audit.mjs — per-role audit package (spec §8)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { parseFrontmatter } from './lib/frontmatter.mjs'

function readFmIf(path, warnings) {
  if (!existsSync(path)) return null
  try {
    return parseFrontmatter(readFileSync(path, 'utf8')).data
  } catch {
    warnings.push(path)
    return null
  }
}

export function buildAudit(root, role) {
  const roleDir = join(root, 'roles', role)
  const contractPath = join(roleDir, 'role-contract.md')
  if (!existsSync(contractPath)) {
    throw new Error(`export-audit: role not found or missing contract: ${role}`)
  }
  let contract
  try {
    contract = parseFrontmatter(readFileSync(contractPath, 'utf8'))
  } catch {
    throw new Error(`export-audit: unreadable frontmatter in ${contractPath}`)
  }
  const { data: cfm, body } = contract
  const warnings = []

  const driftMarker = '## Criteria drift log'
  const driftIdx = body.indexOf(driftMarker)
  const drift =
    driftIdx >= 0 ? body.slice(driftIdx + driftMarker.length).trim() : '(no drift log section)'

  const jdPath = join(roleDir, 'jd.md')
  const disclosure =
    existsSync(jdPath) && readFileSync(jdPath, 'utf8').includes('<!-- ai-disclosure -->')
      ? 'present'
      : 'MISSING'

  const candDir = join(roleDir, 'candidates')
  const slugs = existsSync(candDir)
    ? readdirSync(candDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : []
  let decided = 0
  let overrides = 0
  const rows = slugs.map((slug) => {
    const score = readFmIf(join(candDir, slug, 'score.md'), warnings)
    const dec = readFmIf(join(candDir, slug, 'decision.md'), warnings)
    if (dec) {
      decided++
      // LLM-written YAML may quote booleans — count "true" as well
      if (dec.override === true || dec.override === 'true') overrides++
    }
    return `| ${slug} | ${score?.weighted_total ?? '-'} | ${score?.confidence ?? '-'} | ${score?.recommendation ?? '-'} | ${dec?.decision ?? '-'} | ${dec?.reason_code || '-'} | ${dec?.decided_by ?? '-'} | ${dec?.override ?? '-'} |`
  })
  const rate = decided ? Math.round((overrides / decided) * 100) : 0

  const out = [
    `# Audit — ${role}`,
    '',
    `- Contract status: ${cfm.status} (approved_by: ${cfm.approved_by || '-'})`,
    `- AI disclosure in JD: ${disclosure}`,
    `- Decisions recorded: ${decided} | Override rate: ${rate}%`,
    '',
    '## Scoring weights',
    '```yaml',
    stringify(cfm.scoring_weights ?? {}).trim(),
    '```',
    '',
    '## Must-haves',
    '```yaml',
    stringify(cfm.must_have ?? []).trim(),
    '```',
    '',
    '## Candidates',
    '| candidate | total | confidence | ai_recommendation | decision | reason_code | decided_by | override |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Criteria drift log (from contract)',
    drift,
    '',
  ]
  if (warnings.length) {
    out.push('## Warnings', ...warnings.map((w) => `- unreadable frontmatter: ${w}`), '')
  }
  return out.join('\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const role = process.argv[2]
  if (!role) {
    console.error('usage: node scripts/export-audit.mjs <role-slug>')
    process.exit(2)
  }
  let out
  try {
    out = buildAudit(process.cwd(), role)
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }
  const date = new Date().toISOString().slice(0, 10)
  const dest = join(process.cwd(), 'roles', role, `audit-${date}.md`)
  writeFileSync(dest, out)
  console.log(`audit written: ${dest}`)
}
