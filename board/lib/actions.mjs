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

// --- changeStage + addNote (Task 7) ---
// (serializeFrontmatter is already imported at the top of actions.mjs in Task 6.)

function readFmBody(path) {
  if (!existsSync(path)) return null
  return parseFrontmatter(readFileSync(path, 'utf8'))
}

export function changeStage(root, { role, slug, toStage, userId, sinceToken, now = new Date() }) {
  if (String(userId).startsWith('ai:')) return { ok: false, error: 'ai-identity' }
  const states = loadStates(root)
  if (!states.stages.includes(toStage)) return { ok: false, error: 'stage-invalid' }
  if (TERMINAL.includes(toStage)) return { ok: false, error: 'terminal-stage' }
  const path = join(candDir(root, role, slug), 'profile.md')
  const parsed = readFmBody(path)
  if (!parsed) return { ok: false, error: 'no-profile' }
  const data = { ...parsed.data, stage: toStage }
  const res = writeIfUnchanged(path, serializeFrontmatter(data, parsed.body), sinceToken)
  if (!res.ok) return res
  writeTracker(root, { now })
  return { ok: true }
}

export function addNote(root, { role, slug, text, userId, sinceToken, now = new Date() }) {
  if (String(userId).startsWith('ai:')) return { ok: false, error: 'ai-identity' }
  if (!text || !text.trim()) return { ok: false, error: 'empty-note' }
  const path = join(candDir(root, role, slug), 'profile.md')
  const parsed = readFmBody(path)
  if (!parsed) return { ok: false, error: 'no-profile' }
  let body = parsed.body
  if (!body.includes('## Notes')) body = body.replace(/\s*$/, '\n\n## Notes\n')
  const stamp = now.toISOString().slice(0, 10)
  body += `- ${stamp} human:${userId}: ${text.trim()}\n`
  const res = writeIfUnchanged(path, serializeFrontmatter(parsed.data, body), sinceToken)
  if (!res.ok) return res
  return { ok: true }
}

// --- markEvidence (Task 8) ---
const HUMAN_EVIDENCE_STATUS = ['human-confirmed', 'contradicted']

export function markEvidence(root, { role, slug, claimIndex, status, userId, sinceToken }) {
  if (String(userId).startsWith('ai:')) return { ok: false, error: 'ai-identity' }
  if (!HUMAN_EVIDENCE_STATUS.includes(status)) return { ok: false, error: 'status-invalid' }
  const path = join(candDir(root, role, slug), 'evidence.md')
  const parsed = readFmBody(path)
  if (!parsed || !Array.isArray(parsed.data.claims)) return { ok: false, error: 'no-evidence' }
  const i = Number(claimIndex)
  if (!Number.isInteger(i) || i < 0 || i >= parsed.data.claims.length) return { ok: false, error: 'claim-index' }
  const claims = parsed.data.claims.map((c, idx) => (idx === i ? { ...c, status } : c))
  const data = { ...parsed.data, claims }
  return writeIfUnchanged(path, serializeFrontmatter(data, parsed.body), sinceToken)
}
