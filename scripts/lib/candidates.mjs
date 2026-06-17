// scripts/lib/candidates.mjs — read-only: candidate files -> normalized list.
// Scripts-layer twin of board/lib/model.mjs derivation. No writes, no LLM.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatter.mjs'

export function readFm(path) {
  if (!existsSync(path)) return null
  try {
    return parseFrontmatter(readFileSync(path, 'utf8')).data
  } catch {
    return null
  }
}

export function deriveStage(states, { decision, stageOverride, hasScore, hasProfile }) {
  if (decision && decision.decision in states.decisions) return states.decisions[decision.decision]
  if (stageOverride && states.stages.includes(stageOverride) && !states.terminal.includes(stageOverride)) {
    return stageOverride
  }
  if (hasScore) return 'screened'
  if (hasProfile) return 'parsed'
  return 'inbox'
}

export function deriveUpdatedAt({ decision, score, profile }) {
  return decision?.decided_at || score?.scored_at || profile?.applied_at || null
}

export function collectCandidates(root, states, roleFilter) {
  const rolesDir = join(root, 'roles')
  if (!existsSync(rolesDir)) return []
  const roleSlugs = readdirSync(rolesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((r) => !roleFilter || r === roleFilter)

  const out = []
  for (const role of roleSlugs) {
    const candDir = join(rolesDir, role, 'candidates')
    if (!existsSync(candDir)) continue
    for (const d of readdirSync(candDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const slug = d.name
      const cdir = join(candDir, slug)
      const profile = readFm(join(cdir, 'profile.md'))
      const score = readFm(join(cdir, 'score.md'))
      const decision = readFm(join(cdir, 'decision.md'))
      const stage = deriveStage(states, {
        decision,
        stageOverride: profile?.stage,
        hasScore: !!score,
        hasProfile: !!profile,
      })
      out.push({
        role,
        slug,
        profile,
        score,
        decision: decision ?? null,
        stage,
        updatedAt: deriveUpdatedAt({ decision, score, profile }),
        appliedAt: profile?.applied_at ?? null,
        source: profile?.source ?? '-',
        weightedTotal: score?.weighted_total ?? null,
        confidence: score?.confidence ?? null,
        recommendation: score?.recommendation ?? null,
        reasonCode: decision?.reason_code ?? null,
        override: decision?.override ?? null,
      })
    }
  }
  return out
}
