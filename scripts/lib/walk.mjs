// scripts/lib/walk.mjs — recursive dosya listesi (dış bağımlılık yok)
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
