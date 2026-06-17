// scripts/followup.mjs — deterministic cadence: who is waiting, how long.
// Zero-dep, no LLM. Reads candidate files via scripts/lib/candidates.mjs.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { loadStates } from './lib/states.mjs'
import { collectCandidates } from './lib/candidates.mjs'

const DEFAULT_CADENCE = { screened: 5, interview: 7, offer: 5 }
const URGENCY_RANK = { overdue: 0, due: 1, waiting: 2 }

export function loadCadence(root) {
  const p = join(root, 'config/company-profile.yml')
  if (!existsSync(p)) return { ...DEFAULT_CADENCE }
  try {
    const cfg = parseYaml(readFileSync(p, 'utf8'))
    return { ...DEFAULT_CADENCE, ...(cfg?.cadence ?? {}) }
  } catch {
    return { ...DEFAULT_CADENCE }
  }
}

function daysBetween(now, dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  if (isNaN(then)) return null
  return Math.floor((now - then) / 86400000)
}

function urgencyFor(days, threshold) {
  if (days > threshold) return 'overdue'
  if (days === threshold) return 'due'
  return 'waiting'
}

export function collectFollowups(root, { now = new Date(), cadence } = {}) {
  const states = loadStates(root)
  const cad = cadence || loadCadence(root)
  const out = []
  for (const c of collectCandidates(root, states)) {
    let waitingFor = null
    let threshold = null
    if (c.stage === 'screened') {
      waitingFor = 'triage'
      threshold = cad.screened
    } else if (c.stage === 'interview') {
      waitingFor = 'decision'
      threshold = cad.interview
    } else if (c.stage === 'decision' && c.decision?.decision === 'offer') {
      waitingFor = 'candidate-response'
      threshold = cad.offer
    }
    if (!waitingFor) continue
    const days = daysBetween(now, c.updatedAt)
    if (days == null) continue
    out.push({
      role: c.role,
      slug: c.slug,
      stage: c.stage,
      waitingFor,
      daysWaiting: days,
      threshold,
      urgency: urgencyFor(days, threshold),
      updatedAt: c.updatedAt,
    })
  }
  out.sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
    return u !== 0 ? u : b.daysWaiting - a.daysWaiting
  })
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fu = collectFollowups(process.cwd(), {})
  if (!fu.length) {
    console.log('followup: no one is waiting past cadence (or no datable candidates).')
  } else {
    console.log(`followup: ${fu.length} candidate(s) waiting\n`)
    for (const f of fu) {
      console.log(`  [${f.urgency}] ${f.role}/${f.slug} — awaiting ${f.waitingFor} — ${f.daysWaiting}d (threshold ${f.threshold})`)
    }
  }
}
