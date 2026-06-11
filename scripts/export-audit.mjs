// scripts/export-audit.mjs — per-role audit package (spec §8)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { parseFrontmatter } from './lib/frontmatter.mjs'

const readFmIf = (p) => (existsSync(p) ? parseFrontmatter(readFileSync(p, 'utf8')).data : null)

export function buildAudit(root, role) {
  const roleDir = join(root, 'roles', role)
  const { data: cfm, body } = parseFrontmatter(readFileSync(join(roleDir, 'role-contract.md'), 'utf8'))
  const driftIdx = body.indexOf('## Criteria drift log')
  const drift = driftIdx >= 0 ? body.slice(driftIdx) : '(no drift log section)'
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
    const score = readFmIf(join(candDir, slug, 'score.md'))
    const dec = readFmIf(join(candDir, slug, 'decision.md'))
    if (dec) {
      decided++
      if (dec.override === true) overrides++
    }
    return `| ${slug} | ${score?.weighted_total ?? '-'} | ${score?.confidence ?? '-'} | ${score?.recommendation ?? '-'} | ${dec?.decision ?? '-'} | ${dec?.reason_code || '-'} | ${dec?.decided_by ?? '-'} | ${dec?.override ?? '-'} |`
  })
  const rate = decided ? Math.round((overrides / decided) * 100) : 0

  return [
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
    drift.trim(),
    '',
  ].join('\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const role = process.argv[2]
  if (!role) {
    console.error('usage: node scripts/export-audit.mjs <role-slug>')
    process.exit(2)
  }
  const out = buildAudit(process.cwd(), role)
  const date = new Date().toISOString().slice(0, 10)
  const dest = join(process.cwd(), 'roles', role, `audit-${date}.md`)
  writeFileSync(dest, out)
  console.log(`audit written: ${dest}`)
}
