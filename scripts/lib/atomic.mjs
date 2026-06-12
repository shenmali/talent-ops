// scripts/lib/atomic.mjs — atomic + conflict-aware writes for the board.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

export function writeAtomic(path, content) {
  const tmp = path + '.tmp'
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

// Content hash, or the literal 'absent' when the file does not exist.
export function fileToken(path) {
  if (!existsSync(path)) return 'absent'
  return createHash('sha1').update(readFileSync(path)).digest('hex')
}

// Write only if the file is still what the caller last saw (sinceToken).
// Returns {ok:true} or {ok:false, error:'conflict'}.
export function writeIfUnchanged(path, content, sinceToken) {
  if (fileToken(path) !== sinceToken) return { ok: false, error: 'conflict' }
  writeAtomic(path, content)
  return { ok: true }
}
