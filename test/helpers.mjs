// test/helpers.mjs — fixture repo kurucusu. Gerçek states.yml kopyalanır.
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

export function makeRepo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'talent-ops-'))
  mkdirSync(join(root, 'templates'), { recursive: true })
  cpSync(
    join(process.cwd(), 'templates/states.yml'),
    join(root, 'templates/states.yml')
  )
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}

export const approvedContract = `---
role: demo-role
title: "Demo Role"
status: approved
approved_by: human:tester
scoring_weights:
  skill_match: 0.3
  experience_match: 0.2
  evidence_match: 0.3
  behavior_signals: 0.2
must_have:
  - skill: Python
    evidence_required: repo
---
# Role Contract
## Criteria drift log
| date | changed_by | change | re-approved_by |
| ---- | ---------- | ------ | -------------- |
`

export function candidateFiles(role, slug, { decidedBy = 'human:tester', decision = 'rejected', reasonCode = 'stronger-shortlist' } = {}) {
  const base = `roles/${role}/candidates/${slug}`
  return {
    [`${base}/profile.md`]: `---\nname: ${slug}\nemail: ${slug}@x.dev\n---\nbody\n`,
    [`${base}/evidence.md`]: `---\nclaims: []\n---\n`,
    [`${base}/score.md`]: `---\nweighted_total: 3.9\nconfidence: medium\nrecommendation: shortlist\n---\n`,
    [`${base}/decision.md`]: `---\ndecision: ${decision}\nreason_code: ${reasonCode}\ndecided_by: ${decidedBy}\n---\n`,
  }
}

export function trackerWith(rows) {
  const header =
    '| candidate | role | stage | weighted_total | confidence | updated_at | note |\n' +
    '| --- | --- | --- | --- | --- | --- | --- |\n'
  return header + rows.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n'
}
