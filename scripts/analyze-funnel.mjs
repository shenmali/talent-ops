// scripts/analyze-funnel.mjs — deterministic hiring-funnel analytics.
// Zero-dep, no LLM. Reads candidate files (source of truth), not the tracker.
import { fileURLToPath } from 'node:url'
import { loadStates } from './lib/states.mjs'
import { collectCandidates } from './lib/candidates.mjs'

const TERMINAL = ['hired', 'rejected', 'withdrawn']
const QUALIFIED_FROM = ['screened', 'triage', 'interview', 'decision', 'hired']
const FAIRNESS_DISCLAIMER =
  'These are operational fairness signals, NOT a protected-class adverse-impact audit. ' +
  'talent-ops does not collect protected attributes (gender, age, race, ...). ' +
  'Treat source/reason-code/stage disparities as process hints for human review only.'

function daysBetween(a, b) {
  if (!a || !b) return null
  const d = (new Date(b) - new Date(a)) / 86400000
  return isNaN(d) ? null : d
}

export function analyzeFunnel(root, { role } = {}) {
  const states = loadStates(root)
  const cands = collectCandidates(root, states, role)

  const funnel = {}
  for (const s of states.stages) funnel[s] = 0
  for (const c of cands) funnel[c.stage] = (funnel[c.stage] ?? 0) + 1

  const reasonCodes = {}
  let decided = 0
  let overrides = 0
  const decisionDays = []
  for (const c of cands) {
    if (c.decision) {
      decided++
      if (c.override === true) overrides++
      if (TERMINAL.includes(c.stage) && c.reasonCode) {
        reasonCodes[c.reasonCode] = (reasonCodes[c.reasonCode] ?? 0) + 1
      }
      const dd = daysBetween(c.appliedAt, c.decision.decided_at)
      if (dd != null) decisionDays.push(dd)
    }
  }

  const source = {}
  for (const c of cands) {
    const key = c.source || '-'
    source[key] ??= { total: 0, qualified: 0 }
    source[key].total++
    if (QUALIFIED_FROM.includes(c.stage)) source[key].qualified++
  }

  const avgDaysToDecision = decisionDays.length
    ? Math.round((decisionDays.reduce((a, b) => a + b, 0) / decisionDays.length) * 10) / 10
    : null

  // proxy fairness: source qualification disparity + reason-code concentration
  const qualRates = Object.entries(source).map(([k, v]) => ({ source: k, rate: v.total ? v.qualified / v.total : 0 }))
  const topReason = Object.entries(reasonCodes).sort((a, b) => b[1] - a[1])[0]
  const reasonConcentration = topReason && decided
    ? { code: topReason[0], sharePct: Math.round((topReason[1] / Object.values(reasonCodes).reduce((a, b) => a + b, 0)) * 100) }
    : null

  return {
    role: role || '(all roles)',
    total: cands.length,
    funnel,
    reasonCodes,
    overrideRate: { decided, overrides, ratePct: decided ? Math.round((overrides / decided) * 100) : 0 },
    source,
    timing: { avgDaysToDecision },
    fairnessSignals: {
      disclaimer: FAIRNESS_DISCLAIMER,
      sourceQualificationRates: qualRates,
      reasonConcentration,
    },
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const role = process.argv[2]
  const a = analyzeFunnel(process.cwd(), { role })
  console.log(JSON.stringify(a, null, 2))
  console.error(`\n${a.fairnessSignals.disclaimer}`)
}
