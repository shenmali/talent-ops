// board/lib/model.mjs — read-only: repo files -> board model. No LLM, no writes.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'

const TERMINAL = ['hired', 'rejected', 'withdrawn']

function readFm(path) {
  if (!existsSync(path)) return null
  try {
    return parseFrontmatter(readFileSync(path, 'utf8')).data
  } catch {
    return null
  }
}

function deriveStage(states, { decision, stageOverride, hasScore, hasProfile }) {
  if (decision && decision.decision in states.decisions) return states.decisions[decision.decision]
  // explicit, non-terminal manual stage (set by the board's "change stage" action)
  if (stageOverride && states.stages.includes(stageOverride) && !states.terminal.includes(stageOverride)) {
    return stageOverride
  }
  if (hasScore) return 'screened'
  if (hasProfile) return 'parsed'
  return 'inbox'
}

function daysBetween(now, dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  if (isNaN(then)) return null
  return Math.floor((now - then) / 86400000)
}

function slaFor(stage, days) {
  if (days == null || TERMINAL.includes(stage)) return 'ok'
  if (stage === 'screened') return days > 5 ? 'over' : days > 3 ? 'warn' : 'ok'
  if (stage === 'interview') return days > 10 ? 'over' : days > 7 ? 'warn' : 'ok'
  return 'ok'
}

export function buildModel(root, { now = new Date() } = {}) {
  const states = loadStates(root)
  const rolesDir = join(root, 'roles')
  const roleSlugs = existsSync(rolesDir)
    ? readdirSync(rolesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : []

  const roles = roleSlugs.map((slug) => {
    const roleDir = join(rolesDir, slug)
    const contract = readFm(join(roleDir, 'role-contract.md')) ?? {}
    const jdPath = join(roleDir, 'jd.md')
    const jdExists = existsSync(jdPath)
    const hasDisclosure = jdExists && readFileSync(jdPath, 'utf8').includes('<!-- ai-disclosure -->')

    const candDir = join(roleDir, 'candidates')
    const candSlugs = existsSync(candDir)
      ? readdirSync(candDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : []

    const candidates = candSlugs.map((cslug) => {
      const cdir = join(candDir, cslug)
      const profile = readFm(join(cdir, 'profile.md'))
      const score = readFm(join(cdir, 'score.md'))
      const decision = readFm(join(cdir, 'decision.md'))
      const stage = deriveStage(states, { decision, stageOverride: profile?.stage, hasScore: !!score, hasProfile: !!profile })
      const updatedAt =
        decision?.decided_at || score?.scored_at || profile?.applied_at || null
      const days = daysBetween(now, updatedAt)
      return {
        slug: cslug,
        name: profile?.name ?? cslug,
        source: profile?.source ?? '-',
        links: profile?.links ?? [],
        stage,
        weightedTotal: score?.weighted_total ?? null,
        confidence: score?.confidence ?? null,
        recommendation: score?.recommendation ?? null,
        missingCount: Array.isArray(score?.missing_evidence) ? score.missing_evidence.length : null,
        risksTop: Array.isArray(score?.risks) && score.risks.length ? score.risks[0] : null,
        updatedAt,
        daysInStage: days,
        sla: slaFor(stage, days),
      }
    })

    const counts = { total: candidates.length }
    for (const s of states.stages) counts[s] = 0
    for (const c of candidates) counts[c.stage] = (counts[c.stage] ?? 0) + 1

    return {
      slug,
      title: contract.title ?? slug,
      status: contract.status ?? 'unknown',
      approvedBy: contract.approved_by ?? '',
      jdExists,
      hasDisclosure,
      counts,
      candidates,
    }
  })

  return { generatedAt: now.toISOString(), roles }
}
