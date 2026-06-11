# Talent-Ops Web Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec §7'deki lokal web board'u kurmak: `npm run board` ile kalkan tek Node process, dosya tabanlı pipeline'ı dört ekranda (pipeline / aday / triage / rol) gösteren ve beyaz-listeli write aksiyonlarını (sebep kodlu karar, aşama değiştir, kanıt işaretle, not) güvenle dosyalara yazan zero-build bir arayüz.

**Architecture:** Zero-build, zero-runtime-dep (yalnız Node built-in `http`/`fs`/`crypto` + mevcut `yaml`). Server **server-side render** eder (HTML string), write işlemleri **HTML form POST** ile gelir (JS kapalıyken bile çalışır — progressive enhancement); `public/app.js` yalnız SSE ile canlı yenileme katar. Tüm okuma `board/lib/model.mjs`'de, tüm write `board/lib/actions.mjs`'de, tüm HTML `board/lib/render.mjs`'de izole — her biri saf ve vitest ile test edilebilir; `board/server.mjs` ince bir kabuktur. Yazma güvenceleri (atomik + çakışma) ortak `scripts/lib/atomic.mjs`'de.

**Tech Stack:** Node >= 20 (ESM, global `fetch`), `yaml` (mevcut), `vitest` (mevcut). Yeni runtime bağımlılığı YOK. Build adımı YOK.

**Spec:** `docs/superpowers/specs/2026-06-11-talent-ops-mvp-design.md` §7 (ve §8 uyumluluk garantileri).

**Mevcut yeniden kullanılan çekirdek (main'de, değiştirilmez):**
- `scripts/lib/frontmatter.mjs` — `parseFrontmatter(text) → {data, body}`, `serializeFrontmatter(data, body) → string`
- `scripts/lib/states.mjs` — `loadStates(root) → {stages, terminal, decisions, reason_codes}`
- `scripts/lib/walk.mjs` — `walk(dir) → string[]`
- `scripts/verify.mjs` — `parseTrackerRows(root)`, `collectViolations(root)` (board write sonrası bütünlük için referans)
- Veri sözleşmesi: `modes/_shared.md` (frontmatter alanları, skorlama, override hizalama tablosu, stage türetme)

---

## Dosya Haritası (bu planın sonunda)

```
HR-ops/
├── board/
│   ├── server.mjs        # http server: routing, statik serve, SSE, form POST → actions   [Task 9-11]
│   ├── lib/
│   │   ├── model.mjs     # repo → board modeli: stage türetme, kuyruk, SLA, writeTracker   [Task 3-4]
│   │   ├── actions.mjs   # write: applyDecision/changeStage/markEvidence/addNote (guard+atomic) [Task 6-8]
│   │   └── render.mjs    # board modeli → HTML (page shell + 4 görünüm)                     [Task 5]
│   └── public/
│       ├── app.js        # progressive enhancement: SSE canlı yenileme                       [Task 12]
│       └── style.css     # stil                                                              [Task 12]
├── scripts/lib/atomic.mjs # writeAtomic + fileToken + writeIfUnchanged (çakışma+atomik)      [Task 2]
├── test/board/           # model/actions/render/atomic/server vitest testleri
├── package.json          # "board" script eklenir                                            [Task 1]
└── README.md             # board bölümü + board-checks                                       [Task 13]
```

**Sorumluluk sınırları:** `model.mjs` salt-okuma (I/O parametreli, saf), `actions.mjs` salt-write (her aksiyon: oku→guard→atomik-koşullu-yaz→tracker yenile), `render.mjs` salt-string (DOM yok, saf fonksiyon), `server.mjs` yalnız HTTP bağlama + watch. Hiçbir lib dosyası diğerine HTTP üzerinden bağlanmaz; server hepsini import eder.

**Önemli ilke:** Board hiçbir LLM çağırmaz — yalnızca insanın zaten verdiği kararları kaydeder. Skorlama/üretim AI CLI mode'larında kalır; board onların ürettiği dosyaları gösterir ve insan kararını damgalar.

---

### Task 1: package.json `board` script + board iskeleti + boot smoke

**Files:**
- Modify: `package.json` (scripts bloğuna tek satır)
- Create: `board/server.mjs` (minimal boot — sonraki task'larda büyür)
- Create: `board/lib/.gitkeep`, `board/public/.gitkeep`, `test/board/.gitkeep`

- [ ] **Step 1: package.json'a board script ekle**

`scripts` bloğunda `"verify"` satırının hemen ardına ekle (yalnız bu satır değişir):

```json
    "board": "node board/server.mjs",
```

Sonuç şöyle görünmeli:

```json
  "scripts": {
    "test": "vitest run",
    "board": "node board/server.mjs",
    "verify": "node scripts/verify.mjs",
    "dedupe": "node scripts/dedupe.mjs",
    "export-audit": "node scripts/export-audit.mjs",
    "forget": "node scripts/forget.mjs"
  },
```

- [ ] **Step 2: Minimal `board/server.mjs` yaz (sonraki task'larda genişler)**

```js
// board/server.mjs — Talent-Ops local board (zero-build, zero runtime dep).
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

export function createBoardServer({ root = process.cwd(), userId = 'unknown' } = {}) {
  return createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><title>talent-ops board</title><p>boot ok</p>')
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 4319
  const server = createBoardServer({ root: process.cwd() })
  server.listen(port, () => {
    console.log(`talent-ops board → http://localhost:${port}`)
  })
}
```

- [ ] **Step 3: İskelet dizinleri oluştur**

```bash
mkdir -p board/lib board/public test/board
touch board/lib/.gitkeep board/public/.gitkeep test/board/.gitkeep
```

- [ ] **Step 4: Boot smoke testi yaz — `test/board/server-boot.test.mjs`**

```js
import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'

let server
afterEach(() => server?.close())

describe('board server boot', () => {
  it('serves /healthz', async () => {
    server = createBoardServer({ root: process.cwd() })
    await new Promise((r) => server.listen(0, r))
    const { port } = server.address()
    const res = await fetch(`http://localhost:${port}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
```

- [ ] **Step 5: Testi çalıştır**

Run: `npx vitest run test/board/server-boot.test.mjs`
Expected: 1 passed

- [ ] **Step 6: Tüm suite hâlâ yeşil + commit**

Run: `npx vitest run`
Expected: önceki 32 + 1 = 33 passed

```bash
git add package.json board/ test/board/
git commit -m "feat(board): zero-build server skeleton + boot smoke test"
```

---

### Task 2: `scripts/lib/atomic.mjs` — atomik + çakışmaya dayanıklı yazma

Board'un tüm write'ları bundan geçer: render anındaki dosya imzası (`sinceToken`) ile yazma anındaki imza tutmuyorsa yazma reddedilir (spec §7 "render'dan beri değiştiyse uyar"). `fileToken` içerik hash'idir (mtime'dan sağlam).

**Files:**
- Create: `scripts/lib/atomic.mjs`
- Test: `test/board/atomic.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/atomic.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic, fileToken, writeIfUnchanged } from '../../scripts/lib/atomic.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'atomic-'))

describe('fileToken', () => {
  it('returns "absent" for a missing file and a stable hash for content', () => {
    const root = tmp()
    const p = join(root, 'f.md')
    expect(fileToken(p)).toBe('absent')
    writeFileSync(p, 'hello')
    const t1 = fileToken(p)
    expect(t1).not.toBe('absent')
    expect(fileToken(p)).toBe(t1) // stable
    writeFileSync(p, 'world')
    expect(fileToken(p)).not.toBe(t1) // content-sensitive
  })
})

describe('writeAtomic', () => {
  it('writes via a temp file and leaves no .tmp behind', () => {
    const root = tmp()
    const p = join(root, 'out.md')
    writeAtomic(p, 'data\n')
    expect(readFileSync(p, 'utf8')).toBe('data\n')
    expect(existsSync(p + '.tmp')).toBe(false)
  })
})

describe('writeIfUnchanged', () => {
  it('writes when the current token matches sinceToken', () => {
    const root = tmp()
    const p = join(root, 'c.md')
    writeFileSync(p, 'v1')
    const token = fileToken(p)
    const r = writeIfUnchanged(p, 'v2', token)
    expect(r).toEqual({ ok: true })
    expect(readFileSync(p, 'utf8')).toBe('v2')
  })

  it('refuses (conflict) when the file changed since sinceToken', () => {
    const root = tmp()
    const p = join(root, 'c.md')
    writeFileSync(p, 'v1')
    const stale = fileToken(p)
    writeFileSync(p, 'v1-edited-elsewhere') // someone else wrote
    const r = writeIfUnchanged(p, 'v2', stale)
    expect(r).toEqual({ ok: false, error: 'conflict' })
    expect(readFileSync(p, 'utf8')).toBe('v1-edited-elsewhere') // untouched
  })

  it('treats creating a new file as unchanged when sinceToken is "absent"', () => {
    const root = tmp()
    const p = join(root, 'new.md')
    const r = writeIfUnchanged(p, 'fresh', 'absent')
    expect(r).toEqual({ ok: true })
    expect(readFileSync(p, 'utf8')).toBe('fresh')
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/atomic.test.mjs`
Expected: FAIL — "Cannot find module '../../scripts/lib/atomic.mjs'"

- [ ] **Step 3: Implementasyon — `scripts/lib/atomic.mjs`**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/atomic.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/atomic.mjs test/board/atomic.test.mjs
git commit -m "feat(board): atomic + conflict-aware write library"
```

---

### Task 3: `board/lib/model.mjs` — `buildModel` (roller, adaylar, stage türetme, SLA)

Pipeline'ın tek okuma kaynağı. Stage türetme `modes/tracker.md` mantığını izler: `decision.md` varsa `states.decisions[value]`; yoksa `score.md` → `screened`; yoksa `profile.md` → `parsed`. `updatedAt` türetilir (decided_at > scored_at > applied_at) — asla "şimdi" değil, yoksa SLA susar.

**Files:**
- Create: `board/lib/model.mjs`
- Test: `test/board/model.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/model.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildModel } from '../../board/lib/model.mjs'
import { makeRepo, approvedContract, candidateFiles, trackerWith } from '../helpers.mjs'

// A repo with three candidates at three stages.
function repo() {
  const root = makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/jd.md': '---\nrole: demo-role\n---\nbody\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
    // jane: screened (score, no decision)
    'roles/demo-role/candidates/jane-doe/profile.md':
      '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\nlinks: ["https://github.com/jane"]\n---\nbody\n',
    'roles/demo-role/candidates/jane-doe/evidence.md': '---\nclaims: []\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: ["link unverified"]\nscored_at: 2026-06-02\n---\n',
    // bob: rejected (decision present)
    ...candidateFiles('demo-role', 'bob-smith'),
    // cara: parsed only (profile, no score)
    'roles/demo-role/candidates/cara-lee/profile.md':
      '---\nname: Cara Lee\nsource: "csv:applicants.csv"\napplied_at: 2026-06-10\n---\nbody\n',
  })
  // give bob a scored_at/decided_at-bearing decision + score for stage+sla
  writeFileSync(
    join(root, 'roles/demo-role/candidates/bob-smith/score.md'),
    '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: reject-suggest\nmissing_evidence: ["Python"]\nrisks: []\nscored_at: 2026-06-03\n---\n'
  )
  writeFileSync(
    join(root, 'roles/demo-role/candidates/bob-smith/decision.md'),
    '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:tester\ndecided_at: 2026-06-04\n---\n'
  )
  return root
}

describe('buildModel', () => {
  it('derives stages from files present', () => {
    const m = buildModel(repo(), { now: new Date('2026-06-11') })
    const role = m.roles.find((r) => r.slug === 'demo-role')
    const bySlug = Object.fromEntries(role.candidates.map((c) => [c.slug, c]))
    expect(bySlug['jane-doe'].stage).toBe('screened')
    expect(bySlug['bob-smith'].stage).toBe('rejected')
    expect(bySlug['cara-lee'].stage).toBe('parsed')
  })

  it('surfaces score fields and a missing-evidence count on the card', () => {
    const role = buildModel(repo(), { now: new Date('2026-06-11') }).roles[0]
    const jane = role.candidates.find((c) => c.slug === 'jane-doe')
    expect(jane.weightedTotal).toBe(4.3)
    expect(jane.confidence).toBe('high')
    expect(jane.recommendation).toBe('advance')
    expect(jane.missingCount).toBe(0)
    expect(jane.source).toBe('inbound:jane.txt')
  })

  it('counts candidates per stage and exposes role meta', () => {
    const role = buildModel(repo(), { now: new Date('2026-06-11') }).roles[0]
    expect(role.title).toBe('Demo Role')
    expect(role.status).toBe('approved')
    expect(role.jdExists).toBe(true)
    expect(role.hasDisclosure).toBe(true)
    expect(role.counts.screened).toBe(1)
    expect(role.counts.parsed).toBe(1)
    expect(role.counts.rejected).toBe(1)
    expect(role.counts.total).toBe(3)
  })

  it('derives updatedAt and an SLA flag from the right timestamp', () => {
    // jane screened, scored_at 2026-06-02, now 2026-06-11 → 9 days awaiting triage → over (>5)
    const role = buildModel(repo(), { now: new Date('2026-06-11') }).roles[0]
    const jane = role.candidates.find((c) => c.slug === 'jane-doe')
    expect(jane.updatedAt).toBe('2026-06-02')
    expect(jane.daysInStage).toBe(9)
    expect(jane.sla).toBe('over')
    // bob rejected = terminal → no SLA pressure
    const bob = role.candidates.find((c) => c.slug === 'bob-smith')
    expect(bob.sla).toBe('ok')
  })

  it('honors an explicit non-terminal stage override on the profile', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/inrev/profile.md': '---\nname: In Review\nstage: triage\napplied_at: 2026-06-05\n---\nb\n',
      'roles/r/candidates/inrev/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/inrev/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nmissing_evidence: []\n---\n',
    })
    const role = buildModel(root, { now: new Date('2026-06-11') }).roles[0]
    expect(role.candidates[0].stage).toBe('triage') // override beats derived 'screened'
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/model.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon — `board/lib/model.mjs`**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/model.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add board/lib/model.mjs test/board/model.test.mjs
git commit -m "feat(board): model.buildModel — stage derivation, counts, SLA flags"
```

---

### Task 4: `board/lib/model.mjs` — `loadCandidate`, `triageQueue`, `writeTracker`

Aday detayı (Evidence Ledger + skor kırılımı + karar), triage sıralaması (güven bandı → total desc, sert-fail ayrı), ve write sonrası tracker'ı modelden yeniden yazma (board write'ları tracker'ı senkron tutar).

**Files:**
- Modify: `board/lib/model.mjs` (üç export ekle)
- Test: `test/board/model-detail.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/model-detail.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCandidate, triageQueue, writeTracker, buildModel } from '../../board/lib/model.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { makeRepo, approvedContract, candidateFiles } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/candidates/jane-doe/profile.md':
      '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nCV body here\n',
    'roles/demo-role/candidates/jane-doe/evidence.md':
      '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo X"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-02\nscores:\n  skill_match: 5\n  experience_match: 4\n  evidence_match: 4\n  behavior_signals: 3\n---\nLayer rationale body\n',
  })
}

describe('loadCandidate', () => {
  it('assembles profile, claims, score breakdown, and stage', () => {
    const d = loadCandidate(repo(), 'demo-role', 'jane-doe')
    expect(d.name).toBe('Jane Doe')
    expect(d.stage).toBe('screened')
    expect(d.claims).toHaveLength(1)
    expect(d.claims[0].claim).toBe('Python')
    expect(d.score.scores.skill_match).toBe(5)
    expect(d.score.weighted_total).toBe(4.3)
    expect(d.decision).toBeNull()
  })
})

describe('triageQueue', () => {
  it('sorts by confidence band then total, isolates hard-filter fails, flags calibration', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/hi/profile.md': '---\nname: Hi\n---\nb\n',
      'roles/r/candidates/hi/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/hi/score.md': '---\nweighted_total: 4.0\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nscores:\n  hard_filters: pass\n---\n',
      'roles/r/candidates/lo/profile.md': '---\nname: Lo\n---\nb\n',
      'roles/r/candidates/lo/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/lo/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nmissing_evidence: []\nscores:\n  hard_filters: pass\n---\n',
      'roles/r/candidates/bad/profile.md': '---\nname: Bad\n---\nb\n',
      'roles/r/candidates/bad/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/bad/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: reject-suggest\nmissing_evidence: []\nscores:\n  hard_filters: fail(work_permit)\n---\n',
    })
    const q = triageQueue(buildModel(root).roles[0], loadStates(root))
    expect(q.calibrate).toBe(true) // no decisions yet
    expect(q.entries.map((e) => e.slug)).toEqual(['hi', 'lo']) // high band before medium; bad excluded
    expect(q.needsHumanLook.map((e) => e.slug)).toEqual(['bad']) // hard fail isolated
  })
})

describe('writeTracker', () => {
  it('rebuilds data/tracker.md from the model with the canonical header', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'bob-smith'),
    })
    writeTracker(root, { now: new Date('2026-06-11') })
    const t = readFileSync(join(root, 'data/tracker.md'), 'utf8')
    expect(t.split('\n')[0]).toBe('| candidate | role | stage | weighted_total | confidence | updated_at | note |')
    expect(t).toMatch(/\| bob-smith \| demo-role \| rejected \|/)
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/model-detail.test.mjs`
Expected: FAIL — `loadCandidate` is not exported

- [ ] **Step 3: model.mjs'e üç export ekle (dosya sonuna)**

```js
// --- detail + queue + tracker (Task 4) ---
import { writeAtomic } from '../../scripts/lib/atomic.mjs'

function readFmBody(path) {
  if (!existsSync(path)) return { data: null, body: '' }
  try {
    return parseFrontmatter(readFileSync(path, 'utf8'))
  } catch {
    return { data: null, body: '' }
  }
}

export function loadCandidate(root, role, slug) {
  const states = loadStates(root)
  const cdir = join(root, 'roles', role, 'candidates', slug)
  const profile = readFm(join(cdir, 'profile.md'))
  const evidence = readFm(join(cdir, 'evidence.md'))
  const score = readFm(join(cdir, 'score.md'))
  const decision = readFm(join(cdir, 'decision.md'))
  const stage = deriveStage(states, { decision, stageOverride: profile?.stage, hasScore: !!score, hasProfile: !!profile })
  return {
    role,
    slug,
    name: profile?.name ?? slug,
    profile,
    profileBody: readFmBody(join(cdir, 'profile.md')).body,
    claims: Array.isArray(evidence?.claims) ? evidence.claims : [],
    score: score ?? null,
    decision: decision ?? null,
    packetExists: existsSync(join(cdir, 'packet.md')),
    stage,
    updatedAt: decision?.decided_at || score?.scored_at || profile?.applied_at || null,
  }
}

const BAND = { high: 0, medium: 1, low: 2 }

export function triageQueue(roleModel, states) {
  const screened = roleModel.candidates.filter((c) => c.stage === 'screened')
  const needsHumanLook = []
  const main = []
  for (const c of screened) {
    // reject-suggest from a hard fail / disqualifier must never be bulk-decided
    if (c.recommendation === 'reject-suggest') needsHumanLook.push(c)
    else main.push(c)
  }
  main.sort((a, b) => {
    const band = (BAND[a.confidence] ?? 3) - (BAND[b.confidence] ?? 3)
    if (band !== 0) return band
    return (b.weightedTotal ?? 0) - (a.weightedTotal ?? 0)
  })
  const hasDecisions = roleModel.counts.interview + roleModel.counts.decision +
    roleModel.counts.hired + roleModel.counts.rejected + roleModel.counts.withdrawn > 0
  const calibrate = !hasDecisions
  const limit = Math.min(15, main.length)
  const entries = main.map((c, i) => ({ ...c, calibrate: calibrate && i < limit }))
  return { calibrate, entries, needsHumanLook }
}

export function writeTracker(root, { now = new Date() } = {}) {
  const model = buildModel(root, { now })
  const header =
    '| candidate | role | stage | weighted_total | confidence | updated_at | note |\n' +
    '| --- | --- | --- | --- | --- | --- | --- |\n'
  const rows = []
  for (const role of model.roles) {
    for (const c of role.candidates) {
      const note = c.stage && ['hired', 'rejected', 'withdrawn'].includes(c.stage)
        ? `reason: ${readFm(join(root, 'roles', role.slug, 'candidates', c.slug, 'decision.md'))?.reason_code ?? ''}`
        : ''
      rows.push(`| ${c.slug} | ${role.slug} | ${c.stage} | ${c.weightedTotal ?? '-'} | ${c.confidence ?? '-'} | ${c.updatedAt ?? '-'} | ${note} |`)
    }
  }
  writeAtomic(join(root, 'data', 'tracker.md'), header + rows.join('\n') + '\n')
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/model-detail.test.mjs`
Expected: 3 passed

- [ ] **Step 5: Tüm suite + commit**

Run: `npx vitest run`
Expected: tüm board + core testleri yeşil

```bash
git add board/lib/model.mjs test/board/model-detail.test.mjs
git commit -m "feat(board): loadCandidate detail, triageQueue, writeTracker"
```

---

### Task 5: `board/lib/render.mjs` — page shell + 4 görünüm (saf HTML string)

DOM yok, framework yok: saf fonksiyonlar board modelini HTML string'e çevirir. Write formları HTML `<form method="post">` — JS olmadan çalışır. `esc()` ile tüm dinamik metin escape edilir (aday adları, notlar XSS yüzeyi).

**Files:**
- Create: `board/lib/render.mjs`
- Test: `test/board/render.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/render.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { renderPage, renderPipeline, renderCandidate, renderTriage, renderRole } from '../../board/lib/render.mjs'
import { buildModel, loadCandidate, triageQueue } from '../../board/lib/model.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/jd.md': '---\nrole: demo-role\n---\n# JD\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
    'roles/demo-role/candidates/jane-doe/profile.md':
      '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nCV body\n',
    'roles/demo-role/candidates/jane-doe/evidence.md':
      '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo X"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-02\nscores:\n  skill_match: 5\n  experience_match: 4\n  evidence_match: 4\n  behavior_signals: 3\n---\nrationale\n',
  })
}

describe('renderPage', () => {
  it('wraps body in an HTML doc that links style.css and app.js and shows the user', () => {
    const html = renderPage({ title: 'Pipeline', body: '<p>hi</p>', userId: 'ali' })
    expect(html).toMatch(/<!doctype html>/i)
    expect(html).toContain('/public/style.css')
    expect(html).toContain('/public/app.js')
    expect(html).toContain('human:ali')
    expect(html).toContain('<p>hi</p>')
  })
})

describe('renderPipeline', () => {
  it('renders a card per candidate with score, confidence, recommendation, missing count, source, SLA', () => {
    const model = buildModel(repo(), { now: new Date('2026-06-11') })
    const html = renderPipeline(model)
    expect(html).toContain('Jane Doe')
    expect(html).toContain('4.3')
    expect(html).toContain('high')
    expect(html).toContain('advance')
    expect(html).toContain('inbound:jane.txt')
    expect(html).toMatch(/sla-over/) // 9 days screened → over
    expect(html).toContain('href="/candidate/demo-role/jane-doe"')
  })
})

describe('renderCandidate', () => {
  it('shows the evidence ledger, score breakdown, and write forms with sinceToken hidden inputs', () => {
    const root = repo()
    const detail = loadCandidate(root, 'demo-role', 'jane-doe')
    const states = loadStates(root)
    const tokens = { decision: 'absent', score: 'abc', profileToken: 'def' }
    const html = renderCandidate(detail, states, { tokens, userId: 'ali' })
    expect(html).toContain('Python')          // evidence claim
    expect(html).toContain('ai-inferred')      // claim status
    expect(html).toContain('skill_match')      // score breakdown
    expect(html).toContain('action/decision')  // decision form
    expect(html).toContain('name="reason_code"')
    expect(html).toContain('value="absent"')   // decision sinceToken
    // every reason code from states is an option
    for (const rc of states.reason_codes) expect(html).toContain(rc)
  })
})

describe('renderTriage', () => {
  it('renders the calibrated queue, a reason-code select, and isolates hard-fail candidates', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/good/profile.md': '---\nname: Good\n---\nb\n',
      'roles/r/candidates/good/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/good/score.md': '---\nweighted_total: 4.0\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nscores:\n  hard_filters: pass\n---\n',
      'roles/r/candidates/blocked/profile.md': '---\nname: Blocked\n---\nb\n',
      'roles/r/candidates/blocked/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/blocked/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: reject-suggest\nmissing_evidence: []\nscores:\n  hard_filters: fail(work_permit)\n---\n',
    })
    const model = buildModel(root)
    const states = loadStates(root)
    const q = triageQueue(model.roles[0], states)
    const html = renderTriage(model.roles[0], q, states, { userId: 'ali' })
    expect(html).toContain('Good')
    expect(html).toContain('calibrate')             // calibration banner/flag
    expect(html).toContain('requires explicit human look')
    expect(html).toContain('Blocked')               // hard-fail isolated, still shown
    expect(html).toContain('anti-miss')             // anti-miss note
    expect(html).toContain('id="bulk-reject"')      // bulk reject form
    expect(html).toContain('antiMissConfirmed')     // required confirm box
    expect(html).toMatch(/name="slug" value="good"[^>]*form="bulk-reject"/) // row checkbox bound to bulk form
  })
})

describe('renderRole', () => {
  it('shows contract summary, drift log, and a JD link', () => {
    const root = repo()
    const model = buildModel(root)
    const html = renderRole(model.roles[0], '## Criteria drift log\n| date | changed_by | change | re-approved_by |\n')
    expect(html).toContain('Demo Role')
    expect(html).toContain('approved')
    expect(html).toContain('drift log')
    expect(html).toContain('href="/role/demo-role/jd"')
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/render.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon — `board/lib/render.mjs`**

```js
// board/lib/render.mjs — pure: board model -> HTML strings. No DOM, no deps.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

export function renderPage({ title, body, userId }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — talent-ops</title>
<link rel="stylesheet" href="/public/style.css">
</head><body>
<header class="topbar">
  <nav><a href="/">Pipeline</a></nav>
  <span class="who">Acting as <strong>human:${esc(userId)}</strong> · AI recommends, you decide</span>
</header>
<main>${body}</main>
<script src="/public/app.js"></script>
</body></html>`
}

function slaClass(sla) {
  return sla === 'over' ? 'sla-over' : sla === 'warn' ? 'sla-warn' : 'sla-ok'
}

function card(roleSlug, c) {
  const score = c.weightedTotal == null ? '—' : `${c.weightedTotal} (${esc(c.confidence)})`
  const missing = c.missingCount == null ? '' : `<span class="missing">missing: ${c.missingCount}</span>`
  const days = c.daysInStage == null ? '' : `<span class="days ${slaClass(c.sla)}">${c.daysInStage}d</span>`
  const rec = c.recommendation ? `<span class="rec rec-${esc(c.recommendation)}">${esc(c.recommendation)}</span>` : ''
  return `<a class="card" href="/candidate/${esc(roleSlug)}/${esc(c.slug)}">
  <span class="name">${esc(c.name)}</span>
  <span class="score">${score}</span>
  ${rec}${missing}${days}
  <span class="src">${esc(c.source)}</span>
</a>`
}

export function renderPipeline(model) {
  const cols = ['parsed', 'screened', 'triage', 'interview', 'decision', 'hired', 'rejected', 'withdrawn']
  const roles = model.roles.map((role) => {
    const byStage = Object.fromEntries(cols.map((s) => [s, []]))
    for (const c of role.candidates) (byStage[c.stage] ??= []).push(c)
    const columns = cols.map((s) => `<section class="col"><h3>${s} <span class="n">${role.counts[s] ?? 0}</span></h3>
${(byStage[s] || []).map((c) => card(role.slug, c)).join('\n')}</section>`).join('\n')
    return `<section class="role">
<h2><a href="/role/${esc(role.slug)}">${esc(role.title)}</a> <span class="status">${esc(role.status)}</span>
  · <a href="/triage/${esc(role.slug)}">triage queue</a></h2>
<div class="board">${columns}</div></section>`
  }).join('\n')
  return `<h1>Pipeline</h1>${roles || '<p>No roles yet.</p>'}`
}

function evidenceTable(claims) {
  if (!claims.length) return '<p>No evidence ledger yet.</p>'
  const rows = claims.map((c, i) => `<tr>
<td>${esc(c.claim)}</td><td>${esc(c.source)}</td><td>${esc(c.evidence) || '—'}</td>
<td>${esc(c.confidence)}</td><td class="st-${esc(c.status)}">${esc(c.status)}</td></tr>`).join('\n')
  return `<table class="ledger"><thead><tr><th>claim</th><th>source</th><th>evidence</th><th>confidence</th><th>status</th></tr></thead><tbody>${rows}</tbody></table>`
}

function scoreBreakdown(score) {
  if (!score) return '<p>Not scored yet.</p>'
  const s = score.scores || {}
  const layers = Object.entries(s).map(([k, v]) => `<li>${esc(k)}: <strong>${esc(v)}</strong></li>`).join('')
  return `<ul class="layers">${layers}</ul>
<p>weighted_total: <strong>${esc(score.weighted_total)}</strong> (confidence: ${esc(score.confidence)}) ·
recommendation: <span class="rec rec-${esc(score.recommendation)}">${esc(score.recommendation)}</span> ·
<em>assistive — not a decision</em></p>`
}

function decisionForm(detail, states, token, userId) {
  const decisionOpts = Object.keys(states.decisions).map((d) => `<option value="${d}">${d}</option>`).join('')
  const reasonOpts = states.reason_codes.map((r) => `<option value="${r}">${r}</option>`).join('')
  return `<form class="act" method="post" action="/action/decision">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<label>decision <select name="decision" required>${decisionOpts}</select></label>
<label>reason (required for hired/rejected/withdrawn) <select name="reason_code"><option value="">—</option>${reasonOpts}</select></label>
<label>detail <input type="text" name="reason_detail"></label>
<button type="submit">Record decision as human:${esc(userId)}</button>
</form>`
}

function stageForm(detail, states, token) {
  const opts = states.stages.filter((s) => !states.terminal.includes(s))
    .map((s) => `<option value="${s}">${s}</option>`).join('')
  return `<form class="act" method="post" action="/action/stage">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<label>move to stage <select name="toStage">${opts}</select></label>
<button type="submit">Change stage</button>
<small>Terminal stages (hired/rejected/withdrawn) only via a decision.</small>
</form>`
}

function evidenceMarkForm(detail, token) {
  const rows = detail.claims.map((c, i) => `<form class="act inline" method="post" action="/action/evidence">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="claimIndex" value="${i}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<span>${esc(c.claim)}</span>
<button name="status" value="human-confirmed">confirm</button>
<button name="status" value="contradicted">contradict</button>
</form>`).join('\n')
  return rows || '<p>No claims to mark.</p>'
}

function noteForm(detail, token) {
  return `<form class="act" method="post" action="/action/note">
<input type="hidden" name="role" value="${esc(detail.role)}">
<input type="hidden" name="slug" value="${esc(detail.slug)}">
<input type="hidden" name="sinceToken" value="${esc(token)}">
<label>note <input type="text" name="text" required></label>
<button type="submit">Add note</button>
</form>`
}

export function renderCandidate(detail, states, { tokens, userId }) {
  const dec = detail.decision
    ? `<div class="decided"><strong>${esc(detail.decision.decision)}</strong>
       (${esc(detail.decision.reason_code) || 'no code'}) by ${esc(detail.decision.decided_by)} on ${esc(detail.decision.decided_at)}</div>`
    : '<p>No decision recorded.</p>'
  return `<h1>${esc(detail.name)} <span class="status">${esc(detail.stage)}</span></h1>
<p><a href="/">← pipeline</a> · <a href="/role/${esc(detail.role)}">role</a></p>
<section><h2>Evidence ledger</h2>${evidenceTable(detail.claims)}</section>
<section><h2>Score</h2>${scoreBreakdown(detail.score)}</section>
<section><h2>Decision</h2>${dec}</section>
<section class="actions"><h2>Actions</h2>
${decisionForm(detail, states, tokens.decision, userId)}
${stageForm(detail, states, tokens.profileToken)}
<h3>Mark evidence</h3>${evidenceMarkForm(detail, tokens.evidence)}
<h3>Note</h3>${noteForm(detail, tokens.profileToken)}
</section>`
}

export function renderTriage(roleModel, queue, states, { userId }) {
  const banner = queue.calibrate
    ? `<div class="calibrate">Calibration: review the first entries WITH the hiring manager before bulk action.</div>`
    : ''
  const reasonOpts = states.reason_codes.map((r) => `<option value="${r}">${r}</option>`).join('')
  // Each row carries a checkbox bound (form="bulk-reject") to the bulk form below.
  const rows = queue.entries.map((c, i) => `<tr class="${c.calibrate ? 'calibrate' : ''}">
<td><input type="checkbox" name="slug" value="${esc(c.slug)}" form="bulk-reject"></td>
<td>${i + 1}</td><td><a href="/candidate/${esc(roleModel.slug)}/${esc(c.slug)}">${esc(c.name)}</a></td>
<td>${esc(c.weightedTotal)} (${esc(c.confidence)})</td>
<td>${esc(c.recommendation)}</td><td>missing: ${esc(c.missingCount)}</td></tr>`).join('\n')
  const blocked = queue.needsHumanLook.map((c) => `<li><a href="/candidate/${esc(roleModel.slug)}/${esc(c.slug)}">${esc(c.name)}</a> — ${esc(c.recommendation)} (hard filter / disqualifier)</li>`).join('\n')
  // Bulk decision: reject only (advancing is deliberate, done one-by-one on the candidate page).
  const bulkForm = `<form id="bulk-reject" class="act" method="post" action="/action/triage-reject">
<input type="hidden" name="role" value="${esc(roleModel.slug)}">
<label>reason for selected <select name="reason_code" required><option value="">—</option>${reasonOpts}</select></label>
<label class="confirm"><input type="checkbox" name="antiMissConfirmed" value="yes" required> anti-miss: I re-checked the selected candidates above before rejecting</label>
<button type="submit">Reject selected</button>
</form>`
  return `<h1>Triage — ${esc(roleModel.title)}</h1>
<p><a href="/">← pipeline</a></p>
${banner}
<table class="queue"><thead><tr><th></th><th>#</th><th>candidate</th><th>score</th><th>recommendation</th><th>gaps</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No screened candidates.</td></tr>'}</tbody></table>
<p class="anti-miss"><strong>anti-miss:</strong> before rejecting in bulk, re-check a sample spread across the score range — the confirm box below is required.</p>
${bulkForm}
<section class="needs-human"><h2>Requires explicit human look (never auto-decided)</h2>
<ul>${blocked || '<li>none</li>'}</ul></section>
<p>Advancing and per-candidate decisions are recorded from each candidate's page, stamped human:${esc(userId)}.</p>`
}

export function renderRole(roleModel, contractBody) {
  const driftIdx = contractBody.indexOf('## Criteria drift log')
  const drift = driftIdx >= 0 ? contractBody.slice(driftIdx) : '(no drift log)'
  const jd = roleModel.jdExists
    ? `<a href="/role/${esc(roleModel.slug)}/jd">view JD</a> · disclosure: ${roleModel.hasDisclosure ? 'present' : 'MISSING'}`
    : 'no JD generated'
  return `<h1>${esc(roleModel.title)} <span class="status">${esc(roleModel.status)}</span></h1>
<p><a href="/">← pipeline</a> · <a href="/triage/${esc(roleModel.slug)}">triage queue</a></p>
<p>approved_by: ${esc(roleModel.approvedBy) || '—'} · ${jd}</p>
<section><h2>Criteria drift log</h2><pre>${esc(drift)}</pre></section>`
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/render.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add board/lib/render.mjs test/board/render.test.mjs
git commit -m "feat(board): render.mjs — page shell + pipeline/candidate/triage/role views"
```

---

### Task 6: `board/lib/actions.mjs` — `applyDecision` (insan damgası, ai reddi, sebep zorunlu, override, atomik)

En kritik write. Spec §7/§8: `decided_by: human:<userId>`, board'dan `ai:*` yazılamaz, terminal kararda sebep kodu zorunlu, override hizalama tablosuyla, çakışma korumalı atomik yazma, ardından tracker yeniden türetilir.

**Files:**
- Create: `board/lib/actions.mjs`
- Test: `test/board/actions-decision.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/actions-decision.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { applyDecision } from '../../board/lib/actions.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/candidates/jane-doe/profile.md': '---\nname: Jane Doe\napplied_at: 2026-06-01\n---\nb\n',
    'roles/demo-role/candidates/jane-doe/evidence.md': '---\nclaims: []\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md':
      '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\n---\n',
  })
}
const decPath = (root) => join(root, 'roles/demo-role/candidates/jane-doe/decision.md')
const fm = (root) => parseFrontmatter(readFileSync(decPath(root), 'utf8')).data

describe('applyDecision', () => {
  it('writes a human-stamped decision and rebuilds the tracker', () => {
    const root = repo()
    const r = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'advanced',
      reasonCode: '', reasonDetail: 'strong', userId: 'ali',
      sinceToken: 'absent', now: new Date('2026-06-11'),
    })
    expect(r.ok).toBe(true)
    expect(fm(root).decided_by).toBe('human:ali')
    expect(fm(root).decision).toBe('advanced')
    expect(fm(root).ai_recommendation).toBe('advance')
    expect(readFileSync(join(root, 'data/tracker.md'), 'utf8')).toMatch(/jane-doe \| demo-role \| interview/)
  })

  it('refuses to stamp an AI identity', () => {
    const root = repo()
    const r = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'advanced',
      reasonCode: '', userId: 'ai:claude', sinceToken: 'absent',
    })
    expect(r).toEqual({ ok: false, error: 'ai-identity' })
    expect(existsSync(decPath(root))).toBe(false)
  })

  it('requires a valid reason_code for terminal decisions', () => {
    const root = repo()
    const bad = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'rejected',
      reasonCode: '', userId: 'ali', sinceToken: 'absent',
    })
    expect(bad).toEqual({ ok: false, error: 'reason-required' })
    const bogus = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'rejected',
      reasonCode: 'felt-wrong', userId: 'ali', sinceToken: 'absent',
    })
    expect(bogus).toEqual({ ok: false, error: 'reason-invalid' })
    expect(existsSync(decPath(root))).toBe(false)
  })

  it('computes override via the alignment table, not string equality', () => {
    const root = repo()
    // recommendation=advance ; decision=advanced → aligned → override false
    applyDecision(root, { role: 'demo-role', slug: 'jane-doe', decision: 'advanced', reasonCode: '', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11') })
    expect(fm(root).override).toBe(false)
  })

  it('flags override true when the human diverges from the recommendation', () => {
    const root = repo()
    // recommendation=advance ; decision=rejected → not aligned → override true
    const r = applyDecision(root, {
      role: 'demo-role', slug: 'jane-doe', decision: 'rejected',
      reasonCode: 'stronger-shortlist', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11'),
    })
    expect(r.ok).toBe(true)
    expect(fm(root).override).toBe(true)
  })

  it('refuses on a stale sinceToken (conflict)', () => {
    const root = repo()
    // first write creates decision.md
    applyDecision(root, { role: 'demo-role', slug: 'jane-doe', decision: 'advanced', reasonCode: '', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11') })
    // second write with the now-stale 'absent' token must conflict
    const r = applyDecision(root, { role: 'demo-role', slug: 'jane-doe', decision: 'interviewing', reasonCode: '', userId: 'ali', sinceToken: 'absent', now: new Date('2026-06-11') })
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/actions-decision.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon — `board/lib/actions.mjs`**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/actions-decision.test.mjs`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add board/lib/actions.mjs test/board/actions-decision.test.mjs
git commit -m "feat(board): actions.applyDecision — human stamp, ai refusal, reason gate, override, conflict-safe"
```

---

### Task 7: `board/lib/actions.mjs` — `changeStage` + `addNote`

`changeStage` profile.md'ye opsiyonel `stage:` override yazar (uç aşamalara izin VERMEZ — onlar yalnız karar aksiyonuyla; spec §7). `addNote` profile.md gövdesine zaman damgalı insan notu ekler. İkisi de çakışma-korumalı.

**Files:**
- Modify: `board/lib/actions.mjs` (iki export ekle)
- Modify: `modes/_shared.md` (profile.md sözleşmesine opsiyonel `stage` notu — board yazar)
- Test: `test/board/actions-stage-note.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/actions-stage-note.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { changeStage, addNote } from '../../board/lib/actions.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/jane/profile.md': '---\nname: Jane\napplied_at: 2026-06-01\n---\nCV body\n',
    'roles/r/candidates/jane/evidence.md': '---\nclaims: []\n---\n',
    'roles/r/candidates/jane/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nmissing_evidence: []\n---\n',
  })
}
const profPath = (root) => join(root, 'roles/r/candidates/jane/profile.md')

describe('changeStage', () => {
  it('writes a non-terminal stage override onto the profile and rebuilds the tracker', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'triage', userId: 'ali', sinceToken: token, now: new Date('2026-06-11') })
    expect(r.ok).toBe(true)
    expect(parseFrontmatter(readFileSync(profPath(root), 'utf8')).data.stage).toBe('triage')
    expect(readFileSync(join(root, 'data/tracker.md'), 'utf8')).toMatch(/jane \| r \| triage/)
  })

  it('refuses a move to a terminal stage', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'rejected', userId: 'ali', sinceToken: token })
    expect(r).toEqual({ ok: false, error: 'terminal-stage' })
  })

  it('refuses an unknown stage', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'flying', userId: 'ali', sinceToken: token })
    expect(r).toEqual({ ok: false, error: 'stage-invalid' })
  })

  it('refuses on a stale token (conflict)', () => {
    const root = repo()
    const r = changeStage(root, { role: 'r', slug: 'jane', toStage: 'triage', userId: 'ali', sinceToken: 'stale-token' })
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})

describe('addNote', () => {
  it('appends a timestamped human note to the profile body', () => {
    const root = repo()
    const token = fileToken(profPath(root))
    const r = addNote(root, { role: 'r', slug: 'jane', text: 'Called, available from July', userId: 'ali', sinceToken: token, now: new Date('2026-06-11') })
    expect(r.ok).toBe(true)
    const txt = readFileSync(profPath(root), 'utf8')
    expect(txt).toMatch(/## Notes/)
    expect(txt).toMatch(/human:ali/)
    expect(txt).toMatch(/Called, available from July/)
    expect(txt).toMatch(/CV body/) // original body preserved
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/actions-stage-note.test.mjs`
Expected: FAIL — `changeStage` is not exported

- [ ] **Step 3: actions.mjs'e iki export ekle (dosya sonuna)**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/actions-stage-note.test.mjs`
Expected: 5 passed

- [ ] **Step 5: modes/_shared.md profile sözleşmesine opsiyonel `stage` notu ekle**

`profile.md` sözleşme satırını bul:
```
- `profile.md`: name, email, location, source, applied_at, links[],
  years_experience, last_roles[], languages[], parsed_by,
  hard_filter_precheck (`pass` | `fail(<filter>)`, written by intake).
```
ve sonuna `stage` notunu ekleyerek değiştir:
```
- `profile.md`: name, email, location, source, applied_at, links[],
  years_experience, last_roles[], languages[], parsed_by,
  hard_filter_precheck (`pass` | `fail(<filter>)`, written by intake),
  stage (optional non-terminal override, written ONLY by the board's
  change-stage action; a recorded decision always wins over it).
```

- [ ] **Step 6: Tüm suite + commit**

Run: `npx vitest run`
Expected: tüm testler yeşil

```bash
git add board/lib/actions.mjs test/board/actions-stage-note.test.mjs modes/_shared.md
git commit -m "feat(board): actions.changeStage (non-terminal override) + addNote; document profile.stage"
```

---

### Task 8: `board/lib/actions.mjs` — `markEvidence` (human-confirmed / contradicted)

İnsanın bir kanıt iddiasının durumunu doğrulaması/çürütmesi (spec §7 "kanıt durumu işaretle"). Yalnız `human-confirmed` | `contradicted` yazılabilir; claim index sınır kontrollü; çakışma-korumalı.

**Files:**
- Modify: `board/lib/actions.mjs` (bir export ekle)
- Test: `test/board/actions-evidence.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/actions-evidence.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { markEvidence } from '../../board/lib/actions.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/jane/profile.md': '---\nname: Jane\n---\nb\n',
    'roles/r/candidates/jane/evidence.md':
      '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo X"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n  - claim: SQL\n    source: cv\n    evidence: ""\n    evidence_type: none\n    confidence: none\n    status: unverified\n    note: ""\n---\n',
  })
}
const evPath = (root) => join(root, 'roles/r/candidates/jane/evidence.md')
const claims = (root) => parseFrontmatter(readFileSync(evPath(root), 'utf8')).data.claims

describe('markEvidence', () => {
  it('sets a claim status to human-confirmed', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 0, status: 'human-confirmed', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r.ok).toBe(true)
    expect(claims(root)[0].status).toBe('human-confirmed')
    expect(claims(root)[1].status).toBe('unverified') // others untouched
  })

  it('sets a claim status to contradicted', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 1, status: 'contradicted', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r.ok).toBe(true)
    expect(claims(root)[1].status).toBe('contradicted')
  })

  it('refuses a status outside the human-allowed set', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 0, status: 'ai-inferred', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r).toEqual({ ok: false, error: 'status-invalid' })
  })

  it('refuses an out-of-range claim index', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 9, status: 'human-confirmed', userId: 'ali', sinceToken: fileToken(evPath(root)) })
    expect(r).toEqual({ ok: false, error: 'claim-index' })
  })

  it('refuses on a stale token (conflict)', () => {
    const root = repo()
    const r = markEvidence(root, { role: 'r', slug: 'jane', claimIndex: 0, status: 'human-confirmed', userId: 'ali', sinceToken: 'stale' })
    expect(r).toEqual({ ok: false, error: 'conflict' })
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/actions-evidence.test.mjs`
Expected: FAIL — `markEvidence` is not exported

- [ ] **Step 3: actions.mjs'e bir export ekle (dosya sonuna)**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/actions-evidence.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Tüm suite + commit**

Run: `npx vitest run`
Expected: tüm testler yeşil

```bash
git add board/lib/actions.mjs test/board/actions-evidence.test.mjs
git commit -m "feat(board): actions.markEvidence — human-confirmed/contradicted only, bounds-checked"
```

---

### Task 9: `board/server.mjs` — GET route'ları + statik serve + render bağlama

Server'ı boot iskeletinden gerçek bir router'a büyüt: pipeline, rol, JD, aday, triage GET'leri + `/public/*` statik servisi. Aday sayfasında write formları için dosya token'ları burada hesaplanıp render'a geçer. userId server config'inden gelir (form'dan ASLA — tek kullanıcı, güvenlik).

**Files:**
- Modify: `board/server.mjs` (tam router)
- Test: `test/board/server-get.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/server-get.test.mjs`**

```js
import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    'roles/demo-role/jd.md': '---\nrole: demo-role\n---\n# JD body\n<!-- ai-disclosure -->x<!-- /ai-disclosure -->\n',
    'roles/demo-role/candidates/jane-doe/profile.md': '---\nname: Jane Doe\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nCV body\n',
    'roles/demo-role/candidates/jane-doe/evidence.md': '---\nclaims:\n  - claim: Python\n    source: cv\n    evidence: "repo"\n    evidence_type: repo\n    confidence: high\n    status: ai-inferred\n    note: ""\n---\n',
    'roles/demo-role/candidates/jane-doe/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nscores:\n  skill_match: 5\n---\n',
  })
}

let server
async function boot(root, userId = 'ali') {
  server = createBoardServer({ root, userId })
  await new Promise((r) => server.listen(0, r))
  return `http://localhost:${server.address().port}`
}
afterEach(() => server?.close())

describe('board GET routes', () => {
  it('GET / renders the pipeline with the candidate', async () => {
    const base = await boot(repo())
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Pipeline')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('human:ali')
  })

  it('GET /candidate/:role/:slug renders evidence + write forms', async () => {
    const base = await boot(repo())
    const html = await (await fetch(`${base}/candidate/demo-role/jane-doe`)).text()
    expect(html).toContain('Python')
    expect(html).toContain('action/decision')
    expect(html).toContain('name="sinceToken"')
  })

  it('GET /triage/:role renders the queue', async () => {
    const base = await boot(repo())
    const html = await (await fetch(`${base}/triage/demo-role`)).text()
    expect(html).toContain('Triage')
    expect(html).toContain('Jane Doe')
  })

  it('GET /role/:role and /role/:role/jd work', async () => {
    const base = await boot(repo())
    expect(await (await fetch(`${base}/role/demo-role`)).text()).toContain('drift log')
    const jd = await fetch(`${base}/role/demo-role/jd`)
    expect(jd.status).toBe(200)
    expect(await jd.text()).toContain('JD body')
  })

  it('returns 404 for an unknown candidate', async () => {
    const base = await boot(repo())
    const res = await fetch(`${base}/candidate/demo-role/ghost`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/server-get.test.mjs`
Expected: FAIL (boot iskeleti henüz bu route'ları bilmiyor — `/` "boot ok" döner, "Jane Doe" yok)

- [ ] **Step 3: `board/server.mjs`'i tam router olarak yeniden yaz**

```js
// board/server.mjs — Talent-Ops local board (zero-build, zero runtime dep).
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { buildModel, loadCandidate, triageQueue } from './lib/model.mjs'
import { renderPage, renderPipeline, renderCandidate, renderTriage, renderRole } from './lib/render.mjs'
import { loadStates } from '../scripts/lib/states.mjs'
import { fileToken } from '../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const HERE = join(fileURLToPath(import.meta.url), '..')
const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': type })
  res.end(body)
}
const page = (res, status, title, body, userId) => send(res, status, renderPage({ title, body, userId }))

function serveStatic(res, name) {
  const file = join(HERE, 'public', name)
  if (!name || name.includes('..') || !existsSync(file)) return send(res, 404, 'not found', 'text/plain')
  send(res, 200, readFileSync(file), MIME[extname(name)] || 'application/octet-stream')
}

export function createBoardServer({ root = process.cwd(), userId = 'unknown' } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain')
    if (parts[0] === 'public') return serveStatic(res, parts[1])

    if (req.method === 'GET') {
      try {
        if (url.pathname === '/') {
          return page(res, 200, 'Pipeline', renderPipeline(buildModel(root)), userId)
        }
        if (parts[0] === 'role' && parts[1] && parts[2] === 'jd') {
          const jd = join(root, 'roles', parts[1], 'jd.md')
          if (!existsSync(jd)) return send(res, 404, 'no JD', 'text/plain')
          return page(res, 200, 'JD', `<h1>JD — ${parts[1]}</h1><pre>${readFileSync(jd, 'utf8').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`, userId)
        }
        if (parts[0] === 'role' && parts[1]) {
          const role = buildModel(root).roles.find((r) => r.slug === parts[1])
          if (!role) return send(res, 404, 'no role', 'text/plain')
          const cPath = join(root, 'roles', parts[1], 'role-contract.md')
          const body = existsSync(cPath) ? parseFrontmatter(readFileSync(cPath, 'utf8')).body : ''
          return page(res, 200, role.title, renderRole(role, body), userId)
        }
        if (parts[0] === 'triage' && parts[1]) {
          const model = buildModel(root)
          const role = model.roles.find((r) => r.slug === parts[1])
          if (!role) return send(res, 404, 'no role', 'text/plain')
          const states = loadStates(root)
          return page(res, 200, 'Triage', renderTriage(role, triageQueue(role, states), states, { userId }), userId)
        }
        if (parts[0] === 'candidate' && parts[1] && parts[2]) {
          const cdir = join(root, 'roles', parts[1], 'candidates', parts[2])
          if (!existsSync(join(cdir, 'profile.md'))) return send(res, 404, 'no candidate', 'text/plain')
          const detail = loadCandidate(root, parts[1], parts[2])
          const tokens = {
            decision: fileToken(join(cdir, 'decision.md')),
            profileToken: fileToken(join(cdir, 'profile.md')),
            evidence: fileToken(join(cdir, 'evidence.md')),
          }
          return page(res, 200, detail.name, renderCandidate(detail, loadStates(root), { tokens, userId }), userId)
        }
        return send(res, 404, 'not found', 'text/plain')
      } catch (err) {
        return send(res, 500, `board error: ${err.message}`, 'text/plain')
      }
    }
    return send(res, 405, 'method not allowed', 'text/plain')
  })
  return server
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd()
  const cfgPath = join(root, 'config/company-profile.yml')
  const userId = existsSync(cfgPath) ? (parseYaml(readFileSync(cfgPath, 'utf8'))?.user?.id ?? 'unknown') : 'unknown'
  const port = Number(process.env.PORT) || 4319
  const server = createBoardServer({ root, userId })
  server.listen(port, () => console.log(`talent-ops board → http://localhost:${port} (acting as human:${userId})`))
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/server-get.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Boot smoke + tüm suite + commit**

Run: `npx vitest run`
Expected: tüm testler yeşil (server-boot dahil — `/healthz` korundu)

```bash
git add board/server.mjs test/board/server-get.test.mjs
git commit -m "feat(board): full GET router — pipeline/role/jd/candidate/triage + static serve"
```

---

### Task 10: `board/server.mjs` — POST `/action/*` (form → actions → PRG redirect)

Write formları POST-Redirect-GET ile işlenir: body parse → ilgili action (userId server'dan) → başarıda 303 ilgili aday sayfasına, hatada `?error=<code>` ile geri. JS gerekmez.

**Files:**
- Modify: `board/server.mjs` (POST handler ekle)
- Test: `test/board/server-post.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/server-post.test.mjs`**

```js
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createBoardServer } from '../../board/server.mjs'
import { fileToken } from '../../scripts/lib/atomic.mjs'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/jane/profile.md': '---\nname: Jane\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/jane/evidence.md': '---\nclaims: []\n---\n',
    'roles/r/candidates/jane/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\n---\n',
  })
}
let server
async function boot(root, userId = 'ali') {
  server = createBoardServer({ root, userId })
  await new Promise((r) => server.listen(0, r))
  return `http://localhost:${server.address().port}`
}
afterEach(() => server?.close())

function postForm(base, path, fields) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  })
}

describe('board POST /action', () => {
  it('records a decision and 303-redirects to the candidate page', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/decision', {
      role: 'r', slug: 'jane', decision: 'advanced', reason_code: '', reason_detail: 'ok', sinceToken: 'absent',
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/candidate/r/jane')
    const dec = parseFrontmatter(readFileSync(join(root, 'roles/r/candidates/jane/decision.md'), 'utf8')).data
    expect(dec.decided_by).toBe('human:ali') // userId from server, not form
    expect(dec.decision).toBe('advanced')
  })

  it('redirects with ?error=conflict on a stale token and writes nothing', async () => {
    const root = repo()
    const base = await boot(root)
    // create decision first
    await postForm(base, '/action/decision', { role: 'r', slug: 'jane', decision: 'advanced', reason_code: '', sinceToken: 'absent' })
    // second with stale 'absent' → conflict
    const res = await postForm(base, '/action/decision', { role: 'r', slug: 'jane', decision: 'interviewing', reason_code: '', sinceToken: 'absent' })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=conflict')
  })

  it('ignores a form-supplied userId and always stamps the server identity', async () => {
    const root = repo()
    const base = await boot(root, 'ali')
    await postForm(base, '/action/decision', {
      role: 'r', slug: 'jane', decision: 'advanced', reason_code: '', sinceToken: 'absent',
      userId: 'ai:evil', decided_by: 'ai:evil', // attacker-controlled fields — must be ignored
    })
    const dec = parseFrontmatter(readFileSync(join(root, 'roles/r/candidates/jane/decision.md'), 'utf8')).data
    expect(dec.decided_by).toBe('human:ali')
  })

  it('changes stage via POST', async () => {
    const root = repo()
    const base = await boot(root)
    const token = fileToken(join(root, 'roles/r/candidates/jane/profile.md'))
    const res = await postForm(base, '/action/stage', { role: 'r', slug: 'jane', toStage: 'triage', sinceToken: token })
    expect(res.status).toBe(303)
    expect(parseFrontmatter(readFileSync(join(root, 'roles/r/candidates/jane/profile.md'), 'utf8')).data.stage).toBe('triage')
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/server-post.test.mjs`
Expected: FAIL (POST → şu an 405)

- [ ] **Step 3: server.mjs'e POST handling ekle**

`board/server.mjs` başındaki import satırına actions'ı ekle:

```js
import { applyDecision, changeStage, markEvidence, addNote } from './lib/actions.mjs'
```

Body okuyucu yardımcıyı `serveStatic` fonksiyonunun hemen ardına ekle:

```js
function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(new URLSearchParams(data)))
  })
}
```

`createBoardServer` içinde, `if (req.method === 'GET') { ... }` bloğunun HEMEN ÖNCESINE POST yönlendirmesini ekle:

```js
    if (req.method === 'POST' && parts[0] === 'action' && parts[1]) {
      const form = await readBody(req)
      const role = form.get('role')
      const slug = form.get('slug')
      const sinceToken = form.get('sinceToken')
      const dest = `/candidate/${role}/${slug}`
      let result
      // userId ALWAYS from the server config — never from the form
      if (parts[1] === 'decision') {
        result = applyDecision(root, { role, slug, decision: form.get('decision'), reasonCode: form.get('reason_code'), reasonDetail: form.get('reason_detail') || '', userId, sinceToken })
      } else if (parts[1] === 'stage') {
        result = changeStage(root, { role, slug, toStage: form.get('toStage'), userId, sinceToken })
      } else if (parts[1] === 'evidence') {
        result = markEvidence(root, { role, slug, claimIndex: form.get('claimIndex'), status: form.get('status'), userId, sinceToken })
      } else if (parts[1] === 'note') {
        result = addNote(root, { role, slug, text: form.get('text'), userId, sinceToken })
      } else {
        return send(res, 404, 'unknown action', 'text/plain')
      }
      const location = result.ok ? dest : `${dest}?error=${encodeURIComponent(result.error)}`
      res.writeHead(303, { location })
      return res.end()
    }
```

Not: handler artık `async` body okuduğu için `createServer` callback'ini `async (req, res) =>` yap (GET kısmı senkron kalır, sorun değil).

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/server-post.test.mjs`
Expected: 4 passed

- [ ] **Step 5: Tüm suite + commit**

Run: `npx vitest run`
Expected: tüm testler yeşil

```bash
git add board/server.mjs test/board/server-post.test.mjs
git commit -m "feat(board): POST /action/* — PRG writes, server-stamped identity, conflict surfacing"
```

---

### Task 11: `board/server.mjs` — SSE `/events` + dosya watcher

Canlı yenileme: `/events` SSE akışı; `roles/` ve `data/` altındaki değişiklikler bağlı istemcilere `reload` gönderir. Watcher server kapanınca temizlenir (handle sızıntısı yok).

**Files:**
- Modify: `board/server.mjs` (SSE + watch)
- Test: `test/board/server-sse.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/server-sse.test.mjs`**

```js
import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

let server
afterEach(() => server?.close())

describe('board SSE', () => {
  it('GET /events opens an event-stream', async () => {
    server = createBoardServer({ root: makeRepo({ 'roles/r/role-contract.md': approvedContract }), userId: 'ali' })
    await new Promise((r) => server.listen(0, r))
    const { port } = server.address()
    const ctrl = new AbortController()
    const res = await fetch(`http://localhost:${port}/events`, { signal: ctrl.signal })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    ctrl.abort() // close the stream so the test can finish
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/server-sse.test.mjs`
Expected: FAIL (/events → 404 şu an)

- [ ] **Step 3: server.mjs'e SSE + watch ekle**

İmport satırına `watch` ekle:

```js
import { readFileSync, existsSync, watch } from 'node:fs'
```

`createBoardServer` içinde, `const server = createServer(...)` SATIRINDAN ÖNCE istemci kümesini tanımla:

```js
  const clients = new Set()
  function broadcast(msg) {
    for (const res of clients) res.write(`data: ${msg}\n\n`)
  }
```

`if (url.pathname === '/healthz')` kontrolünün hemen ardına SSE route'unu ekle:

```js
    if (url.pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write('data: connected\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
```

`return server` SATIRINDAN ÖNCE watcher'ı kur ve kapanışta temizle:

```js
  const watchers = []
  for (const dir of ['roles', 'data']) {
    const p = join(root, dir)
    if (existsSync(p)) {
      try {
        watchers.push(watch(p, { recursive: true }, () => broadcast('reload')))
      } catch {
        // recursive watch unsupported on some platforms — board still works, just no live refresh
      }
    }
  }
  server.on('close', () => {
    for (const w of watchers) w.close()
    for (const res of clients) res.end()
    clients.clear()
  })
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/server-sse.test.mjs`
Expected: 1 passed

- [ ] **Step 5: Tüm suite + commit**

Run: `npx vitest run`
Expected: tüm testler yeşil

```bash
git add board/server.mjs test/board/server-sse.test.mjs
git commit -m "feat(board): SSE /events + recursive file watcher with clean teardown"
```

---

### Task 12: `board/public/app.js` + `board/public/style.css` — canlı yenileme + stil

Progressive enhancement: JS yalnız SSE'yi dinleyip değişiklikte sayfayı yeniler (JS kapalıyken board yine çalışır, manuel refresh ile). CSS kanban düzenini, kartları ve SLA renklerini verir.

**Files:**
- Create: `board/public/app.js`
- Create: `board/public/style.css`
- Test: `test/board/static.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/static.test.mjs`**

```js
import { describe, it, expect, afterEach } from 'vitest'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

let server
afterEach(() => server?.close())

describe('board static assets', () => {
  it('serves app.js and style.css with correct mime types', async () => {
    server = createBoardServer({ root: makeRepo({ 'roles/r/role-contract.md': approvedContract }), userId: 'ali' })
    await new Promise((r) => server.listen(0, r))
    const base = `http://localhost:${server.address().port}`

    const js = await fetch(`${base}/public/app.js`)
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toMatch(/javascript/)
    expect(await js.text()).toContain('EventSource')

    const css = await fetch(`${base}/public/style.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toMatch(/css/)
    expect(await css.text()).toContain('sla-over')
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/static.test.mjs`
Expected: FAIL (dosyalar yok → 404)

- [ ] **Step 3: `board/public/app.js` yaz**

```js
// board/public/app.js — progressive enhancement: live refresh via SSE.
// The board is fully usable without this file (HTML forms POST natively).
(function () {
  if (!('EventSource' in window)) return
  var es = new EventSource('/events')
  var firstReady = false
  es.onmessage = function (e) {
    if (e.data === 'connected') { firstReady = true; return }
    if (e.data === 'reload' && firstReady) {
      // debounce bursts of file events into a single reload
      clearTimeout(window.__reloadT)
      window.__reloadT = setTimeout(function () { location.reload() }, 200)
    }
  }
})()
```

- [ ] **Step 4: `board/public/style.css` yaz**

```css
/* board/public/style.css — talent-ops board */
:root {
  --bg: #0f1115; --panel: #181b22; --line: #2a2f3a; --fg: #e6e9ef; --muted: #9aa3b2;
  --ok: #2ea043; --warn: #d29922; --over: #f85149; --accent: #4c8dff;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); }
.topbar a { color: var(--accent); text-decoration: none; }
.who { color: var(--muted); font-size: 13px; }
main { padding: 16px; }
h1 { font-size: 20px; } h2 { font-size: 16px; }
.status { font-size: 12px; color: var(--muted); border: 1px solid var(--line); border-radius: 10px; padding: 1px 8px; }
.board { display: flex; gap: 12px; overflow-x: auto; }
.col { flex: 0 0 220px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
.col h3 { margin: 4px 0 8px; font-size: 12px; text-transform: uppercase; color: var(--muted); }
.col .n { color: var(--fg); }
.card { display: block; background: #11141a; border: 1px solid var(--line); border-radius: 6px; padding: 8px; margin-bottom: 8px; text-decoration: none; color: var(--fg); }
.card .name { font-weight: 600; display: block; }
.card .score { color: var(--muted); }
.card .src { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
.rec { font-size: 11px; border-radius: 8px; padding: 0 6px; margin-left: 4px; }
.rec-advance { background: #14331f; color: var(--ok); }
.rec-reject-suggest { background: #3a1416; color: var(--over); }
.missing { font-size: 11px; color: var(--warn); margin-left: 4px; }
.days { float: right; font-size: 11px; border-radius: 8px; padding: 0 6px; }
.sla-ok { color: var(--ok); } .sla-warn { color: var(--warn); } .sla-over { background: #3a1416; color: var(--over); }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--line); padding: 6px 8px; text-align: left; }
.ledger .st-contradicted { color: var(--over); } .ledger .st-human-confirmed { color: var(--ok); }
.calibrate { background: #2a2410; border: 1px solid var(--warn); padding: 8px; border-radius: 6px; margin: 8px 0; }
.anti-miss { color: var(--muted); } .needs-human { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 8px; }
form.act { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px; margin: 8px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: end; }
form.act.inline { padding: 6px; }
label { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 2px; }
input, select { background: #11141a; color: var(--fg); border: 1px solid var(--line); border-radius: 4px; padding: 5px; }
button { background: var(--accent); color: #fff; border: 0; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
pre { background: var(--panel); border: 1px solid var(--line); padding: 10px; border-radius: 6px; overflow-x: auto; }
```

- [ ] **Step 5: PASS gör**

Run: `npx vitest run test/board/static.test.mjs`
Expected: 1 passed

- [ ] **Step 6: Tüm suite + commit**

Run: `npx vitest run`
Expected: tüm board + core testleri yeşil

```bash
git add board/public/app.js board/public/style.css test/board/static.test.mjs
git commit -m "feat(board): live-refresh client (SSE) + stylesheet"
```

---

### Task 13: README board bölümü + uçtan uca gerçek-veri doğrulama

**Files:**
- Modify: `README.md` (board bölümü; "ships separately" notu kaldırılır)
- Create: `board/board-checks.md` (manuel davranış kontrol listesi, golden-checks paralel)

- [ ] **Step 1: README'deki board satırını güncelle**

`README.md` sonundaki şu satırı bul:
```
Web board (local triage UI) ships separately — see the roadmap.
```
ve şununla değiştir:
```
## Web board (local triage UI)

`npm run board` starts a local, zero-build board at http://localhost:4319
(set `PORT` to change). It reads the same files the CLI writes and renders
four views: a pipeline kanban, a candidate detail (evidence ledger + score
breakdown), a triage queue, and a role view. Write actions — record a
reason-coded decision, change a non-terminal stage, confirm/contradict an
evidence claim, add a note — go straight back to the candidate files,
atomically, stamped `human:<your config user.id>`. The board never writes
an AI identity and never decides; it records what you decide. Run
`npm run verify` any time to confirm integrity.

Manual behavior checks live in `board/board-checks.md`.
```

- [ ] **Step 2: `board/board-checks.md` yaz**

````markdown
# Board Behavior Checks

Run against a populated repo (e.g. after the CLI golden-checks run).

```bash
npm run board   # http://localhost:4319
```

- [ ] BC1 — Pipeline: every candidate appears in the column matching its
  derived stage; cards show score+confidence, recommendation, missing
  count, source, and an SLA-colored day count.
- [ ] BC2 — Candidate page: evidence ledger table, 5-layer score
  breakdown, and decision section all render; write forms carry a
  `sinceToken` hidden input.
- [ ] BC3 — Record a decision (e.g. advanced): decision.md gains
  `decided_by: human:<your id>`, correct `override`, and the pipeline
  reflects the new stage. `npm run verify` → OK.
- [ ] BC4 — Reject without a reason code: the form's empty reason option
  is refused; the page returns with `?error=reason-required`.
- [ ] BC5 — Change stage to a non-terminal stage (screened→triage): the
  card moves; attempting a terminal stage is not offered in the dropdown.
- [ ] BC6 — Mark an evidence claim human-confirmed / contradicted: the
  ledger status updates and is color-coded.
- [ ] BC7 — Add a note: it appears under `## Notes` in profile.md, stamped
  with date + `human:<id>`.
- [ ] BC8 — Conflict: open a candidate, edit its decision.md by hand
  (e.g. via the CLI), then submit the board form → redirected with
  `?error=conflict`, board write refused, your hand edit intact.
- [ ] BC9 — Live refresh: with the board open, run a CLI mode that writes
  a file (or `npm run forget`); the open page reloads within ~1s.
- [ ] BC10 — Disclosure/identity: the top bar shows `human:<id>`; no view
  offers any way to record an AI decision.
````

- [ ] **Step 3: Uçtan uca gerçek-veri doğrulaması (manuel, kaydet)**

Working tree'de zaten gerçek veri var (`roles/ai-automation-specialist-hr/`, 10 aday). Çalıştır:

Run: `npx vitest run`
Expected: tüm suite yeşil (core + board)

Run: `(PORT=4319 npm run board &) ; sleep 1 ; curl -s localhost:4319/ | grep -c "AI & Automation Specialist" ; curl -s localhost:4319/candidate/ai-automation-specialist-hr/maya-lindqvist | grep -c "Evidence ledger" ; curl -s "localhost:4319/triage/ai-automation-specialist-hr" | grep -c "Triage" ; kill %1 2>/dev/null`
Expected: her grep `1` (pipeline rol başlığını, aday sayfası evidence ledger'ı, triage sayfası başlığı gösterir)

Run: `npm run verify`
Expected: `verify: OK` (board hiçbir şeyi bozmadı)

- [ ] **Step 4: Commit**

```bash
git add README.md board/board-checks.md
git commit -m "docs(board): README board section + manual behavior checks (BC1-BC10)"
```

---

### Task 14: Triage toplu red (actions.bulkReject + server POST + UI zaten Task 5'te)

Spec §7 "çoklu seçim, sebep kodlu toplu karar, anti-miss örneklem kutusu". UI (checkbox'lar + bulk form + zorunlu anti-miss onayı) Task 5 renderTriage'da hazır; bu task backend'i bağlar. Toplu işlem yalnız **red** (advance bilinçli, tek tek aday sayfasından). Her aday yine `applyDecision`'dan geçer — aynı insan-damgası, sebep-kodu, çakışma garantileri; zaten kararı olan aday atlanır (skipped).

**Files:**
- Modify: `board/lib/actions.mjs` (`bulkReject` export + `fileToken` import)
- Modify: `board/server.mjs` (POST `/action/triage-reject` branch + `bulkReject` import)
- Test: `test/board/actions-bulk.test.mjs`, `test/board/server-triage.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/actions-bulk.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { bulkReject } from '../../board/lib/actions.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  const files = { 'roles/r/role-contract.md': approvedContract }
  for (const slug of ['a', 'b', 'c']) {
    files[`roles/r/candidates/${slug}/profile.md`] = `---\nname: ${slug}\napplied_at: 2026-06-01\n---\nb\n`
    files[`roles/r/candidates/${slug}/evidence.md`] = '---\nclaims: []\n---\n'
    files[`roles/r/candidates/${slug}/score.md`] = '---\nweighted_total: 3.0\nconfidence: medium\nrecommendation: hold\nmissing_evidence: []\n---\n'
  }
  return makeRepo(files)
}
const decExists = (root, slug) => existsSync(join(root, `roles/r/candidates/${slug}/decision.md`))

describe('bulkReject', () => {
  it('rejects the selected candidates with the reason code, leaves others untouched', () => {
    const root = repo()
    const r = bulkReject(root, { role: 'r', slugs: ['a', 'c'], reasonCode: 'stronger-shortlist', userId: 'ali', now: new Date('2026-06-11') })
    expect(r.ok).toBe(true)
    expect(r.rejected.sort()).toEqual(['a', 'c'])
    expect(decExists(root, 'a')).toBe(true)
    expect(decExists(root, 'c')).toBe(true)
    expect(decExists(root, 'b')).toBe(false)
  })

  it('refuses an invalid reason code', () => {
    const root = repo()
    expect(bulkReject(root, { role: 'r', slugs: ['a'], reasonCode: 'felt-wrong', userId: 'ali' })).toEqual({ ok: false, error: 'reason-invalid' })
  })

  it('refuses an AI identity', () => {
    const root = repo()
    expect(bulkReject(root, { role: 'r', slugs: ['a'], reasonCode: 'stronger-shortlist', userId: 'ai:x' })).toEqual({ ok: false, error: 'ai-identity' })
  })

  it('refuses an empty selection', () => {
    const root = repo()
    expect(bulkReject(root, { role: 'r', slugs: [], reasonCode: 'stronger-shortlist', userId: 'ali' })).toEqual({ ok: false, error: 'no-selection' })
  })

  it('skips a candidate that already has a decision (conflict), still rejects the rest', () => {
    const root = repo()
    bulkReject(root, { role: 'r', slugs: ['a'], reasonCode: 'stronger-shortlist', userId: 'ali', now: new Date('2026-06-11') })
    const r = bulkReject(root, { role: 'r', slugs: ['a', 'b'], reasonCode: 'stronger-shortlist', userId: 'ali', now: new Date('2026-06-11') })
    expect(r.rejected).toEqual(['b'])
    expect(r.skipped).toEqual([{ slug: 'a', error: 'conflict' }])
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/actions-bulk.test.mjs`
Expected: FAIL — `bulkReject` is not exported

- [ ] **Step 3: actions.mjs'e `bulkReject` ekle (dosya sonuna)**

```js
// --- bulkReject (Task 14) — triage bulk decision, reject only ---
import { fileToken } from '../../scripts/lib/atomic.mjs'

export function bulkReject(root, { role, slugs, reasonCode, userId, now = new Date() }) {
  if (String(userId).startsWith('ai:')) return { ok: false, error: 'ai-identity' }
  const states = loadStates(root)
  if (!states.reason_codes.includes(reasonCode)) return { ok: false, error: 'reason-invalid' }
  const list = (Array.isArray(slugs) ? slugs : [slugs]).filter(Boolean)
  if (!list.length) return { ok: false, error: 'no-selection' }
  const rejected = []
  const skipped = []
  for (const slug of list) {
    const token = fileToken(join(candDir(root, role, slug), 'decision.md'))
    const r = applyDecision(root, { role, slug, decision: 'rejected', reasonCode, reasonDetail: 'bulk triage reject', userId, sinceToken: token, now })
    if (r.ok) rejected.push(slug)
    else skipped.push({ slug, error: r.error })
  }
  return { ok: true, rejected, skipped }
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/actions-bulk.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Server POST testi yaz — `test/board/server-triage.test.mjs`**

```js
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createBoardServer } from '../../board/server.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

function repo() {
  const files = { 'roles/r/role-contract.md': approvedContract }
  for (const slug of ['a', 'b']) {
    files[`roles/r/candidates/${slug}/profile.md`] = `---\nname: ${slug}\napplied_at: 2026-06-01\n---\nb\n`
    files[`roles/r/candidates/${slug}/evidence.md`] = '---\nclaims: []\n---\n'
    files[`roles/r/candidates/${slug}/score.md`] = '---\nweighted_total: 3.0\nconfidence: medium\nrecommendation: hold\nmissing_evidence: []\n---\n'
  }
  return makeRepo(files)
}
let server
async function boot(root) {
  server = createBoardServer({ root, userId: 'ali' })
  await new Promise((r) => server.listen(0, r))
  return `http://localhost:${server.address().port}`
}
afterEach(() => server?.close())

function postForm(base, path, pairs) {
  const body = new URLSearchParams()
  for (const [k, v] of pairs) body.append(k, v)
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'manual' })
}

describe('POST /action/triage-reject', () => {
  it('refuses without the anti-miss confirmation and writes nothing', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/triage-reject', [['role', 'r'], ['reason_code', 'stronger-shortlist'], ['slug', 'a'], ['slug', 'b']])
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=anti-miss-unconfirmed')
    expect(existsSync(join(root, 'roles/r/candidates/a/decision.md'))).toBe(false)
  })

  it('rejects the selected candidates when confirmed', async () => {
    const root = repo()
    const base = await boot(root)
    const res = await postForm(base, '/action/triage-reject', [['role', 'r'], ['reason_code', 'stronger-shortlist'], ['antiMissConfirmed', 'yes'], ['slug', 'a'], ['slug', 'b']])
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/triage/r')
    expect(existsSync(join(root, 'roles/r/candidates/a/decision.md'))).toBe(true)
    expect(existsSync(join(root, 'roles/r/candidates/b/decision.md'))).toBe(true)
  })
})
```

- [ ] **Step 6: server.mjs'e triage-reject branch ekle**

`board/server.mjs` import satırına `bulkReject` ekle:

```js
import { applyDecision, changeStage, markEvidence, addNote, bulkReject } from './lib/actions.mjs'
```

POST dispatch zincirinde, `note` branch'inin ardına (genel `else { 404 }`'ten önce) şu branch'i ekle. Bu branch KENDİ redirect'ini yapar ve ortak `location` akışına girmez (toplu işlemde tek aday yok):

```js
      } else if (parts[1] === 'triage-reject') {
        const tdest = `/triage/${role}`
        if (form.get('antiMissConfirmed') !== 'yes') {
          res.writeHead(303, { location: `${tdest}?error=anti-miss-unconfirmed` })
          return res.end()
        }
        const r = bulkReject(root, { role, slugs: form.getAll('slug'), reasonCode: form.get('reason_code'), userId })
        res.writeHead(303, { location: r.ok ? `${tdest}?rejected=${r.rejected.length}` : `${tdest}?error=${encodeURIComponent(r.error)}` })
        return res.end()
      }
```

- [ ] **Step 7: PASS gör + tüm suite**

Run: `npx vitest run test/board/server-triage.test.mjs`
Expected: 2 passed

Run: `npx vitest run`
Expected: tüm core + board testleri yeşil

- [ ] **Step 8: README + board-checks güncelle**

`README.md` board bölümünde "change a non-terminal stage" cümlesinin geçtiği paragrafa toplu red'i ekle — şu cümleyi:
```
four views: a pipeline kanban, a candidate detail (evidence ledger + score
breakdown), a triage queue, and a role view.
```
şununla değiştir:
```
four views: a pipeline kanban, a candidate detail (evidence ledger + score
breakdown), a triage queue (with anti-miss-gated bulk reject), and a role view.
```

`board/board-checks.md` sonuna BC11 ekle:
```
- [ ] BC11 — Triage bulk reject: select two screened candidates, pick a
  reason code, tick the anti-miss box, submit → both gain a human-stamped
  rejected decision.md; submitting without the anti-miss box is refused
  with `?error=anti-miss-unconfirmed`.
```

- [ ] **Step 9: Commit**

```bash
git add board/lib/actions.mjs board/server.mjs test/board/actions-bulk.test.mjs test/board/server-triage.test.mjs README.md board/board-checks.md
git commit -m "feat(board): triage bulk-reject — anti-miss-gated, per-candidate guarantees preserved"
```

---

## Plan Sonu Kontrolü (executor için)

- [ ] `npx vitest run` → core (32) + board testleri, tümü yeşil
- [ ] `npm run board` → localhost:4319 açılır, 4 görünüm gerçek veriyle render olur
- [ ] `npm run verify` → board write'larından sonra `verify: OK`
- [ ] `board/board-checks.md` BC1-BC10 manuel koşuldu, sonuçlar işlendi
- [ ] Spec §7 maddeleri karşılandı: tek Node process ✓, dosya watcher+SSE ✓, 4 ekran ✓, beyaz-listeli write ✓, human damgası + ai reddi + atomik + çakışma ✓, uç aşama yalnız kararla ✓

**Sonraki adımlar (bu plan dışı):** golden-checks + board-checks'i CI'da koşmak; public OSS lansmanı (LICENSE + görünürlük).
