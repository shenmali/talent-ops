// scripts/lib/states.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export function loadStates(root = process.cwd()) {
  const raw = parse(readFileSync(join(root, 'templates/states.yml'), 'utf8'))
  for (const key of ['stages', 'terminal', 'decisions', 'reason_codes']) {
    if (raw?.[key] == null) throw new Error(`states.yml missing "${key}"`)
  }
  if (!Array.isArray(raw.stages)) throw new Error('states.yml "stages" must be a list')
  if (!Array.isArray(raw.terminal)) throw new Error('states.yml "terminal" must be a list')
  if (typeof raw.decisions !== 'object' || Array.isArray(raw.decisions))
    throw new Error('states.yml "decisions" must be a mapping')
  if (!Array.isArray(raw.reason_codes)) throw new Error('states.yml "reason_codes" must be a list')
  const badTerminal = raw.terminal.filter((s) => !raw.stages.includes(s))
  if (badTerminal.length) {
    throw new Error(`terminal stages not in stages: ${badTerminal.join(', ')}`)
  }
  const badTargets = Object.values(raw.decisions).filter((s) => !raw.stages.includes(s))
  if (badTargets.length) {
    throw new Error(`decision targets not in stages: ${badTargets.join(', ')}`)
  }
  return raw
}
