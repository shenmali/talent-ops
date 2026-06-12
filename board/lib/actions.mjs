// board/lib/actions.mjs — write-only: record human decisions/edits. No LLM.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter, serializeFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { writeIfUnchanged } from '../../scripts/lib/atomic.mjs'
import { writeTracker } from './model.mjs'

const TERMINAL = ['hired', 'rejected', 'withdrawn']

// Alignment table from modes/_shared.md §Override.
const ALIGN = {
  advanced: ['advance', 'shortlist'],
  interviewing: ['advance', 'shortlist'],
  offer: ['advance'],
  hired: ['advance'],
  rejected: ['reject-suggest'],
  // withdrawn: candidate-driven → never an override
}
function isOverride(decision, aiRec) {
  if (decision === 'withdrawn') return false
  const aligned = ALIGN[decision] || []
  return !aligned.includes(aiRec)
}

const candDir = (root, role, slug) => join(root, 'roles', role, 'candidates', slug)
function readFm(path) {
  return existsSync(path) ? parseFrontmatter(readFileSync(path, 'utf8')).data : null
}

export function applyDecision(root, { role, slug, decision, reasonCode, reasonDetail = '', userId, sinceToken, now = new Date() }) {
  // never let an AI identity be recorded as the decider (decided_by must be human:*)
  if (String(userId).startsWith('ai:')) return { ok: false, error: 'ai-identity' }
  const states = loadStates(root)
  if (!(decision in states.decisions)) return { ok: false, error: 'decision-invalid' }
  if (TERMINAL.includes(decision)) {
    if (!reasonCode) return { ok: false, error: 'reason-required' }
    if (!states.reason_codes.includes(reasonCode)) return { ok: false, error: 'reason-invalid' }
  }
  const dir = candDir(root, role, slug)
  const score = readFm(join(dir, 'score.md'))
  const aiRec = score?.recommendation ?? ''
  const data = {
    candidate: slug,
    role,
    decision,
    reason_code: reasonCode || '',
    reason_detail: reasonDetail,
    decided_by: `human:${userId}`,
    ai_recommendation: aiRec,
    override: isOverride(decision, aiRec),
    decided_at: now.toISOString().slice(0, 10),
  }
  const body = `# Decision — ${slug}\n\n## Rationale\n${reasonDetail || '(recorded via board)'}\n`
  const res = writeIfUnchanged(join(dir, 'decision.md'), serializeFrontmatter(data, body), sinceToken)
  if (!res.ok) return res
  writeTracker(root, { now })
  return { ok: true, override: data.override }
}
