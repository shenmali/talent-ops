# career-ops Parity — Plan 1 (non-invasive trio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** career-ops'un üç simetriğini talent-ops'a non-invasive ekle: `outreach` (recruiter→aday mesaj taslağı), `followup` (bekleyen adaylar + cadence + draft), `analytics` (hiring funnel + içgörü). Hiçbiri mevcut scoring/screen/states davranışını değiştirmez — yalnız okur + yeni dosya/çıktı yazar.

**Architecture:** İki yeni zero-dep deterministik script (`scripts/followup.mjs`, `scripts/analyze-funnel.mjs`) ortak yeni bir okuma kütüphanesi (`scripts/lib/candidates.mjs`) üzerine kurulur; üç yeni LLM mode (`modes/{outreach,followup,analytics}.md`). Script'ler LLM çağırmaz. outreach + followup, `candidate/outreach.md` kronolojik draft dosyasını paylaşır.

**Tech Stack:** Node ≥20 (ESM), `yaml` (mevcut — cadence config okuma), `vitest` (mevcut). Yeni bağımlılık YOK.

**Spec:** `docs/superpowers/specs/2026-06-17-career-ops-parity-design.md` (Plan 1 bölümleri §4-§7, §9-§12). Plan 2 (authenticity) AYRI plan — buraya DAHİL DEĞİL.

**Mevcut çekirdek (değiştirilmez, yeniden kullanılır):**
- `scripts/lib/frontmatter.mjs` — `parseFrontmatter(text)→{data,body}`, `serializeFrontmatter(data,body)→string`
- `scripts/lib/states.mjs` — `loadStates(root)→{stages,terminal,decisions,reason_codes}`
- `scripts/lib/atomic.mjs` — `writeAtomic(path,content)`, `fileToken(path)`, `writeIfUnchanged(path,content,sinceToken)`
- `test/helpers.mjs` — `makeRepo(files)`, `approvedContract`, `candidateFiles(role,slug,opts)`, `trackerWith(rows)`
- Stage türetme referansı: `board/lib/model.mjs` (decision > stageOverride > score > profile; updatedAt = decided_at > scored_at > applied_at). **Bu mantık `scripts/lib/candidates.mjs`'de scripts katmanı için yeniden uygulanır — board dosyasına dokunulmaz.**

---

## Dosya Haritası (Plan 1 sonunda)

```
HR-ops/
├── modes/
│   ├── outreach.md        # YENİ — recruiter→aday draft (invite/reject/offer)   [Task 3]
│   ├── followup.md        # YENİ — bekleyen adaylar dashboard + followup draft  [Task 5]
│   ├── analytics.md       # YENİ — funnel + içgörü sunumu + rapor               [Task 7]
│   └── _shared.md         # data contract'a outreach.md eklenir                 [Task 1]
├── scripts/
│   ├── lib/candidates.mjs # YENİ — deriveStage/deriveUpdatedAt/collectCandidates [Task 2]
│   ├── followup.mjs       # YENİ — loadCadence + collectFollowups + CLI         [Task 4]
│   └── analyze-funnel.mjs # YENİ — analyzeFunnel + CLI                          [Task 6]
├── config/company-profile.example.yml  # cadence: bölümü eklenir                [Task 1]
├── .gitignore             # /data/analytics-*.md eklenir                        [Task 1]
├── package.json           # followup + analyze-funnel scriptleri               [Task 1]
├── test/board/            # candidates/followup/analyze-funnel vitest testleri  [Task 2,4,6]
├── examples/golden-checks.md  # outreach davranış kontrolü eklenir              [Task 8]
└── README.md              # yeni komutlar                                       [Task 8]
```

**Sorumluluk sınırları:** `candidates.mjs` salt-okuma (candidate dosyaları → normalize liste); `followup.mjs`/`analyze-funnel.mjs` saf hesap + ince CLI; modlar yalnız LLM talimatı. Hiçbir script LLM çağırmaz, hiçbiri mevcut score/evidence/decision ÜRETMEZ (yalnız okur).

---

### Task 1: Hazırlık — config cadence + gitignore + package.json + _shared data contract

**Files:**
- Modify: `config/company-profile.example.yml`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `modes/_shared.md`

- [ ] **Step 1: `config/company-profile.example.yml` sonuna `cadence` bölümü ekle**

Dosyanın sonundaki `retention:` bloğunun ardına ekle:

```yaml

cadence:
  # followup mode/script: a candidate is "overdue" after this many days
  # waiting in the given situation. Defaults used if this block is absent.
  screened: 5   # screened, awaiting triage
  interview: 7  # in interview, awaiting a decision
  offer: 5      # offer extended, awaiting candidate response
```

- [ ] **Step 2: `.gitignore`'a cross-role analytics raporunu ekle**

`/data/batch-state.md` satırının hemen ardına ekle:

```
/data/analytics-*.md
```

- [ ] **Step 3: `package.json` scripts bloğuna iki script ekle**

`"forget"` satırının ardına (virgül dikkat):

```json
    "followup": "node scripts/followup.mjs",
    "analyze-funnel": "node scripts/analyze-funnel.mjs"
```

Sonuç:
```json
  "scripts": {
    "test": "vitest run",
    "board": "node board/server.mjs",
    "verify": "node scripts/verify.mjs",
    "dedupe": "node scripts/dedupe.mjs",
    "export-audit": "node scripts/export-audit.mjs",
    "forget": "node scripts/forget.mjs",
    "followup": "node scripts/followup.mjs",
    "analyze-funnel": "node scripts/analyze-funnel.mjs"
  },
```

- [ ] **Step 4: `modes/_shared.md` data contract'a `outreach.md` ekle**

`packet.md` sözleşme satırının ardına ekle:

```
- `outreach.md`: chronological draft messages to the candidate (invite |
  reject | offer | followup-update), each stamped `drafted_by: ai:<model>`
  and `status: draft|approved`. Drafts only — never sent. Not a decision.
```

- [ ] **Step 5: Doğrula**

Run: `node -e "import('yaml').then(async y=>{const fs=await import('node:fs');const c=y.parse(fs.readFileSync('config/company-profile.example.yml','utf8'));console.log('cadence:',JSON.stringify(c.cadence))})"`
Expected: `cadence: {"screened":5,"interview":7,"offer":5}`

Run: `node -e "console.log(require('./package.json').scripts.followup, '|', require('./package.json').scripts['analyze-funnel'])"`
Expected: `node scripts/followup.mjs | node scripts/analyze-funnel.mjs`

Run: `grep -c "outreach.md" modes/_shared.md`
Expected: `1` (veya daha fazla)

- [ ] **Step 6: Commit**

```bash
git add config/company-profile.example.yml .gitignore package.json modes/_shared.md
git commit -m "chore(parity): cadence config, analytics gitignore, npm scripts, outreach.md contract"
```

---

### Task 2: `scripts/lib/candidates.mjs` — ortak okuma kütüphanesi (TDD)

followup ve analytics'in ortak girdisi: candidate dosyalarını gezip stage + updatedAt + outcome alanlarıyla normalize bir liste döndürür. `board/lib/model.mjs`'deki türetme mantığının scripts-katmanı ikizi (board'a dokunmadan, DRY scripts içinde).

**Files:**
- Create: `scripts/lib/candidates.mjs`
- Test: `test/board/candidates.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/candidates.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { deriveStage, deriveUpdatedAt, collectCandidates } from '../../scripts/lib/candidates.mjs'
import { loadStates } from '../../scripts/lib/states.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

describe('deriveStage', () => {
  const states = { stages: ['inbox','parsed','screened','triage','interview','decision','hired','rejected','withdrawn'], terminal: ['hired','rejected','withdrawn'], decisions: { advanced: 'interview', interviewing: 'interview', offer: 'decision', hired: 'hired', rejected: 'rejected', withdrawn: 'withdrawn' } }
  it('decision wins over everything', () => {
    expect(deriveStage(states, { decision: { decision: 'rejected' }, stageOverride: 'triage', hasScore: true, hasProfile: true })).toBe('rejected')
  })
  it('non-terminal stage override beats score', () => {
    expect(deriveStage(states, { decision: null, stageOverride: 'triage', hasScore: true, hasProfile: true })).toBe('triage')
  })
  it('terminal stage override is ignored', () => {
    expect(deriveStage(states, { decision: null, stageOverride: 'rejected', hasScore: true, hasProfile: true })).toBe('screened')
  })
  it('score -> screened, profile -> parsed', () => {
    expect(deriveStage(states, { decision: null, stageOverride: undefined, hasScore: true, hasProfile: true })).toBe('screened')
    expect(deriveStage(states, { decision: null, stageOverride: undefined, hasScore: false, hasProfile: true })).toBe('parsed')
  })
})

describe('deriveUpdatedAt', () => {
  it('prefers decided_at, then scored_at, then applied_at', () => {
    expect(deriveUpdatedAt({ decision: { decided_at: '2026-06-04' }, score: { scored_at: '2026-06-02' }, profile: { applied_at: '2026-06-01' } })).toBe('2026-06-04')
    expect(deriveUpdatedAt({ decision: null, score: { scored_at: '2026-06-02' }, profile: { applied_at: '2026-06-01' } })).toBe('2026-06-02')
    expect(deriveUpdatedAt({ decision: null, score: null, profile: { applied_at: '2026-06-01' } })).toBe('2026-06-01')
    expect(deriveUpdatedAt({ decision: null, score: null, profile: {} })).toBe(null)
  })
})

describe('collectCandidates', () => {
  function repo() {
    return makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      'roles/demo-role/candidates/jane/profile.md': '---\nname: Jane\nsource: "inbound:jane.txt"\napplied_at: 2026-06-01\n---\nb\n',
      'roles/demo-role/candidates/jane/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
      'roles/demo-role/candidates/bob/profile.md': '---\nname: Bob\nsource: "csv:applicants.csv"\napplied_at: 2026-06-01\n---\nb\n',
      'roles/demo-role/candidates/bob/score.md': '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: reject-suggest\nscored_at: 2026-06-03\n---\n',
      'roles/demo-role/candidates/bob/decision.md': '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:ali\noverride: false\ndecided_at: 2026-06-04\n---\n',
    })
  }
  it('normalizes each candidate with stage, updatedAt, source and outcome fields', () => {
    const root = repo()
    const states = loadStates(root)
    const list = collectCandidates(root, states).sort((a, b) => a.slug.localeCompare(b.slug))
    expect(list).toHaveLength(2)
    const bob = list.find((c) => c.slug === 'bob')
    expect(bob.role).toBe('demo-role')
    expect(bob.stage).toBe('rejected')
    expect(bob.updatedAt).toBe('2026-06-04')
    expect(bob.source).toBe('csv:applicants.csv')
    expect(bob.reasonCode).toBe('insufficient-evidence')
    expect(bob.override).toBe(false)
    const jane = list.find((c) => c.slug === 'jane')
    expect(jane.stage).toBe('screened')
    expect(jane.updatedAt).toBe('2026-06-02')
    expect(jane.weightedTotal).toBe(4.3)
    expect(jane.recommendation).toBe('advance')
    expect(jane.decision).toBe(null)
  })
  it('filters by role when a roleFilter is given', () => {
    const root = makeRepo({
      'roles/r1/role-contract.md': approvedContract,
      'roles/r1/candidates/a/profile.md': '---\nname: A\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r2/role-contract.md': approvedContract,
      'roles/r2/candidates/b/profile.md': '---\nname: B\napplied_at: 2026-06-01\n---\nb\n',
    })
    const states = loadStates(root)
    expect(collectCandidates(root, states, 'r1').map((c) => c.slug)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/candidates.test.mjs`
Expected: FAIL — "Cannot find module '../../scripts/lib/candidates.mjs'"

- [ ] **Step 3: Implementasyon — `scripts/lib/candidates.mjs`**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/candidates.test.mjs`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/candidates.mjs test/board/candidates.test.mjs
git commit -m "feat(parity): candidates.mjs — shared read layer (stage/updatedAt/collect)"
```

---

### Task 3: `modes/outreach.md` — recruiter→aday draft mesaj mode'u

LLM talimat dosyası (script yok). `candidate/outreach.md` formatını tanımlar; followup mode da bu formata `followup-update` yazar. Sadece taslak — gönderim yok.

**Files:**
- Create: `modes/outreach.md`

- [ ] **Step 1: `modes/outreach.md` yaz — EXACTLY:**

````markdown
# Mode: outreach

Purpose: draft a personalized message from the recruiter TO the candidate.
Drafts only — talent-ops never sends. The human copies/sends manually.

Invocation: /talent-ops outreach <role-slug> <candidate-slug> [invite|reject|offer]

## Preconditions
- candidates/<slug>/profile.md exists (refuse: "run intake first").
- If type is omitted, infer from stage: interview -> invite, rejected ->
  reject, decision+`decision: offer` -> offer. If the requested type
  conflicts with the stage, warn and ask.
- `reject` requires a recorded rejection (decision.md); `offer` requires a
  recorded offer/hired decision. Refuse otherwise: "record the decision
  first" (outreach reflects a decision, it does not make one).

## Output file: candidate/outreach.md
Chronological append. Each entry:

```
## <type> — <YYYY-MM-DD> · drafted_by: ai:<model> · status: draft
<message body>
```

Append a new entry (never overwrite prior drafts). Atomic write: read the
file (or start empty), append, write to `<file>.tmp`, rename. After the
human edits/approves, they change `status: draft` to `status: approved`.

## Tone
Read `config/company-profile.yml`: use `jd.tone` and `company.values`. Warm,
specific, human. No buzzwords. Default to the candidate's language if the
profile/CV signals one; otherwise English.

## Message types

### invite (interview invitation)
- Source: profile (name), score.md strengths, evidence.md strongest item.
- Structure (3 short paragraphs): (1) genuine, specific reason they stood
  out — cite a concrete strength/evidence item, not flattery; (2) what the
  next step is (which interview stage, what it covers, who runs it — from
  the role contract); (3) a clear, low-friction call to schedule.

### reject (respectful decline)
- Source: decision.md (`reason_code`, `reason_detail`), score.md.
- MUST stay consistent with the recorded `reason_code` — do not invent a
  different reason, do not over-explain, do not promise feedback you can't
  give. Respectful and brief. If the candidate is in talent memory
  (future_fit set), you may add one honest sentence inviting future contact.
- Never disclose other candidates or internal scores.

### offer
- Source: decision.md, `config/company-profile.yml` comp_bands.
- Structure: congratulations + role + the comp band (ONLY if present in
  config; never invent numbers — if absent, leave a clear placeholder and
  flag it) + next concrete step. This is a draft, not a binding offer;
  say final terms come in writing from a named human.

### followup-update (written by the followup mode, same format)
- A short, warm "your application is moving / here's the next step / thanks
  for your patience" note for a candidate who has been waiting. No new
  commitments; honest about timing.

## Rules
1. Drafts only — never send, never call an email/LinkedIn API.
2. outreach is NOT a decision: never write to decision.md, never stamp
   `decided_by`. The draft is `drafted_by: ai:<model>` and starts `draft`.
3. Reject drafts MUST match the recorded reason_code.
4. Never leak other candidates' data or internal scores into a message.
5. After writing, tell the user to run `npm run verify` (unaffected, but
   keeps the habit) and to review/approve the draft before sending.
````

- [ ] **Step 2: Doğrula**

Run: `grep -c "drafted_by: ai:" modes/outreach.md`
Expected: >= 1

Run: `grep -c "Drafts only" modes/outreach.md`
Expected: >= 1

- [ ] **Step 3: Commit**

```bash
git add modes/outreach.md
git commit -m "feat(parity): outreach mode — recruiter->candidate draft (invite/reject/offer)"
```

---

### Task 4: `scripts/followup.mjs` — cadence + bekleyen adaylar (TDD)

Deterministik, zero-dep. Eşikler config'den (default 5/7/5). `scripts/lib/candidates.mjs`'i kullanır.

**Files:**
- Create: `scripts/followup.mjs`
- Test: `test/board/followup.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/followup.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCadence, collectFollowups } from '../../scripts/followup.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

describe('loadCadence', () => {
  it('returns defaults when no config', () => {
    const root = makeRepo({})
    expect(loadCadence(root)).toEqual({ screened: 5, interview: 7, offer: 5 })
  })
  it('merges config overrides over defaults', () => {
    const root = makeRepo({
      'config/company-profile.yml': 'user:\n  id: ali\ncadence:\n  interview: 3\n',
    })
    expect(loadCadence(root)).toEqual({ screened: 5, interview: 3, offer: 5 })
  })
})

describe('collectFollowups', () => {
  // jane: screened, scored 8 days ago -> awaiting triage, overdue (>5)
  // tom: interview (advanced), decided 2 days ago -> awaiting decision, waiting (<7)
  // ozge: offer, decided 6 days ago -> awaiting candidate-response, overdue (>5)
  // ali: rejected -> terminal, not a followup
  function repo() {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/jane/profile.md': '---\nname: Jane\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/jane/score.md': '---\nweighted_total: 4\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
      'roles/r/candidates/tom/profile.md': '---\nname: Tom\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/tom/score.md': '---\nweighted_total: 3.5\nconfidence: medium\nrecommendation: shortlist\nscored_at: 2026-06-03\n---\n',
      'roles/r/candidates/tom/decision.md': '---\ndecision: advanced\nreason_code: ""\ndecided_by: human:ali\ndecided_at: 2026-06-08\n---\n',
      'roles/r/candidates/ozge/profile.md': '---\nname: Ozge\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/ozge/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
      'roles/r/candidates/ozge/decision.md': '---\ndecision: offer\nreason_code: ""\ndecided_by: human:ali\ndecided_at: 2026-06-04\n---\n',
      'roles/r/candidates/ali/profile.md': '---\nname: Ali\napplied_at: 2026-06-01\n---\nb\n',
      'roles/r/candidates/ali/score.md': '---\nweighted_total: 2\nconfidence: low\nrecommendation: reject-suggest\nscored_at: 2026-06-02\n---\n',
      'roles/r/candidates/ali/decision.md': '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:ali\ndecided_at: 2026-06-03\n---\n',
    })
    return root
  }
  const now = new Date('2026-06-10')

  it('flags screened (triage), interview (decision), offer (candidate-response); skips terminal', () => {
    const fu = collectFollowups(repo(), { now })
    const bySlug = Object.fromEntries(fu.map((f) => [f.slug, f]))
    expect(bySlug.jane.waitingFor).toBe('triage')
    expect(bySlug.jane.daysWaiting).toBe(8)
    expect(bySlug.jane.urgency).toBe('overdue') // 8 > 5
    expect(bySlug.tom.waitingFor).toBe('decision')
    expect(bySlug.tom.daysWaiting).toBe(2)
    expect(bySlug.tom.urgency).toBe('waiting') // 2 < 7
    expect(bySlug.ozge.waitingFor).toBe('candidate-response')
    expect(bySlug.ozge.urgency).toBe('overdue') // 6 > 5
    expect(bySlug.ali).toBeUndefined() // terminal rejected, not a followup
  })

  it('sorts overdue first, then by daysWaiting desc', () => {
    const fu = collectFollowups(repo(), { now })
    expect(fu[0].urgency).toBe('overdue')
    // jane(8) before ozge(6) among overdue
    const overdue = fu.filter((f) => f.urgency === 'overdue').map((f) => f.slug)
    expect(overdue).toEqual(['jane', 'ozge'])
  })

  it('honors a custom cadence', () => {
    const fu = collectFollowups(repo(), { now, cadence: { screened: 10, interview: 7, offer: 5 } })
    const jane = fu.find((f) => f.slug === 'jane')
    expect(jane.urgency).toBe('waiting') // 8 < 10 now
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/followup.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon — `scripts/followup.mjs`**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/followup.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/followup.mjs test/board/followup.test.mjs
git commit -m "feat(parity): followup.mjs — cadence-based waiting-candidate detection"
```

---

### Task 5: `modes/followup.md` — bekleyen adaylar dashboard + draft

LLM talimat dosyası. `scripts/followup.mjs` çıktısını sunar + isteğe bağlı `followup-update` draft (outreach formatını kullanır).

**Files:**
- Create: `modes/followup.md`

- [ ] **Step 1: `modes/followup.md` yaz — EXACTLY:**

````markdown
# Mode: followup

Purpose: surface candidates who have been waiting past cadence, and (on
request) draft a warm "your application is moving" update. The script
decides nothing — it flags timing; the human acts.

Invocation: /talent-ops followup [role-slug]

## Steps
1. Run the cadence script and read its output:
   ```bash
   npm run followup
   ```
   It lists, sorted by urgency (overdue > due > waiting): each waiting
   candidate with role/slug, what they're waiting for (triage / decision /
   candidate-response), days waiting, and the threshold. Thresholds come
   from `config/company-profile.yml` `cadence:` (defaults 5/7/5).
2. Present a dashboard table:
   ```
   Follow-up — {date}   ({N} waiting)
   | urgency | candidate | role | awaiting | days | threshold |
   ```
   Use indicators: overdue (act now), due (today), waiting (on track).
   If role-slug was given, filter to that role.
3. If the user asks to draft an update for a candidate, switch to the
   outreach `followup-update` type (see modes/outreach.md): append a short,
   warm, honest "still moving / next step / thanks for your patience" note
   to `candidates/<slug>/outreach.md`. No new commitments. Draft only.

## Rules
- The script never writes and never decides — it only reads + computes.
- A "decision" candidate is only a followup when `decision: offer`
  (awaiting the candidate's response); other terminal stages are not
  followups.
- Drafts go through the outreach format (drafted_by: ai:<model>, status:
  draft) — never sent.
````

- [ ] **Step 2: Doğrula**

Run: `grep -c "npm run followup" modes/followup.md`
Expected: >= 1

Run: `grep -c "decides nothing\|never decides" modes/followup.md`
Expected: >= 1

- [ ] **Step 3: Commit**

```bash
git add modes/followup.md
git commit -m "feat(parity): followup mode — waiting-candidate dashboard + update draft"
```

---

### Task 6: `scripts/analyze-funnel.mjs` — hiring funnel + içgörü (TDD)

Deterministik, zero-dep. `collectCandidates`'tan funnel/reason/override/source/timing + proxy fairness sinyalleri (zorunlu disclaimer). Tracker'a değil, candidate dosyalarına dayanır (doğruluk kaynağı).

**Files:**
- Create: `scripts/analyze-funnel.mjs`
- Test: `test/board/analyze-funnel.test.mjs`

- [ ] **Step 1: Failing test yaz — `test/board/analyze-funnel.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { analyzeFunnel } from '../../scripts/analyze-funnel.mjs'
import { makeRepo, approvedContract } from '../helpers.mjs'

// 4 candidates: 1 parsed, 1 screened, 2 decided (1 rejected no-override,
// 1 advanced override). Two sources.
function repo() {
  return makeRepo({
    'roles/r/role-contract.md': approvedContract,
    'roles/r/candidates/p/profile.md': '---\nname: P\nsource: "inbound:p.txt"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/s/profile.md': '---\nname: S\nsource: "inbound:s.txt"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/s/score.md': '---\nweighted_total: 4\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
    'roles/r/candidates/d1/profile.md': '---\nname: D1\nsource: "csv:applicants.csv"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/d1/score.md': '---\nweighted_total: 2\nconfidence: low\nrecommendation: reject-suggest\nscored_at: 2026-06-02\n---\n',
    'roles/r/candidates/d1/decision.md': '---\ndecision: rejected\nreason_code: insufficient-evidence\ndecided_by: human:ali\noverride: false\ndecided_at: 2026-06-05\n---\n',
    'roles/r/candidates/d2/profile.md': '---\nname: D2\nsource: "csv:applicants.csv"\napplied_at: 2026-06-01\n---\nb\n',
    'roles/r/candidates/d2/score.md': '---\nweighted_total: 4.5\nconfidence: high\nrecommendation: advance\nscored_at: 2026-06-02\n---\n',
    'roles/r/candidates/d2/decision.md': '---\ndecision: rejected\nreason_code: stronger-shortlist\ndecided_by: human:ali\noverride: true\ndecided_at: 2026-06-07\n---\n',
  })
}

describe('analyzeFunnel', () => {
  it('counts the funnel by stage', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.total).toBe(4)
    expect(a.funnel.parsed).toBe(1)
    expect(a.funnel.screened).toBe(1)
    expect(a.funnel.rejected).toBe(2)
  })
  it('distributes reason codes for terminal decisions', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.reasonCodes['insufficient-evidence']).toBe(1)
    expect(a.reasonCodes['stronger-shortlist']).toBe(1)
  })
  it('computes the override rate over decided candidates', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.overrideRate.decided).toBe(2)
    expect(a.overrideRate.overrides).toBe(1)
    expect(a.overrideRate.ratePct).toBe(50)
  })
  it('breaks down source -> qualified (screened and beyond)', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    // inbound:s.txt -> screened (qualified); inbound:p.txt -> parsed (not)
    // csv -> 2 rejected (were screened-then-decided; qualified = reached screened+)
    expect(a.source['inbound:s.txt'].total).toBe(1)
    expect(a.source['inbound:s.txt'].qualified).toBe(1)
    expect(a.source['inbound:p.txt'].qualified).toBe(0)
  })
  it('always includes a fairness disclaimer (not a protected-class audit)', () => {
    const a = analyzeFunnel(repo(), { role: 'r' })
    expect(a.fairnessSignals.disclaimer).toMatch(/not.*protected-class|protected nitelik|NOT a protected/i)
    expect(typeof a.fairnessSignals.disclaimer).toBe('string')
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/board/analyze-funnel.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon — `scripts/analyze-funnel.mjs`**

```js
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
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/board/analyze-funnel.test.mjs`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/analyze-funnel.mjs test/board/analyze-funnel.test.mjs
git commit -m "feat(parity): analyze-funnel.mjs — funnel/reason/override/source/timing + fairness disclaimer"
```

---

### Task 7: `modes/analytics.md` — funnel sunumu + içgörü + rapor

LLM talimat dosyası. `scripts/analyze-funnel.mjs` JSON'unu insan-okunur sunar, öneri çıkarır, rapor yazar. Fairness disclaimer'ı her zaman gösterir.

**Files:**
- Create: `modes/analytics.md`

- [ ] **Step 1: `modes/analytics.md` yaz — EXACTLY:**

````markdown
# Mode: analytics

Purpose: turn the deterministic funnel script into a human-readable
hiring-pipeline report with actionable insights. The script computes; you
present and recommend.

Invocation: /talent-ops analytics [role-slug]

## Steps
1. Run the script and parse its JSON:
   ```bash
   node scripts/analyze-funnel.mjs <role-slug>   # omit slug for all roles
   ```
   Fields: `total`, `funnel` (count per stage), `reasonCodes`,
   `overrideRate` ({decided, overrides, ratePct}), `source` (per source:
   {total, qualified}), `timing` ({avgDaysToDecision}), `fairnessSignals`
   ({disclaimer, sourceQualificationRates, reasonConcentration}).
2. Present a readable report:
   - **Funnel:** counts per stage + where the biggest drop-off is.
   - **Reasons:** the reason-code distribution for terminal decisions.
   - **AI override:** the rate; if high (>~30%), note the scoring rubric in
     `modes/_shared.md` may need calibration.
   - **Sources:** qualification rate per source (which channel yields
     candidates that reach screened+).
   - **Speed:** average days to decision.
   - **Fairness signals:** ALWAYS print `fairnessSignals.disclaimer`
     verbatim first, then the proxy signals (source qualification disparity,
     reason-code concentration). NEVER frame these as a protected-class /
     adverse-impact audit — talent-ops has no protected-attribute data.
3. Give the top 3-5 actionable recommendations grounded in the numbers
   (e.g. "12 screened candidates await triage — run /talent-ops triage";
   "override 40% — review scoring weights"; "source X qualifies 0% — check
   that channel or its filters").
4. Write the report (atomic write): role-scoped to
   `roles/<role-slug>/analytics-<YYYY-MM-DD>.md`; for all-roles to
   `data/analytics-<YYYY-MM-DD>.md` (gitignored). Include the disclaimer.

## Rules
- The script is deterministic and calls no LLM; you only present + advise.
- The fairness disclaimer is mandatory in every output and every written
  report. Do not claim a protected-class audit.
````

- [ ] **Step 2: Doğrula**

Run: `grep -c "analyze-funnel.mjs" modes/analytics.md`
Expected: >= 1

Run: `grep -c "disclaimer\|protected-class" modes/analytics.md`
Expected: >= 2

- [ ] **Step 3: Commit**

```bash
git add modes/analytics.md
git commit -m "feat(parity): analytics mode — funnel report + insights (fairness disclaimer mandatory)"
```

---

### Task 8: README + SKILL router + golden-checks + uçtan uca doğrulama

**Files:**
- Modify: `README.md`
- Modify: `.claude/skills/talent-ops/SKILL.md`
- Modify: `examples/golden-checks.md`

- [ ] **Step 1: `README.md` "Commands" tablosuna üç satır ekle**

`/talent-ops tracker` / `memory` satırının HEMEN ÖNCESINE ekle:

```
| `/talent-ops outreach <role> <cand>` | Draft a candidate message (invite/reject/offer) — never sent |
| `/talent-ops followup` | Surface candidates waiting past cadence + draft an update |
| `/talent-ops analytics [role]` | Hiring funnel + insights (override rate, sources, fairness signals) |
```

- [ ] **Step 2: `.claude/skills/talent-ops/SKILL.md` routing + discovery güncelle**

Routing table'a (memory satırından önce) ekle:
```
| `outreach <role-slug> <candidate-slug> [type]` | outreach |
| `followup` | followup |
| `analytics [role-slug]` | analytics |
```
Discovery menüsüne ilgili üç satırı ekle (mevcut menü stiliyle):
```
  /talent-ops outreach <role> <cand>  -> Draft candidate message (invite/reject/offer); never sent
  /talent-ops followup                -> Candidates waiting past cadence + update draft
  /talent-ops analytics [role]        -> Hiring funnel + insights
```
Context loading: `outreach`, `followup`, `analytics` standalone modlardır (kendi dosyaları; followup/analytics ek olarak ilgili script'i çağırır).

- [ ] **Step 3: `examples/golden-checks.md` sonuna üç kontrol ekle (Teardown'dan önce)**

```
- [ ] GC11 — outreach reject consistency: `/talent-ops outreach
  ai-automation-specialist-hr derek-osei reject` (after a recorded
  rejection). Expect: a draft appended to candidates/derek-osei/outreach.md
  with `drafted_by: ai:<model>`, `status: draft`; the reason matches the
  recorded reason_code; no send action; no decision.md write.
- [ ] GC12 — followup flags waiting: `npm run followup`. Expect: screened
  candidates (awaiting triage past the cadence threshold) appear as
  overdue/due; a rejected candidate does NOT appear.
- [ ] GC13 — analytics disclaimer: `node scripts/analyze-funnel.mjs
  ai-automation-specialist-hr`. Expect: valid JSON with funnel/reasonCodes/
  overrideRate/source; `fairnessSignals.disclaimer` present and states it is
  NOT a protected-class audit.
```

- [ ] **Step 4: Uçtan uca doğrulama (gerçek sandbox, Node 22)**

> Sandbox demo rolü working tree'de hazırsa (`roles/ai-automation-specialist-hr/`). Yoksa README quickstart ile kur. Tüm testler Node ≥20 ister: `nvm use 22` (bu makinede shell default v16).

Run: `npx vitest run`
Expected: tüm suite yeşil (mevcut 86 + yeni: candidates 7 + followup 5 + analyze-funnel 5 = ~103)

Run: `npm run verify`
Expected: `verify: OK` (yeni script'ler mevcut bütünlüğü bozmaz)

Run: `node scripts/followup.mjs`
Expected: demo rolde screened adaylar (maya/rajan/tomasz) "awaiting triage" olarak listelenir (applied/scored 2026-06-11, bugün > eşik → overdue)

Run: `node scripts/analyze-funnel.mjs ai-automation-specialist-hr`
Expected: JSON — funnel (parsed/screened/rejected sayıları), reasonCodes (derek: insufficient-evidence), fairnessSignals.disclaimer mevcut

- [ ] **Step 5: Commit**

```bash
git add README.md .claude/skills/talent-ops/SKILL.md examples/golden-checks.md
git commit -m "docs(parity): README + SKILL router + golden checks for outreach/followup/analytics"
```

---

## Plan Sonu Kontrolü (executor için)

- [ ] `npx vitest run` → mevcut 86 + candidates(7) + followup(5) + analyze-funnel(5) ≈ 103, tümü yeşil
- [ ] `npm run verify` → `verify: OK` (Plan 1 mevcut bütünlüğü bozmadı)
- [ ] `node scripts/followup.mjs` ve `node scripts/analyze-funnel.mjs <role>` gerçek sandbox'ta anlamlı çıktı verir
- [ ] 3 yeni mode (`outreach`, `followup`, `analytics`) router + discovery + README'de görünür
- [ ] GC11-GC13 golden-checks bir AI CLI oturumunda koşuldu
- [ ] Spec §4-§7 maddeleri karşılandı; states.yml/score/evidence/screen DEĞİŞMEDİ (non-invasive doğrulandı)

**Bu plan bitince:** Plan 2 (authenticity signals) için ayrı plan yazılır — screen + score şema + board + golden genişletmesi (invasive).
