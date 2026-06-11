# Talent-Ops Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Talent-Ops MVP'nin dosya tabanlı çekirdeğini kurmak: AI CLI skill (router + 10 mode), veri sözleşmesi (şablonlar + states.yml), bütünlük script'leri (verify/dedupe/export-audit/forget) ve demo seti (örnek rol + 10 kurgu CV + golden checks). Web board AYRI planda (bu plan bitince yazılacak).

**Architecture:** Her şey dosya: YAML frontmatter + markdown gövde. LLM işleri (rol görüşmesi, JD, CV ayrıştırma, skorlama) mode dosyalarındaki talimatlarla AI CLI'da koşar; `.mjs` script'ler yalnız bütünlük/bookkeeping yapar (LLM çağırmaz). Üç değişmez kural: (1) `decided_by: ai:*` hiçbir yerde kabul edilmez, (2) her uç karar `states.yml` sözlüğünden sebep kodu taşır, (3) parse edilemeyen girdi karantinaya düşer, asla sessizce kaybolmaz.

**Tech Stack:** Node >= 20 (ESM), `yaml` (tek runtime bağımlılık), `vitest` (test). Skill markdown'ları Claude Code + AGENTS.md uyumlu CLI'lar için. Ürün dili İngilizce (OSS, EN-first).

**Spec:** `docs/superpowers/specs/2026-06-11-talent-ops-mvp-design.md`

---

## Dosya Haritası (bu planın sonunda repo)

```
HR-ops/  (ürün adı: talent-ops)
├── .claude/skills/talent-ops/SKILL.md    # router                    [Task 7]
├── AGENTS.md                             # CLI-bağımsız giriş        [Task 7]
├── modes/
│   ├── _shared.md                        # felsefe+veri sözleşmesi+skorlama [Task 6]
│   ├── define-role.md                    # [Task 8]
│   ├── jd.md                             # [Task 9]
│   ├── intake.md                         # [Task 10]
│   ├── screen.md                         # [Task 11]
│   ├── batch.md                          # [Task 12]
│   ├── triage.md                         # [Task 13]
│   ├── interview-kit.md / decision.md    # [Task 14]
│   └── tracker.md / memory.md            # [Task 15]
├── templates/
│   ├── states.yml                        # aşamalar+sebep kodları    [Task 3]
│   ├── role-contract.md                  # [Task 4]
│   ├── scorecard.md                      # [Task 4]
│   ├── decision.md                       # [Task 4]
│   └── disclosure.md                     # [Task 4]
├── config/company-profile.example.yml    # [Task 5]
├── scripts/
│   ├── lib/frontmatter.mjs               # [Task 2]
│   ├── lib/states.mjs                    # [Task 3]
│   ├── lib/walk.mjs                      # [Task 16]
│   ├── verify.mjs                        # [Task 16]
│   ├── dedupe.mjs                        # [Task 17]
│   ├── export-audit.mjs                  # [Task 18]
│   └── forget.mjs                        # [Task 19]
├── test/                                 # vitest testleri (helpers dahil)
├── data/inbox/ , roles/                  # boş iskelet (.gitkeep)    [Task 1]
├── examples/
│   ├── role-ai-automation-specialist-hr/ # demo kontrat + JD         [Task 20]
│   ├── inbox-samples/                    # 10 kurgu CV               [Task 21]
│   └── golden-checks.md                  # LLM davranış asertleri    [Task 22]
├── package.json                          # [Task 1]
└── README.md                             # [Task 23]
```

Sorumluluk sınırları: `scripts/lib/*` saf fonksiyonlar (I/O parametreli, test edilebilir); `scripts/*.mjs` CLI sarmalayıcılar; `modes/*` yalnız LLM talimatı; `templates/*` üretilen dosyaların iskeleti. Mode'lar script'leri çağırabilir, script'ler mode'ları asla.

---

### Task 1: Repo iskeleti + package.json

**Files:**
- Create: `package.json`
- Create: `data/inbox/.gitkeep`, `roles/.gitkeep`, `modes/.gitkeep`, `templates/.gitkeep`, `config/.gitkeep`, `scripts/lib/.gitkeep`, `test/.gitkeep`, `examples/.gitkeep`

- [ ] **Step 1: package.json yaz**

```json
{
  "name": "talent-ops",
  "version": "0.1.0",
  "description": "Evidence-based hiring operating system for AI coding CLIs. The employer-side mirror of career-ops.",
  "type": "module",
  "private": true,
  "license": "MIT",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "verify": "node scripts/verify.mjs",
    "dedupe": "node scripts/dedupe.mjs",
    "export-audit": "node scripts/export-audit.mjs",
    "forget": "node scripts/forget.mjs"
  },
  "dependencies": { "yaml": "^2.4.0" },
  "devDependencies": { "vitest": "^3.0.0" }
}
```

- [ ] **Step 2: Dizin iskeleti + bağımlılık kurulumu**

```bash
mkdir -p data/inbox roles modes templates config scripts/lib test examples
touch data/inbox/.gitkeep roles/.gitkeep modes/.gitkeep templates/.gitkeep config/.gitkeep scripts/lib/.gitkeep test/.gitkeep examples/.gitkeep
npm install
```

- [ ] **Step 3: Kurulumu doğrula**

Run: `npx vitest run --passWithNoTests`
Expected: exit 0, "No test files found" (henüz test yok; vitest kurulu demektir). Ayrıca: `node -e "import('yaml').then(()=>console.log('ok'))"` → `ok`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json data roles modes templates config scripts test examples
git commit -m "chore: talent-ops repo skeleton + tooling (vitest, yaml)"
```

---

### Task 2: Frontmatter kütüphanesi (`scripts/lib/frontmatter.mjs`)

Tüm script'lerin okuduğu/yazdığı dosya biçimi: `---\n<yaml>\n---\n<markdown body>`. Tek sorumluluk: bu biçimi parse/serialize etmek.

**Files:**
- Create: `scripts/lib/frontmatter.mjs`
- Test: `test/frontmatter.test.mjs`

- [ ] **Step 1: Failing test yaz**

```js
// test/frontmatter.test.mjs
import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '../scripts/lib/frontmatter.mjs'

describe('parseFrontmatter', () => {
  it('parses yaml frontmatter and preserves body', () => {
    const text = '---\nrole: demo\nweights:\n  skill_match: 0.3\n---\n# Body\n\ntext here\n'
    const { data, body } = parseFrontmatter(text)
    expect(data.role).toBe('demo')
    expect(data.weights.skill_match).toBe(0.3)
    expect(body).toBe('# Body\n\ntext here\n')
  })

  it('throws on missing frontmatter', () => {
    expect(() => parseFrontmatter('# just markdown\n')).toThrow(/frontmatter/)
  })

  it('returns empty object for empty frontmatter block', () => {
    const { data, body } = parseFrontmatter('---\n---\nbody\n')
    expect(data).toEqual({})
    expect(body).toBe('body\n')
  })
})

describe('serializeFrontmatter', () => {
  it('round-trips with parseFrontmatter', () => {
    const out = serializeFrontmatter({ a: 1, list: ['x'] }, 'hello\n')
    const { data, body } = parseFrontmatter(out)
    expect(data).toEqual({ a: 1, list: ['x'] })
    expect(body).toBe('hello\n')
  })
})
```

- [ ] **Step 2: Testin FAIL ettiğini gör**

Run: `npx vitest run test/frontmatter.test.mjs`
Expected: FAIL — "Cannot find module '../scripts/lib/frontmatter.mjs'"

- [ ] **Step 3: Minimal implementasyon**

```js
// scripts/lib/frontmatter.mjs
import { parse, stringify } from 'yaml'

// Kapanış çiti kendi satırında olmalı: içerik+newline tek opsiyonel grup —
// YAML değeri "---" olan alanlar inline eşleşip veriyi bozamaz (review bulgusu).
const FM_RE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---(?:\r?\n|$)/

export function parseFrontmatter(text) {
  const m = text.match(FM_RE)
  if (!m) throw new Error('missing frontmatter (expected leading --- block)')
  return { data: parse(m[1] ?? '') ?? {}, body: text.slice(m[0].length) }
}

export function serializeFrontmatter(data, body = '') {
  return `---\n${stringify(data)}---\n${body}`
}
```

- [ ] **Step 4: Testin PASS ettiğini gör**

Run: `npx vitest run test/frontmatter.test.mjs`
Expected: 4 passed

Not (yürütme sırasında eklendi): nihai implementasyon iki regresyon testi daha içerir — YAML değeri `---` olan alan (`notes: ---` string olarak parse edilir, satırlar yutulmaz) ve kapanış çitinden sonra newline'sız biten dosya. Bkz. commit 886f5d1.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/frontmatter.mjs test/frontmatter.test.mjs
git commit -m "feat: frontmatter parse/serialize library"
```

---

### Task 3: `templates/states.yml` + yükleyici (`scripts/lib/states.mjs`)

Kanonik aşamalar, uç aşamalar, karar→aşama eşlemesi ve sebep kodu sözlüğü. Spec §5.6 birebir.

**Files:**
- Create: `templates/states.yml`
- Create: `scripts/lib/states.mjs`
- Test: `test/states.test.mjs`

- [ ] **Step 1: states.yml yaz**

```yaml
# templates/states.yml — canonical pipeline vocabulary.
# Scripts and modes validate against this file. Do not rename casually:
# stage/reason values live inside candidate files and the tracker.

stages:
  - inbox
  - parsed
  - screened
  - triage
  - interview
  - decision
  - hired
  - rejected
  - withdrawn

terminal: [hired, rejected, withdrawn]

# decision.md "decision" value -> stage the candidate moves to.
# "offer" is a decision value, NOT a stage (candidate waits in "decision").
decisions:
  advanced: interview
  interviewing: interview
  offer: decision
  hired: hired
  rejected: rejected
  withdrawn: withdrawn

# Factual reason codes only. No bias-prone codes (e.g. "culture fit").
reason_codes:
  - missing-must-have
  - insufficient-evidence
  - experience-level-mismatch
  - hard-filter-fail
  - compensation-mismatch
  - stronger-shortlist
  - candidate-withdrew
  - position-filled
```

- [ ] **Step 2: Failing test yaz**

```js
// test/states.test.mjs
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStates } from '../scripts/lib/states.mjs'

describe('loadStates', () => {
  it('loads the real repo states.yml', () => {
    const s = loadStates(process.cwd())
    expect(s.stages).toContain('triage')
    expect(s.terminal).toEqual(['hired', 'rejected', 'withdrawn'])
    expect(s.decisions.offer).toBe('decision')
    expect(s.reason_codes).toContain('missing-must-have')
  })

  it('throws when terminal stage is not in stages', () => {
    const root = mkdtempSync(join(tmpdir(), 'to-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(
      join(root, 'templates/states.yml'),
      'stages: [a]\nterminal: [zzz]\ndecisions: {}\nreason_codes: [x]\n'
    )
    expect(() => loadStates(root)).toThrow(/terminal/)
  })

  it('throws when a required key is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'to-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(join(root, 'templates/states.yml'), 'stages: [a]\n')
    expect(() => loadStates(root)).toThrow(/missing/)
  })
})
```

- [ ] **Step 3: FAIL gör**

Run: `npx vitest run test/states.test.mjs`
Expected: FAIL — "Cannot find module '../scripts/lib/states.mjs'"

- [ ] **Step 4: Implementasyon**

```js
// scripts/lib/states.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export function loadStates(root = process.cwd()) {
  const raw = parse(readFileSync(join(root, 'templates/states.yml'), 'utf8'))
  for (const key of ['stages', 'terminal', 'decisions', 'reason_codes']) {
    if (raw?.[key] == null) throw new Error(`states.yml missing "${key}"`)
  }
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
```

- [ ] **Step 5: PASS gör**

Run: `npx vitest run test/states.test.mjs`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add templates/states.yml scripts/lib/states.mjs test/states.test.mjs
git commit -m "feat: canonical pipeline states + reason codes with validating loader"
```

---

### Task 4: Üretim şablonları (`templates/role-contract.md`, `scorecard.md`, `decision.md`, `disclosure.md`)

Mode'ların ürettiği dosyaların iskeletleri. Şablonlardaki `<angle-bracket>` alanları üretim sırasında LLM doldurur — bunlar şablonun parçasıdır, plan eksiği değildir.

**Files:**
- Create: `templates/role-contract.md`
- Create: `templates/scorecard.md`
- Create: `templates/decision.md`
- Create: `templates/disclosure.md`

- [ ] **Step 1: `templates/role-contract.md` yaz**

````markdown
---
role: <role-slug>
title: "<Job Title>"
status: draft            # draft -> approved -> revised. Modes refuse to run on non-approved contracts.
approved_by: ""          # human:<name> — set only on explicit approval
approved_date: ""
location: "<city / remote policy>"
employment_type: full-time
comp_band: "<min-max currency, or 'see company profile'>"
hard_filters:            # pass/fail checks. Failing candidates still need a HUMAN decision.
  work_permit: "<e.g. EU>"
  language: "<e.g. English C1>"
scoring_weights:         # must sum to 1.0
  skill_match: 0.30
  experience_match: 0.20
  evidence_match: 0.30
  behavior_signals: 0.20
must_have:               # every entry needs evidence_required
  - skill: "<skill>"
    evidence_required: "repo | production-story | certification | portfolio"
nice_to_have: []
disqualifiers: []        # factual only, e.g. "no cloud experience at all"
---
# Role Contract: <Job Title>

## Business need
<Why are we hiring? Link to a business goal, not a vacancy.>

## First-90-days outcomes
1. <Concrete, verifiable outcome>
2. <Concrete, verifiable outcome>
3. <Concrete, verifiable outcome>

## Failure scenario
<How would this hire fail within 90 days? What would we observe?>

## Interview stages
1. <Stage name — what it verifies, who runs it>
2. <Stage name — what it verifies, who runs it>

## Criteria drift log
<!-- Every expectation change after approval is appended here. No silent drift. -->
| date | changed_by | change | re-approved_by |
| ---- | ---------- | ------ | -------------- |
````

- [ ] **Step 2: `templates/scorecard.md` yaz**

````markdown
---
candidate: <candidate-slug>
role: <role-slug>
stage: "<interview stage name>"
interviewer: human:<name>
completed_at: ""
---
# Interview Scorecard — <stage>

Score each dimension 1-5. A score without a concrete example is invalid:
write down what the candidate actually said or showed.

| dimension | target evidence gap / claim to verify | score (1-5) | concrete example heard |
| --------- | ------------------------------------- | ----------- | ---------------------- |
| <dimension from role contract> | <from candidate's missing_evidence> | | |

## Notes
<Free-form observations. Facts over impressions.>

## Recommendation (assistive for the decision packet, not a decision)
advance | hold | reject-suggest — with one-sentence rationale.
````

- [ ] **Step 3: `templates/decision.md` yaz**

````markdown
---
candidate: <candidate-slug>
role: <role-slug>
decision: ""             # advanced | interviewing | offer | hired | rejected | withdrawn
reason_code: ""          # REQUIRED for hired/rejected/withdrawn — from templates/states.yml
reason_detail: ""
decided_by: ""           # MUST start with human: — ai:* is a contract violation
ai_recommendation: ""    # copied from score.md at decision time
override: false          # true when human decision differs from ai_recommendation
future_fit: []           # role slugs this candidate may fit later (talent memory)
recontact_after: ""      # date — do not resurface before this
decided_at: ""
---
# Decision — <candidate name>

## Rationale
<Human-written reasoning. Reference evidence, not gut feeling.>
````

- [ ] **Step 4: `templates/disclosure.md` yaz**

Marker yorumları (`<!-- ai-disclosure -->`) bilinçli: `export-audit.mjs` ve golden checks JD'de bu bloğun varlığını bu marker ile arar.

````markdown
<!-- ai-disclosure -->
**How we use AI in this hiring process:** We use AI tools to parse
applications, match stated skills against the published role requirements,
and draft interview plans. AI never makes rejection or hiring decisions —
every decision is made and recorded by a named human reviewer with a
documented reason. You may: (1) request a summary of the criteria used,
(2) ask for a human-only review of any AI-assisted step, (3) contest a
decision via this posting's contact address.
<!-- /ai-disclosure -->
````

- [ ] **Step 5: Doğrula ve commit**

Run: `grep -l "ai-disclosure" templates/disclosure.md && grep -l "Criteria drift log" templates/role-contract.md`
Expected: iki dosya adı da basılır.

```bash
git add templates/
git commit -m "feat: generation templates (role contract, scorecard, decision, disclosure)"
```

---

### Task 5: `config/company-profile.example.yml`

Şirket kimliği — JD tonu, değerler, comp bantları, kullanıcı kimliği (provenance damgası buradan okunur).

**Files:**
- Create: `config/company-profile.example.yml`

- [ ] **Step 1: Dosyayı yaz**

```yaml
# config/company-profile.example.yml
# Copy to config/company-profile.yml and edit. The real file is for YOUR
# private fork — never commit real company/candidate data to a public repo.

company:
  name: "Acme GmbH"
  mission: "One sentence on what the company does."
  values: ["evidence over opinion", "candidate respect", "transparency"]
  locations: ["Brussels (hybrid)", "Remote EU"]

user:
  # Provenance stamp for every human-recorded action: decided_by: human:<id>
  id: "your-name"

language: en

jd:
  tone: "direct, concrete, no buzzwords"
  include_comp_band: true

comp_bands:
  # role-family: "min-max currency"
  hr-tech: "55000-75000 EUR"

disclosure:
  # Set to false only if you maintain your own disclosure text in the JD.
  include_default_block: true

retention:
  # GDPR hygiene defaults used by talent memory and forget.mjs messaging.
  candidate_data_months: 12
```

- [ ] **Step 2: YAML geçerliliğini doğrula ve commit**

Run: `node -e "import('yaml').then(async y => { const fs = await import('node:fs'); y.parse(fs.readFileSync('config/company-profile.example.yml','utf8')); console.log('valid') })"`
Expected: `valid`

```bash
git add config/company-profile.example.yml
git commit -m "feat: company profile example config"
```

---

### Task 6: `modes/_shared.md` — felsefe, veri sözleşmesi, skorlama kuralları

Sistemin kalbi. Skorlamayı yapan LLM'in okuduğu kurallar AÇIK METİN burada — kullanıcı okuyabilir ve düzenleyebilir ("görünmez mimar" problemine cevap).

**Files:**
- Create: `modes/_shared.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Talent-Ops — Shared Context

Read this before executing any mode that requires it. If a mode instruction
conflicts with this file, this file wins.

## Philosophy

1. **Resume != Candidate.** A resume is an unverified claim set. Decisions
   rest on evidence: every claim gets a source, an evidence reference, and a
   confidence level.
2. **AI recommends, humans decide.** The system never rejects or hires
   autonomously. `decided_by` in any decision.md MUST start with `human:`.
   If asked to write `ai:*` there, refuse and explain this rule.
3. **Reason-coded decisions.** Every hired/rejected/withdrawn decision
   carries a `reason_code` from `templates/states.yml`. Free-text-only
   rejections are invalid.
4. **Provenance everywhere.** Every file you generate records its author as
   `ai:<model-id>`; every human action records `human:<user.id from
   config/company-profile.yml>`.
5. **No silent data loss.** Unparseable or ambiguous input goes to
   `data/quarantine.md` with a reason. Never skip silently.
6. **Disclosure by default.** Generated JDs include the block from
   `templates/disclosure.md` unless config disables it.

## File layout and naming

- Roles live in `roles/<role-slug>/` with `role-contract.md`, `jd.md`, and
  `candidates/<candidate-slug>/`.
- Candidate dir contents: `source/` (original files, never modified),
  `profile.md`, `evidence.md`, `score.md`, `decision.md`,
  `interview/<stage>-scorecard.md`.
- Slugs: lowercase kebab-case. Role slug from title; candidate slug from
  full name (`jane-doe`), add `-2` suffix on collision.
- Shared data: `data/tracker.md` (pipeline table), `data/quarantine.md`,
  `data/talent-memory.md`, `data/inbox/` (incoming applications).

## Data contract (frontmatter, summary)

- `role-contract.md`: role, title, status(draft|approved|revised),
  approved_by, hard_filters{}, scoring_weights{} (sum 1.0),
  must_have[{skill, evidence_required}], nice_to_have[], disqualifiers[].
- `profile.md`: name, email, location, source, applied_at, links[],
  years_experience, last_roles[], languages[], parsed_by.
- `evidence.md`: claims[{claim, source(cv|linkedin|github|portfolio|interview),
  evidence, evidence_type(repo|publication|certification|story|none),
  confidence(high|medium|low|none),
  status(unverified|ai-inferred|human-confirmed|contradicted), note}].
- `score.md`: scores{hard_filters, skill_match, experience_match,
  evidence_match, behavior_signals}, weighted_total, confidence,
  missing_evidence[], risks[], recommendation, scored_by, scored_at.
- `decision.md`: see templates/decision.md. decided_by MUST be human:*.
- Tracker row: `| candidate-slug | role-slug | stage | weighted_total | confidence | updated_at | note |`

## Scoring rules

**Layer 0 — hard_filters: pass | fail(<filter>).** Compare profile against
contract.hard_filters. A fail makes recommendation `reject-suggest` but the
candidate still requires a human decision. Never auto-write a decision.

**Layer 1 — skill_match (1-5).**
5 = all must-haves present at full strength; 4 = all present, some via
adjacent skills; 3 = one must-have missing but explicitly trainable, rest
strong; 2 = two or more must-haves missing; 1 = little overlap.
*Partial credit rule:* an adjacent skill in the same family (e.g. PowerBI
for Tableau, GitLab CI for GitHub Actions) counts at ~60% strength and the
rationale MUST name the family ("BI tooling"). Never count an unrelated
skill as adjacent.

**Layer 2 — experience_match (1-5).**
5 = meets or slightly exceeds the band with directly relevant context;
4 = meets; 3 = slightly below with a credible trajectory; 2 = well below;
1 = no relevant experience. If experience exceeds ~2x the band, score on
fit and add a `compensation-mismatch?` entry to risks (do not penalize the
score itself).

**Layer 3 — evidence_match (1-5).**
5 = every must-have claim has high-confidence evidence; 4 = most do;
3 = mixed or low confidence; 2 = claims are mostly bare assertions;
1 = contradictions found (also set the claim status to `contradicted`).
Every must-have without evidence goes into `missing_evidence` — that list
drives the interview kit.

**Layer 4 — behavior_signals (1-5).**
Only from candidate-provided material (OSS activity, talks, writing,
community work). 5 = sustained public contribution or leadership; 3 = some
visible signals; 1 = none visible. Absence is NOT negative evidence — the
low default weight (0.20) caps its influence.

**Aggregation.** weighted_total = Σ weight_i × layer_i, weights from the
APPROVED contract. If weights are missing or do not sum to 1.0 (±0.001):
stop and report; do not improvise weights.

**Confidence (of the whole assessment):** high = every must-have claim has
evidence resolved (any status); medium = at least half; low = less than
half. Present confidence next to the total everywhere; never the total
alone.

**Recommendation (assistive only):**
- `advance`: weighted_total >= 4.0 AND missing_evidence empty AND hard pass
- `shortlist`: weighted_total >= 3.3 AND hard pass
- `hold`: weighted_total >= 2.5
- `reject-suggest`: weighted_total < 2.5 OR hard fail OR a disqualifier hit

## Guards (preconditions for every mode)

1. jd / screen / batch / triage / interview-kit / decision require the
   role's contract `status: approved`. Refuse otherwise, naming the missing
   approval.
2. Never fabricate evidence. No evidence found => confidence `none`,
   status `unverified`.
3. External fetching: ONLY URLs the candidate provided in their materials.
   No LinkedIn/GitHub searches for people who did not apply (that is v2,
   outbound).
4. All file writes are atomic: write to `<file>.tmp`, then rename.
5. After any batch of writes, suggest running `npm run verify`.
````

- [ ] **Step 2: Doğrula ve commit**

Run: `grep -c "Layer" modes/_shared.md`
Expected: >= 5

```bash
git add modes/_shared.md
git commit -m "feat: shared context — philosophy, data contract, scoring rules"
```

---

### Task 7: Router (`.claude/skills/talent-ops/SKILL.md`) + `AGENTS.md`

career-ops router paterni: mode tespiti → ilgili dosyaları yükle → talimatı uygula.

**Files:**
- Create: `.claude/skills/talent-ops/SKILL.md`
- Create: `AGENTS.md`

- [ ] **Step 1: SKILL.md yaz**

````markdown
---
name: talent-ops
description: Evidence-based hiring command center — define roles, generate JDs, screen applications, triage with reason-coded decisions
user_invocable: true
argument-hint: "[define-role | jd | intake | screen | batch | triage | interview-kit | decision | tracker | memory]"
---

# talent-ops — Router

## Mode routing

Determine the mode from the first argument:

| Input | Mode |
|-------|------|
| (empty) | discovery — show the menu below |
| `define-role` | define-role |
| `jd <role-slug>` | jd |
| `intake <role-slug>` | intake |
| `screen <role-slug> <candidate-slug>` | screen |
| `batch <role-slug>` | batch |
| `triage <role-slug>` | triage |
| `interview-kit <role-slug> <candidate-slug>` | interview-kit |
| `decision <role-slug> <candidate-slug>` | decision |
| `tracker` | tracker |
| `memory [role-slug]` | memory |

Unknown input that looks like a hiring need ("we need a senior X") =>
suggest `define-role`. Anything else => discovery.

## Discovery menu

```
talent-ops — Hiring Command Center

  /talent-ops define-role            -> Role intake conversation -> approved Role Contract
  /talent-ops jd <role>              -> Bias-checked job description from the contract
  /talent-ops intake <role>          -> Parse CVs from data/inbox/ into candidate files
  /talent-ops screen <role> <cand>   -> Evidence ledger + 5-layer score for one candidate
  /talent-ops batch <role>           -> Screen all parsed candidates in parallel
  /talent-ops triage <role>          -> Ranked queue + reason-coded human decisions
  /talent-ops interview-kit <role> <cand> -> Structured interview plan from evidence gaps
  /talent-ops decision <role> <cand> -> Decision packet + recorded human decision
  /talent-ops tracker                -> Pipeline overview + SLA warnings
  /talent-ops memory [role]          -> Talent memory: rediscover strong past candidates

Flow: define-role -> jd -> (publish) -> intake -> batch -> triage ->
interview-kit -> decision. Integrity: npm run verify
```

## Context loading

- Modes requiring `modes/_shared.md` + their own file: define-role, jd,
  intake, screen, batch, triage, interview-kit, decision.
- Standalone (own file only): tracker, memory.
- `batch` delegates per-candidate work to subagents, injecting the content
  of `_shared.md` + `screen.md` into each subagent prompt.

Read the required files, then execute the mode file's instructions.

## Non-negotiable rules (apply in every mode)

1. Never write `decided_by: ai:*` in any decision.md.
2. Terminal decisions need a reason_code from templates/states.yml.
3. Unparseable input -> data/quarantine.md, never silently skipped.
4. Contract not `approved` -> refuse dependent modes, name what's missing.
````

- [ ] **Step 2: AGENTS.md yaz**

````markdown
# Talent-Ops — Agent Entry Point

Talent-ops is an evidence-based hiring operating system that runs inside AI
coding CLIs (Claude Code, and any CLI that reads AGENTS.md).

- Command surface and routing: `.claude/skills/talent-ops/SKILL.md`
- Shared rules every mode obeys: `modes/_shared.md`
- One file per workflow: `modes/*.md`
- Canonical pipeline vocabulary: `templates/states.yml`
- Integrity checks: `npm run verify`

Hard rules, regardless of CLI: AI never decides (`decided_by` is always
`human:*`), terminal decisions carry a reason code, unparseable input goes
to quarantine, and approved role contracts gate all downstream modes.

To start: `/talent-ops` (Claude Code) or open SKILL.md and follow the
routing table manually in other CLIs.
````

- [ ] **Step 3: Doğrula ve commit**

Run: `grep -c "talent-ops" .claude/skills/talent-ops/SKILL.md`
Expected: >= 10

```bash
git add .claude/skills/talent-ops/SKILL.md AGENTS.md
git commit -m "feat: skill router + CLI-agnostic AGENTS.md entry point"
```

---

### Task 8: `modes/define-role.md`

**Files:**
- Create: `modes/define-role.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Mode: define-role

Purpose: turn a vague hiring need into an approved Role Contract through a
calibration conversation with the hiring manager (the user).

## Preconditions
- None (entry point). If a contract already exists for this role, load it
  and switch to revision mode: changes append to the Criteria drift log.

## Steps
1. Ask ONE question at a time. Required set:
   a. Business need — why does this role exist? Which business goal?
   b. First-90-days outcomes — 2-4 concrete, verifiable outcomes.
   c. Failure scenario — "How would this hire fail in 90 days?"
   d. Must-haves — for EACH, immediately ask "what evidence would prove
      it?" (repo | production-story | certification | portfolio). A
      must-have with no provable evidence is a preference: move it to
      nice_to_have and say why.
   e. "Which of these can be trained in 90 days?" — trained ones move to
      nice_to_have.
   f. Disqualifiers (factual only), hard filters (work permit, location,
      language), comp band, employment type.
   g. Interview stages — what each verifies, who runs it.
   h. Scoring weights — propose defaults (0.30 / 0.20 / 0.30 / 0.20), let
      the HM adjust, validate sum = 1.0.
2. Challenge vague answers exactly once: "senior" -> "what does senior
   mean here, in outcomes?". More than 5 must-haves -> "which 3 are truly
   blocking?"
3. Write `roles/<role-slug>/role-contract.md` from
   `templates/role-contract.md`, status: draft, every section filled,
   drift log table empty.
4. Show a one-screen summary; ask for explicit approval.
5. ONLY on explicit approval: status: approved, approved_by:
   human:<user.id>, approved_date: today. Otherwise stay draft and list
   exactly which sections block approval.

## Outputs
- roles/<role-slug>/role-contract.md (draft or approved)

## Failure modes
- "I don't know" on outcomes: park as draft, name the blocking sections.
  Never invent outcomes.
- Post-approval changes: append drift log row (date, changed_by, change,
  re-approved_by), set status: revised until explicitly re-approved.
````

- [ ] **Step 2: Doğrula ve commit**

Run: `grep -c "drift log" modes/define-role.md`
Expected: >= 2

```bash
git add modes/define-role.md
git commit -m "feat(mode): define-role — calibration conversation to approved contract"
```

---

### Task 9: `modes/jd.md`

**Files:**
- Create: `modes/jd.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Mode: jd

Purpose: generate a bias-checked, requirement-disciplined job description
from an APPROVED role contract.

Invocation: /talent-ops jd <role-slug>

## Preconditions
- roles/<role-slug>/role-contract.md with status: approved. Refuse
  otherwise, naming the missing approval.
- config/company-profile.yml (fall back to the example file, and say so).

## Steps
1. Read contract + company profile.
2. Draft `roles/<role-slug>/jd.md` with frontmatter (role, generated_by:
   ai:<model>, generated_at, source_contract_status) and sections:
   - **About the role** — from business need; no company hype.
   - **What you will do** — from first-90-days outcomes, verb-first.
   - **What we need** — ONLY contract must_haves, phrased as evidence
     ("production experience with X", not "knowledge of X").
   - **Nice to have** — contract nice_to_have only.
   - **Compensation & process** — band if jd.include_comp_band; the
     contract's interview stages, honestly described.
   - **AI disclosure** — copy templates/disclosure.md verbatim when
     disclosure.include_default_block (keep the HTML markers).
3. Requirement discipline check: diff every requirement line against the
   contract. Anything not in the contract -> remove and report the
   removal.
4. Bias pass — scan, replace, and LIST every replacement:
   rockstar, ninja, guru, wizard, superhero, dominate, aggressive,
   fearless, young, energetic, digital native, recent graduate (unless a
   legal requirement), culture fit (-> "culture add"), manpower, chairman,
   salesman, he/his as default pronoun, "work hard play hard".
   Flag (don't auto-replace): unexplained "fast-paced", stacked
   superlatives.
5. Append a **LinkedIn variant** section: <= 2600 characters, compressed,
   disclosure included.
6. Save; suggest `npm run verify`.

## Failure modes
- Comp band missing while include_comp_band: true -> ask; never invent
  numbers.
````

- [ ] **Step 2: Doğrula ve commit**

Run: `grep -c "disclosure" modes/jd.md`
Expected: >= 3

```bash
git add modes/jd.md
git commit -m "feat(mode): jd — bias-checked, requirement-disciplined JD generation"
```

---

### Task 10: `modes/intake.md`

**Files:**
- Create: `modes/intake.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Mode: intake

Purpose: turn raw applications in data/inbox/ into normalized candidate
files for ONE role.

Invocation: /talent-ops intake <role-slug>

## Preconditions
- The role's contract file exists (any status — intake may run while
  approval is pending; screening may not).

## Steps
1. List data/inbox/*. Supported: .pdf .docx .txt .md (one candidate per
   file); .csv (one candidate per row; required headers: name, email,
   location, cv_text; optional: links).
2. For each item:
   a. Read content. Unreadable/empty -> append to data/quarantine.md
      (`| file | reason | date |`) and CONTINUE. Never delete originals.
   b. Extract: name, email, location, links[], years_experience,
      last_roles[] (max 3), languages[].
   c. Slug = kebab-case full name; if the slug exists for a DIFFERENT
      person, append -2.
   d. Duplicate check BEFORE creating: same normalized (lowercased)
      email OR same slug within this role -> do not create; record a
      merge suggestion in the run summary; leave the file in inbox.
   e. Create roles/<role>/candidates/<slug>/, MOVE the original into
      source/, write profile.md (frontmatter per _shared data contract,
      parsed_by: ai:<model>; body: structured CV summary).
   f. Hard-filter precheck vs contract.hard_filters -> write
      hard_filter_precheck: pass | fail(<filter>) into profile
      frontmatter. A fail does NOT stop processing or trigger any
      decision.
   g. Append tracker row, stage: parsed.
3. Summary: created N, quarantined M (with reasons), duplicates K.

## Failure modes
- No extractable identity -> quarantine, reason "no identity".
- CSV missing required headers -> quarantine the file, name the headers.
- Non-English CV: process normally (extract what you can); add
  `languages` and a note; flag low extraction confidence in profile body.
````

- [ ] **Step 2: Doğrula ve commit**

Run: `grep -c "quarantine" modes/intake.md`
Expected: >= 3

```bash
git add modes/intake.md
git commit -m "feat(mode): intake — inbox parsing, dedupe, quarantine, hard-filter precheck"
```

---

### Task 11: `modes/screen.md`

**Files:**
- Create: `modes/screen.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Mode: screen

Purpose: build the Evidence Ledger and 5-layer score for ONE candidate.

Invocation: /talent-ops screen <role-slug> <candidate-slug>

## Preconditions
- Contract status: approved (refuse otherwise, name the gap).
- candidates/<slug>/profile.md exists (refuse: "run intake first").

## Steps
1. Read modes/_shared.md scoring rules, the contract, profile.md, and the
   raw material in source/.
2. Build the claims list: every contract must_have and nice_to_have, plus
   notable skills the candidate claims beyond the contract (cap ~5).
3. Hunt evidence per claim:
   - In the CV text (projects, metrics, production stories).
   - In candidate-provided links ONLY (profile.links). Fetch public pages
     when accessible; record URL + what was found. Fetch failure -> note
     "link unreachable"; do NOT guess.
   - Classify per data contract: evidence_type, confidence, status
     (ai-inferred when judged from material; unverified when nothing
     found).
   - NEVER fabricate. Nothing found -> evidence: "", type: none,
     confidence: none, status: unverified.
4. Write evidence.md (frontmatter claims; body: per-claim notes with
   quotes/URLs).
5. Score per _shared.md layers with the APPROVED contract weights. Write
   score.md: frontmatter per data contract; body: one rationale paragraph
   per layer. Partial-credit rationales MUST name the skill family.
6. Update tracker row -> stage: screened, score + confidence.
7. Report to user: total, confidence, missing_evidence, top risk — and
   that this is an assistive recommendation; the decision is theirs.

## Failure modes
- Weights don't sum to 1.0 -> stop; suggest a define-role revision.
- Contradiction (CV claims X, link shows otherwise) -> claim status:
  contradicted + risks entry. Never silently downgrade.
````

- [ ] **Step 2: Doğrula ve commit**

Run: `grep -c "NEVER fabricate" modes/screen.md`
Expected: 1

```bash
git add modes/screen.md
git commit -m "feat(mode): screen — evidence ledger + 5-layer score for one candidate"
```

---

### Task 12: `modes/batch.md`

**Files:**
- Create: `modes/batch.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Mode: batch

Purpose: screen every parsed candidate of a role in parallel.

Invocation: /talent-ops batch <role-slug>

## Preconditions
- Contract approved; at least one candidate at stage parsed.

## Steps
1. Collect candidates at stage parsed. Skip already-screened ones — this
   makes the run resumable after interruption.
2. Initialize or append data/batch-state.md:
   `| candidate | status (pending|running|done|failed) | updated_at |`
3. Process with up to 4 concurrent subagents. Each subagent prompt = full
   text of modes/_shared.md + modes/screen.md + role slug + candidate
   slug. Subagents produce the same files screen would.
4. As results land: update batch-state.md and the tracker.
5. Failures: mark failed with a one-line reason; candidate STAYS at
   parsed for retry. Never quarantine a parsed candidate for a screening
   failure.
6. Summary: done/failed counts, recommendation distribution (count per
   bucket), pointer to `/talent-ops triage <role>`.
````

- [ ] **Step 2: Doğrula ve commit**

```bash
git add modes/batch.md
git commit -m "feat(mode): batch — parallel resumable screening via subagents"
```

---

### Task 13: `modes/triage.md`

**Files:**
- Create: `modes/triage.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Mode: triage

Purpose: ranked review queue + reason-coded HUMAN decisions in bulk.

Invocation: /talent-ops triage <role-slug>

## Preconditions
- Contract approved; >= 1 candidate at stage screened.

## Steps
1. Build the queue from score.md files: sort by confidence band
   (high > medium > low), then weighted_total desc. Hard-filter fails and
   disqualifier hits go to a separate "requires explicit human look"
   section at the bottom — they are NEVER auto-decided.
2. Calibration guard: if this role has no decisions yet, mark the first
   min(15, all) entries `calibrate: true` and tell the user to review
   them WITH the hiring manager before any bulk action. If weights change
   during calibration: that is a contract revision -> drift log entry,
   status: revised, re-approval required, then re-score (batch) before
   continuing.
3. Render the queue, one line per candidate:
   `<slug> | <total> (<confidence>) | <one-line fit reason> | missing: N |
   <recommendation>`
4. Accept bulk decisions FROM THE USER, e.g. "advance 1,3,5; reject 7,8
   reason stronger-shortlist". Every rejection requires a reason_code
   (validate against templates/states.yml). The agent RECORDS the human's
   decision; it never decides. decided_by: human:<user.id>.
5. Anti-miss check BEFORE writing rejections: pick max(2, 10%) random
   candidates from the reject set; show each one's fit reason + strongest
   evidence; ask "confirm these too?". Only then write.
6. Write decision.md per decided candidate (from the template; override =
   decision != recommendation). Move tracker stages per the states.yml
   decisions mapping.
7. Strong-but-rejected (total >= 3.5, or the user says "good, but"):
   append a talent memory entry (format in modes/memory.md).

## Failure modes
- Rejection without reason_code -> refuse that item, list valid codes.
- "Just reject the bottom half" -> refuse to bulk-decide blind: present
  the list and require explicit confirmation per the anti-miss flow.
````

- [ ] **Step 2: Doğrula ve commit**

Run: `grep -c "reason_code" modes/triage.md`
Expected: >= 2

```bash
git add modes/triage.md
git commit -m "feat(mode): triage — calibrated queue, anti-miss sampling, reason-coded decisions"
```

---

### Task 14: `modes/interview-kit.md` + `modes/decision.md`

**Files:**
- Create: `modes/interview-kit.md`
- Create: `modes/decision.md`

- [ ] **Step 1: `modes/interview-kit.md` yaz**

````markdown
# Mode: interview-kit

Purpose: a structured interview plan targeting THIS candidate's evidence
gaps — not a generic question list.

Invocation: /talent-ops interview-kit <role-slug> <candidate-slug>

## Preconditions
- Contract approved; score.md exists (refuse: "screen first").

## Steps
1. Read: contract interview stages, score.md missing_evidence + risks,
   evidence.md claims with confidence below high.
2. For each contract stage generate 3-6 questions. EVERY question maps to
   a target — a claim to verify or a 90-day outcome capability. Format:
   `Q: <question> | target: <claim/outcome> | listen for: <what a strong
   vs weak answer sounds like>`
3. Forbidden: brainteasers, culture-fit vibe questions, and any question
   touching protected attributes (age, family plans, origin, health,
   beliefs).
4. Write candidates/<slug>/interview/<stage>-plan.md and one scorecard per
   stage from templates/scorecard.md (dimensions = the targets).
5. Point the user to the files; completed scorecards feed the decision
   packet.
````

- [ ] **Step 2: `modes/decision.md` yaz**

````markdown
# Mode: decision

Purpose: assemble the decision packet and record the HUMAN decision.

Invocation: /talent-ops decision <role-slug> <candidate-slug>

## Preconditions
- score.md exists. Interview scorecards are optional (decisions can also
  happen at triage); the packet states which inputs were present.

## Steps
1. Assemble the packet — show in chat AND save to
   candidates/<slug>/packet.md: profile summary; evidence table
   (claim / confidence / status); score breakdown with rationale digest;
   completed scorecard digests; risks; ai_recommendation labeled
   "assistive — not a decision".
2. Ask the user for: decision (a key of states.yml decisions),
   reason_code (REQUIRED for hired/rejected/withdrawn), reason_detail,
   future_fit, recontact_after (default: +6 months for strong rejects).
3. Validate against templates/states.yml. Write decision.md from the
   template: decided_by: human:<user.id>, override = decision !=
   ai_recommendation, decided_at: now.
4. Update the tracker stage per the decisions mapping.
5. If rejected AND (total >= 3.5 OR user flags strong): append a talent
   memory entry (format in modes/memory.md).
6. Suggest `npm run verify`.

## Failure modes
- ANY attempt — including by the user — to set decided_by to an AI id:
  refuse, cite the shared rule (humans decide; the human's identity comes
  from config user.id).
````

- [ ] **Step 3: Doğrula ve commit**

Run: `grep -c "assistive" modes/decision.md`
Expected: >= 1

```bash
git add modes/interview-kit.md modes/decision.md
git commit -m "feat(mode): interview-kit + decision — gap-targeted interviews, human-recorded decisions"
```

---

### Task 15: `modes/tracker.md` + `modes/memory.md`

**Files:**
- Create: `modes/tracker.md`
- Create: `modes/memory.md`

- [ ] **Step 1: `modes/tracker.md` yaz**

````markdown
# Mode: tracker

Purpose: pipeline overview + SLA warnings. data/tracker.md is a derived
cache — candidate files are the truth; this mode rebuilds the cache.

Invocation: /talent-ops tracker

## Steps
1. Walk roles/*/candidates/*. Derive each candidate's stage from files
   present and their frontmatter (decision.md > score.md > profile.md).
2. Rebuild data/tracker.md from scratch (atomic write: .tmp then rename).
   Report diffs against the previous version ("3 rows were stale").
3. Show: per-role counts by stage; SLA flags — triage > 5 days,
   interview > 10 days (from updated_at); quarantine row count;
   candidates scored but undecided after 14 days.
4. Suggest next actions per role ("12 screened candidates await triage").
````

- [ ] **Step 2: `modes/memory.md` yaz**

````markdown
# Mode: memory

Purpose: talent memory — strong past candidates stay discoverable.

Entry format in data/talent-memory.md (one per candidate):

## <role-slug>/<candidate-slug>
- decided: rejected (stronger-shortlist) on <date> by human:<id>
- weighted_total: 4.1 (confidence: high)
- strongest_evidence: <one line>
- future_fit: [<role slugs or skill families>]
- recontact_after: <date>
- contact_ok: yes|no

Invocation: /talent-ops memory [role-slug]

## Steps
1. Without role-slug: list entries; flag stale ones (decided longer ago
   than config retention.candidate_data_months) and entries past
   recontact_after (eligible to recontact now).
2. With role-slug: read that contract's must_haves; match entries by
   future_fit overlap and strongest_evidence relevance. NEVER suggest an
   entry before its recontact_after date, or with contact_ok: no.
3. Output: shortlist with WHY (which must_have it matches), original
   role + decision date for provenance, and the reminder that evidence is
   as old as its decision date — re-verify on contact.
4. Removal requests -> point to `npm run forget -- <role> <candidate>`.
````

- [ ] **Step 3: Doğrula ve commit**

Run: `grep -c "recontact_after" modes/memory.md`
Expected: >= 3

```bash
git add modes/tracker.md modes/memory.md
git commit -m "feat(mode): tracker + memory — derived pipeline cache, talent rediscovery"
```

---

### Task 16: `scripts/verify.mjs` + `scripts/lib/walk.mjs` + test helper

Bütünlük denetçisi — spec §9. Saf fonksiyon `collectViolations(root)` test edilir; CLI sarmalayıcı ince kalır.

**Files:**
- Create: `test/helpers.mjs`
- Create: `scripts/lib/walk.mjs`
- Create: `scripts/verify.mjs`
- Test: `test/verify.test.mjs`

- [ ] **Step 1: Test helper yaz (`test/helpers.mjs`)**

```js
// test/helpers.mjs — fixture repo kurucusu. Gerçek states.yml kopyalanır.
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

export function makeRepo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'talent-ops-'))
  mkdirSync(join(root, 'templates'), { recursive: true })
  cpSync(
    join(process.cwd(), 'templates/states.yml'),
    join(root, 'templates/states.yml')
  )
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}

export const approvedContract = `---
role: demo-role
title: "Demo Role"
status: approved
approved_by: human:tester
scoring_weights:
  skill_match: 0.3
  experience_match: 0.2
  evidence_match: 0.3
  behavior_signals: 0.2
must_have:
  - skill: Python
    evidence_required: repo
---
# Role Contract
## Criteria drift log
| date | changed_by | change | re-approved_by |
| ---- | ---------- | ------ | -------------- |
`

export function candidateFiles(role, slug, { decidedBy = 'human:tester', decision = 'rejected', reasonCode = 'stronger-shortlist' } = {}) {
  const base = `roles/${role}/candidates/${slug}`
  return {
    [`${base}/profile.md`]: `---\nname: ${slug}\nemail: ${slug}@x.dev\n---\nbody\n`,
    [`${base}/evidence.md`]: `---\nclaims: []\n---\n`,
    [`${base}/score.md`]: `---\nweighted_total: 3.9\nconfidence: medium\nrecommendation: shortlist\n---\n`,
    [`${base}/decision.md`]: `---\ndecision: ${decision}\nreason_code: ${reasonCode}\ndecided_by: ${decidedBy}\n---\n`,
  }
}

export function trackerWith(rows) {
  const header =
    '| candidate | role | stage | weighted_total | confidence | updated_at | note |\n' +
    '| --- | --- | --- | --- | --- | --- | --- |\n'
  return header + rows.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n'
}
```

- [ ] **Step 2: Failing test yaz (`test/verify.test.mjs`)**

```js
import { describe, it, expect } from 'vitest'
import { collectViolations } from '../scripts/verify.mjs'
import { makeRepo, approvedContract, candidateFiles, trackerWith } from './helpers.mjs'

const cleanRepo = () =>
  makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    ...candidateFiles('demo-role', 'jane-doe'),
    'data/tracker.md': trackerWith([
      ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
    ]),
  })

describe('collectViolations', () => {
  it('returns [] for a clean repo', () => {
    expect(collectViolations(cleanRepo())).toEqual([])
  })

  it('flags ai:* decided_by', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'jane-doe', { decidedBy: 'ai:claude' }),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/decided_by must start with "human:"/)
  })

  it('flags terminal decision without valid reason_code', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'jane-doe', { reasonCode: 'felt-wrong' }),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/reason_code/)
  })

  it('flags score.md without evidence.md', () => {
    const files = candidateFiles('demo-role', 'jane-doe')
    delete files['roles/demo-role/candidates/jane-doe/evidence.md']
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...files,
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/score without evidence/)
  })

  it('flags candidates scored under a non-approved contract', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract.replace('status: approved', 'status: draft'),
      ...candidateFiles('demo-role', 'jane-doe'),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ]),
    })
    expect(collectViolations(root).join()).toMatch(/contract status is "draft"/)
  })

  it('flags weights that do not sum to 1', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract.replace('skill_match: 0.3', 'skill_match: 0.2'),
    })
    expect(collectViolations(root).join()).toMatch(/scoring_weights sum/)
  })

  it('flags tracker rows with unknown stage or missing candidate dir, and untracked candidates', () => {
    const root = makeRepo({
      'roles/demo-role/role-contract.md': approvedContract,
      ...candidateFiles('demo-role', 'jane-doe'),
      'data/tracker.md': trackerWith([
        ['jane-doe', 'demo-role', 'flying', '3.9', 'medium', '2026-06-11', ''],
        ['ghost', 'demo-role', 'parsed', '-', '-', '2026-06-11', ''],
      ]),
    })
    const out = collectViolations(root).join('\n')
    expect(out).toMatch(/unknown stage "flying"/)
    expect(out).toMatch(/missing candidate dir demo-role\/ghost/)
  })
})
```

- [ ] **Step 3: FAIL gör**

Run: `npx vitest run test/verify.test.mjs`
Expected: FAIL — "Cannot find module '../scripts/verify.mjs'"

- [ ] **Step 4: `scripts/lib/walk.mjs` yaz**

```js
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
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
```

- [ ] **Step 5: `scripts/verify.mjs` yaz**

```js
// scripts/verify.mjs — integrity checks (spec §9). Pure core + thin CLI.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { loadStates } from './lib/states.mjs'
import { walk } from './lib/walk.mjs'

const readFm = (path) => parseFrontmatter(readFileSync(path, 'utf8')).data

export function parseTrackerRows(root) {
  const p = join(root, 'data/tracker.md')
  if (!existsSync(p)) return []
  const rows = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.split('|').slice(1, -1).map((c) => c.trim())
    if (!cells.length || cells[0] === 'candidate' || /^-+$/.test(cells[0])) continue
    const [candidate, role, stage, total, confidence, updated_at, note = ''] = cells
    rows.push({ candidate, role, stage, total, confidence, updated_at, note })
  }
  return rows
}

export function collectViolations(root = process.cwd()) {
  const states = loadStates(root)
  const v = []
  const rolesDir = join(root, 'roles')
  const files = walk(rolesDir)
  const TERMINAL = ['hired', 'rejected', 'withdrawn']

  for (const f of files.filter((x) => x.endsWith('role-contract.md'))) {
    const fm = readFm(f)
    if (fm.scoring_weights) {
      const sum = Object.values(fm.scoring_weights).reduce((a, b) => a + b, 0)
      if (Math.abs(sum - 1) > 0.001) v.push(`${f}: scoring_weights sum to ${sum}, expected 1.0`)
    }
  }

  for (const f of files.filter((x) => x.endsWith('/decision.md'))) {
    const fm = readFm(f)
    if (!String(fm.decided_by ?? '').startsWith('human:'))
      v.push(`${f}: decided_by must start with "human:" (got "${fm.decided_by}")`)
    if (!(fm.decision in states.decisions))
      v.push(`${f}: unknown decision "${fm.decision}"`)
    if (TERMINAL.includes(fm.decision) && !states.reason_codes.includes(fm.reason_code))
      v.push(`${f}: terminal decision requires a reason_code from states.yml (got "${fm.reason_code}")`)
  }

  for (const f of files.filter((x) => x.endsWith('/score.md'))) {
    const dir = f.slice(0, -'/score.md'.length)
    if (!existsSync(join(dir, 'evidence.md'))) v.push(`${f}: score without evidence.md`)
    const contractPath = join(dir, '..', '..', 'role-contract.md')
    if (existsSync(contractPath)) {
      const cfm = readFm(contractPath)
      if (cfm.status !== 'approved')
        v.push(`${f}: scored while contract status is "${cfm.status}" (needs approved)`)
    } else {
      v.push(`${f}: no role-contract.md found for this role`)
    }
  }

  const rows = parseTrackerRows(root)
  for (const r of rows) {
    if (!states.stages.includes(r.stage))
      v.push(`tracker: unknown stage "${r.stage}" for ${r.candidate}`)
    if (!existsSync(join(rolesDir, r.role, 'candidates', r.candidate)))
      v.push(`tracker: row for missing candidate dir ${r.role}/${r.candidate}`)
  }
  const tracked = new Set(rows.map((r) => `${r.role}/${r.candidate}`))
  for (const f of files.filter((x) => x.endsWith('/profile.md'))) {
    const m = f.match(/roles\/(.+?)\/candidates\/(.+?)\/profile\.md$/)
    if (m && !tracked.has(`${m[1]}/${m[2]}`))
      v.push(`tracker: missing row for ${m[1]}/${m[2]}`)
  }
  return v
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = collectViolations(process.cwd())
  if (violations.length) {
    console.error(`verify: ${violations.length} violation(s)`)
    for (const x of violations) console.error(' - ' + x)
    process.exit(1)
  }
  console.log('verify: OK')
}
```

- [ ] **Step 6: PASS gör**

Run: `npx vitest run test/verify.test.mjs`
Expected: 7 passed

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/walk.mjs scripts/verify.mjs test/helpers.mjs test/verify.test.mjs
git commit -m "feat: verify.mjs integrity checks (human decisions, reason codes, tracker consistency)"
```

---

### Task 17: `scripts/dedupe.mjs`

Tavsiye niteliğinde mükerrer tespiti — otomatik birleştirme YOK (spec §9).

**Files:**
- Create: `scripts/dedupe.mjs`
- Test: `test/dedupe.test.mjs`

- [ ] **Step 1: Failing test yaz**

```js
// test/dedupe.test.mjs
import { describe, it, expect } from 'vitest'
import { findDuplicates } from '../scripts/dedupe.mjs'
import { makeRepo } from './helpers.mjs'

describe('findDuplicates', () => {
  it('groups candidates sharing a normalized email', () => {
    const root = makeRepo({
      'roles/r/candidates/jane-doe/profile.md': '---\nname: Jane Doe\nemail: Jane@X.dev\n---\n',
      'roles/r/candidates/jane-d/profile.md': '---\nname: J. Doe\nemail: jane@x.dev\n---\n',
      'roles/r/candidates/bob/profile.md': '---\nname: Bob\nemail: bob@x.dev\n---\n',
    })
    const dups = findDuplicates(root, 'r')
    expect(dups).toHaveLength(1)
    expect(dups[0].candidates).toEqual(['jane-d', 'jane-doe'])
  })

  it('returns [] when no duplicates', () => {
    const root = makeRepo({
      'roles/r/candidates/a/profile.md': '---\nname: A\nemail: a@x.dev\n---\n',
      'roles/r/candidates/b/profile.md': '---\nname: B\nemail: b@x.dev\n---\n',
    })
    expect(findDuplicates(root, 'r')).toEqual([])
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/dedupe.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon**

```js
// scripts/dedupe.mjs — duplicate suggestions, advisory only (no auto-merge)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { walk } from './lib/walk.mjs'

export function findDuplicates(root, role) {
  const base = join(root, 'roles', role, 'candidates')
  const groups = new Map()
  for (const f of walk(base).filter((x) => x.endsWith('/profile.md'))) {
    const fm = parseFrontmatter(readFileSync(f, 'utf8')).data
    const slug = f.match(/candidates\/(.+?)\/profile\.md$/)[1]
    const keys = []
    if (fm.email) keys.push('email:' + String(fm.email).toLowerCase().trim())
    if (fm.name) keys.push('name:' + String(fm.name).toLowerCase().replace(/[^a-z]/g, ''))
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, new Set())
      groups.get(key).add(slug)
    }
  }
  return [...groups.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([key, s]) => ({ key, candidates: [...s].sort() }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [role, flag] = process.argv.slice(2)
  if (!role) {
    console.error('usage: node scripts/dedupe.mjs <role-slug> [--strict]')
    process.exit(2)
  }
  const dups = findDuplicates(process.cwd(), role)
  if (!dups.length) console.log('dedupe: no duplicates found')
  for (const d of dups)
    console.log(`dedupe: possible duplicate (${d.key}): ${d.candidates.join(' <-> ')} — review and merge manually`)
  if (dups.length && flag === '--strict') process.exit(1)
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/dedupe.test.mjs`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/dedupe.mjs test/dedupe.test.mjs
git commit -m "feat: dedupe.mjs — advisory duplicate detection by email/name"
```

---

### Task 18: `scripts/export-audit.mjs`

Rol bazlı denetim paketi (spec §8): kontrat + ağırlıklar + kararlar + override oranı + disclosure kontrolü.

**Files:**
- Create: `scripts/export-audit.mjs`
- Test: `test/export-audit.test.mjs`

- [ ] **Step 1: Failing test yaz**

```js
// test/export-audit.test.mjs
import { describe, it, expect } from 'vitest'
import { buildAudit } from '../scripts/export-audit.mjs'
import { makeRepo, approvedContract, candidateFiles } from './helpers.mjs'

function auditRepo() {
  const a = candidateFiles('demo-role', 'jane-doe')           // rejected, no override
  const b = candidateFiles('demo-role', 'ali-veli')
  b['roles/demo-role/candidates/ali-veli/score.md'] =
    '---\nweighted_total: 2.1\nconfidence: low\nrecommendation: reject-suggest\n---\n'
  b['roles/demo-role/candidates/ali-veli/decision.md'] =
    '---\ndecision: advanced\nreason_code: ""\ndecided_by: human:tester\nai_recommendation: reject-suggest\noverride: true\n---\n'
  return makeRepo({ 'roles/demo-role/role-contract.md': approvedContract, ...a, ...b })
}

describe('buildAudit', () => {
  it('includes contract weights, every candidate row, and the override rate', () => {
    const md = buildAudit(auditRepo(), 'demo-role')
    expect(md).toMatch(/skill_match: 0.3/)
    expect(md).toMatch(/jane-doe/)
    expect(md).toMatch(/ali-veli/)
    expect(md).toMatch(/Override rate: 50%/)
  })

  it('reports a missing disclosure block in the JD', () => {
    const md = buildAudit(auditRepo(), 'demo-role')
    expect(md).toMatch(/AI disclosure in JD: MISSING/)
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/export-audit.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon**

```js
// scripts/export-audit.mjs — per-role audit package (spec §8)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { parseFrontmatter } from './lib/frontmatter.mjs'

const readFmIf = (p) => (existsSync(p) ? parseFrontmatter(readFileSync(p, 'utf8')).data : null)

export function buildAudit(root, role) {
  const roleDir = join(root, 'roles', role)
  const { data: cfm, body } = parseFrontmatter(readFileSync(join(roleDir, 'role-contract.md'), 'utf8'))
  const driftIdx = body.indexOf('## Criteria drift log')
  const drift = driftIdx >= 0 ? body.slice(driftIdx) : '(no drift log section)'
  const jdPath = join(roleDir, 'jd.md')
  const disclosure =
    existsSync(jdPath) && readFileSync(jdPath, 'utf8').includes('<!-- ai-disclosure -->')
      ? 'present'
      : 'MISSING'

  const candDir = join(roleDir, 'candidates')
  const slugs = existsSync(candDir)
    ? readdirSync(candDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : []
  let decided = 0
  let overrides = 0
  const rows = slugs.map((slug) => {
    const score = readFmIf(join(candDir, slug, 'score.md'))
    const dec = readFmIf(join(candDir, slug, 'decision.md'))
    if (dec) {
      decided++
      if (dec.override === true) overrides++
    }
    return `| ${slug} | ${score?.weighted_total ?? '-'} | ${score?.confidence ?? '-'} | ${score?.recommendation ?? '-'} | ${dec?.decision ?? '-'} | ${dec?.reason_code || '-'} | ${dec?.decided_by ?? '-'} | ${dec?.override ?? '-'} |`
  })
  const rate = decided ? Math.round((overrides / decided) * 100) : 0

  return [
    `# Audit — ${role}`,
    '',
    `- Contract status: ${cfm.status} (approved_by: ${cfm.approved_by || '-'})`,
    `- AI disclosure in JD: ${disclosure}`,
    `- Decisions recorded: ${decided} | Override rate: ${rate}%`,
    '',
    '## Scoring weights',
    '```yaml',
    stringify(cfm.scoring_weights ?? {}).trim(),
    '```',
    '',
    '## Must-haves',
    '```yaml',
    stringify(cfm.must_have ?? []).trim(),
    '```',
    '',
    '## Candidates',
    '| candidate | total | confidence | ai_recommendation | decision | reason_code | decided_by | override |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Criteria drift log (from contract)',
    drift.trim(),
    '',
  ].join('\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const role = process.argv[2]
  if (!role) {
    console.error('usage: node scripts/export-audit.mjs <role-slug>')
    process.exit(2)
  }
  const out = buildAudit(process.cwd(), role)
  const date = new Date().toISOString().slice(0, 10)
  const dest = join(process.cwd(), 'roles', role, `audit-${date}.md`)
  writeFileSync(dest, out)
  console.log(`audit written: ${dest}`)
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/export-audit.test.mjs`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/export-audit.mjs test/export-audit.test.mjs
git commit -m "feat: export-audit.mjs — per-role compliance audit package"
```

---

### Task 19: `scripts/forget.mjs`

GDPR md. 17 — aday verisini sil (spec §8). Dosya silmenin git geçmişini SİLMEDİĞİ uyarısı zorunlu çıktıdır.

**Files:**
- Create: `scripts/forget.mjs`
- Test: `test/forget.test.mjs`

- [ ] **Step 1: Failing test yaz**

```js
// test/forget.test.mjs
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { forgetCandidate } from '../scripts/forget.mjs'
import { makeRepo, approvedContract, candidateFiles, trackerWith } from './helpers.mjs'

const memory = `# Talent Memory

## demo-role/jane-doe
- decided: rejected (stronger-shortlist) on 2026-06-11 by human:tester
- future_fit: [data-analyst]

## demo-role/bob
- decided: rejected (missing-must-have) on 2026-06-11 by human:tester
`

function repo() {
  return makeRepo({
    'roles/demo-role/role-contract.md': approvedContract,
    ...candidateFiles('demo-role', 'jane-doe'),
    ...candidateFiles('demo-role', 'bob'),
    'data/tracker.md': trackerWith([
      ['jane-doe', 'demo-role', 'rejected', '3.9', 'medium', '2026-06-11', ''],
      ['bob', 'demo-role', 'rejected', '2.0', 'low', '2026-06-11', ''],
    ]),
    'data/talent-memory.md': memory,
  })
}

describe('forgetCandidate', () => {
  it('removes dir, tracker row, and memory entry — leaves others intact', () => {
    const root = repo()
    const res = forgetCandidate(root, 'demo-role', 'jane-doe')
    expect(res).toEqual({ removedDir: true, trackerRows: 1, memoryEntries: 1 })
    expect(existsSync(join(root, 'roles/demo-role/candidates/jane-doe'))).toBe(false)
    const tracker = readFileSync(join(root, 'data/tracker.md'), 'utf8')
    expect(tracker).not.toMatch(/jane-doe/)
    expect(tracker).toMatch(/bob/)
    const mem = readFileSync(join(root, 'data/talent-memory.md'), 'utf8')
    expect(mem).not.toMatch(/jane-doe/)
    expect(mem).toMatch(/demo-role\/bob/)
  })

  it('dry-run reports but removes nothing', () => {
    const root = repo()
    const res = forgetCandidate(root, 'demo-role', 'jane-doe', { dryRun: true })
    expect(res.removedDir).toBe(true)
    expect(existsSync(join(root, 'roles/demo-role/candidates/jane-doe'))).toBe(true)
    expect(readFileSync(join(root, 'data/tracker.md'), 'utf8')).toMatch(/jane-doe/)
  })
})
```

- [ ] **Step 2: FAIL gör**

Run: `npx vitest run test/forget.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasyon**

```js
// scripts/forget.mjs — GDPR art.17 erasure helper (spec §8)
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

function writeAtomic(path, content) {
  writeFileSync(path + '.tmp', content)
  renameSync(path + '.tmp', path)
}

export function forgetCandidate(root, role, slug, { dryRun = false } = {}) {
  const result = { removedDir: false, trackerRows: 0, memoryEntries: 0 }

  const dir = join(root, 'roles', role, 'candidates', slug)
  if (existsSync(dir)) {
    result.removedDir = true
    if (!dryRun) rmSync(dir, { recursive: true })
  }

  const trackerPath = join(root, 'data/tracker.md')
  if (existsSync(trackerPath)) {
    const kept = readFileSync(trackerPath, 'utf8').split('\n').filter((line) => {
      const t = line.trim()
      if (!t.startsWith('|')) return true
      const cells = t.split('|').slice(1, -1).map((c) => c.trim())
      const match = cells[0] === slug && cells[1] === role
      if (match) result.trackerRows++
      return !match
    })
    if (!dryRun && result.trackerRows) writeAtomic(trackerPath, kept.join('\n'))
  }

  const memPath = join(root, 'data/talent-memory.md')
  if (existsSync(memPath)) {
    const kept = []
    let skipping = false
    for (const line of readFileSync(memPath, 'utf8').split('\n')) {
      if (line.startsWith('## ')) {
        skipping = line.trim() === `## ${role}/${slug}`
        if (skipping) {
          result.memoryEntries++
          continue
        }
      }
      if (!skipping) kept.push(line)
    }
    if (!dryRun && result.memoryEntries) writeAtomic(memPath, kept.join('\n'))
  }

  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
  const dryRun = process.argv.includes('--dry-run')
  const [role, slug] = args
  if (!role || !slug) {
    console.error('usage: node scripts/forget.mjs <role-slug> <candidate-slug> [--dry-run]')
    process.exit(2)
  }
  const res = forgetCandidate(process.cwd(), role, slug, { dryRun })
  console.log(`${dryRun ? '[dry-run] ' : ''}forget ${role}/${slug}: dir=${res.removedDir} trackerRows=${res.trackerRows} memoryEntries=${res.memoryEntries}`)
  console.log(
    'WARNING: removing files does NOT rewrite git history. For full erasure in a\n' +
      'version-controlled repo, also rewrite history, e.g.:\n' +
      `  git filter-repo --invert-paths --path roles/${role}/candidates/${slug}\n` +
      'or keep real candidate data out of version control entirely.'
  )
}
```

- [ ] **Step 4: PASS gör**

Run: `npx vitest run test/forget.test.mjs`
Expected: 2 passed

- [ ] **Step 5: Tüm testleri çalıştır ve commit**

Run: `npx vitest run`
Expected: tüm test dosyaları (frontmatter, states, verify, dedupe, export-audit, forget) PASS

```bash
git add scripts/forget.mjs test/forget.test.mjs
git commit -m "feat: forget.mjs — GDPR erasure with git-history warning"
```

---

### Task 20: Demo rol kontratı (`examples/role-ai-automation-specialist-hr/`)

Gerçek bir LinkedIn ilanından (Allianz Benelux, "AI & Automation Specialist (HR)") esinlenilmiş, **kurgulaştırılmış** demo rol — şirket adı kurgu, içerik temsili. `examples/` değişmez fixture'dır; golden checks başında `roles/`a kopyalanır.

**Files:**
- Create: `examples/role-ai-automation-specialist-hr/role-contract.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
---
role: ai-automation-specialist-hr
title: "AI & Automation Specialist (HR)"
status: approved
approved_by: human:demo
approved_date: 2026-06-11
location: "Brussels (hybrid, 2 days office)"
employment_type: full-time
comp_band: "55000-75000 EUR"
hard_filters:
  work_permit: EU
  language: English C1
scoring_weights:
  skill_match: 0.30
  experience_match: 0.20
  evidence_match: 0.30
  behavior_signals: 0.20
must_have:
  - skill: "Python"
    evidence_required: "repo | production-story"
  - skill: "Workflow automation (Power Automate or equivalent)"
    evidence_required: "production-story | portfolio"
  - skill: "Cloud data integration (APIs, ETL)"
    evidence_required: "production-story | certification"
  - skill: "Business process re-engineering"
    evidence_required: "production-story"
nice_to_have:
  - "SuccessFactors or another HRIS platform"
  - "French or Dutch"
  - "Chatbot / LLM application experience"
disqualifiers:
  - "No hands-on automation experience at all"
---
# Role Contract: AI & Automation Specialist (HR)

## Business need
Meridian Insurance Group's People function serves 2,000+ employees on
largely manual processes (reporting, document handling, onboarding
coordination). We are hiring a technical specialist to automate HR
workflows and build the data layer — explicitly NOT a traditional HR
generalist role.

## First-90-days outcomes
1. Ship one HR workflow automation to production (e.g. document
   generation or onboarding task routing) with measured time savings.
2. Map current HR data flows and deliver an integration architecture
   proposal reviewed by IT.
3. Deliver a self-service HR analytics dashboard prototype used by at
   least two HRBP stakeholders.

## Failure scenario
The hire becomes a manual-report ticket-taker; nothing reaches
production in 90 days; the translation gap between People and IT remains;
automation stays in proof-of-concept purgatory.

## Interview stages
1. Technical screen — verify Python + automation evidence (repo walk-through
   or production story deep-dive). Run by: engineering interviewer.
2. Process case — candidate re-engineers a (sanitized) manual HR process
   live; verifies process re-engineering and pragmatism. Run by: hiring manager.
3. Stakeholder interview — verifies the business-to-IT translation skill.
   Run by: HRBP + IT lead.

## Criteria drift log
| date | changed_by | change | re-approved_by |
| ---- | ---------- | ------ | -------------- |
````

- [ ] **Step 2: Doğrula ve commit**

Run: `node -e "import('./scripts/lib/frontmatter.mjs').then(async m => { const fs = await import('node:fs'); const fm = m.parseFrontmatter(fs.readFileSync('examples/role-ai-automation-specialist-hr/role-contract.md','utf8')); const sum = Object.values(fm.data.scoring_weights).reduce((a,b)=>a+b,0); console.log(fm.data.status, sum) })"`
Expected: `approved 1`

```bash
git add examples/role-ai-automation-specialist-hr/
git commit -m "feat(examples): demo role contract — AI & Automation Specialist (HR)"
```

---

### Task 21: 10 kurgu CV + 1 CSV (`examples/inbox-samples/`)

Golden set: her CV bir davranışı test etmek için tasarlandı. Tüm kişiler/şirketler/linkler KURGUDUR (kurgu linkler "link unreachable" yolunu da bilinçli test eder).

**Files:**
- Create: `examples/inbox-samples/<10 dosya + applicants.csv>` (içerikler aşağıda)

- [ ] **Step 1: CV dosyalarını yaz**

`examples/inbox-samples/maya-lindqvist.txt` — **güçlü + kanıtlı** (hedef: yüksek skor, advance adayı):
```text
MAYA LINDQVIST
maya.lindqvist@protonmail.com | Brussels, BE | EU citizen | English C1, Swedish native
github.com/mayalq | mayalq.dev

HR Systems Automation Engineer — Nordica Re (2022-now)
- Built Python document-automation service for HR contracts (FastAPI + Azure
  Functions); cut contract turnaround from 5 days to 4 hours, 11k docs/year.
- Power Automate flows for onboarding task routing across 1,800 employees;
  retired 14 manual checklists.
- Integrated SuccessFactors with the data warehouse via OData APIs + dbt ETL.

People Analytics Developer — Brightpath Consulting (2019-2022)
- Self-service Power BI dashboards for absence/turnover used by 40 HRBPs.
- Azure Data Factory pipelines (certified: DP-203).

Talks: "Killing the HR spreadsheet" — HR Tech Benelux 2025.
```

`examples/inbox-samples/derek-osei.txt` — **iddia çok, kanıt sıfır** (hedef: confidence none/low, advance YOK):
```text
DEREK OSEI
derek.osei.pro@gmail.com | Antwerp, BE | EU permit holder | English fluent

Senior AI & Automation Expert. Visionary technologist. 10x productivity
multiplier. Deep expertise in: Python, Power Automate, Azure, AWS, GCP, SAP,
SuccessFactors, Workday, AI/ML, LLMs, RPA, blockchain, data engineering,
process re-engineering, digital transformation, agile leadership.

Career: Digital Transformation Lead — various international companies
(2014-now). Drove enterprise-wide automation initiatives delivering
multi-million savings. Details available upon request.

No links provided.
```

`examples/inbox-samples/sofia-marchetti.txt` — **must-have eksik: Python yok** (hedef: missing-must-have görünür):
```text
SOFIA MARCHETTI
s.marchetti@libero.it | Milan, IT (open to Brussels relocation) | EU citizen | English C1

HR Process Excellence Lead — Lombardia Assicurazioni (2018-now)
- Re-engineered onboarding end-to-end: 23 steps to 9, cycle time -61%
  (documented case study available).
- Built the HR reporting suite in Excel + VBA macros; Power Query ETL
  from the HRIS.
- Led SuccessFactors module rollout for 3,000 employees.

Tools: Excel/VBA expert, Power Query, Visio, SuccessFactors, Qlik.
Note: no Python experience — strong process side.
```

`examples/inbox-samples/rajan-pillai.txt` — **sert filtre: çalışma izni yok** (hedef: fail(work_permit), reject-suggest ama karar İNSANDA):
```text
RAJAN PILLAI
rajan.pillai.dev@gmail.com | Mumbai, IN | Requires EU sponsorship | English C2
github.com/rajanpillai-hr

Lead HR Tech Engineer — Suryan InfoTech (2017-now)
- Python microservices for HR document automation (Django, Celery),
  60k employees served, 99.9% uptime.
- Azure Logic Apps + Power Automate library: 40+ production flows.
- API integration layer between SAP HCM and the lakehouse (Databricks).
- AZ-204 and DP-203 certified. Conference: PyCon India 2024 speaker.

Open to relocation; visa sponsorship required.
```

`examples/inbox-samples/tomasz-nowak.txt` — **komşu beceri** (hedef: UiPath/Zapier → "workflow automation" ailesinde kısmi puan, gerekçeli):
```text
TOMASZ NOWAK
t.nowak@wp.pl | Warsaw, PL (remote-first, monthly Brussels OK) | EU citizen | English C1

RPA Developer — Vistula Bank (2020-now)
- 25+ UiPath production robots for HR & finance back office; saved est.
  20 FTE-hours/day. Orchestrator administration.
- Python scripting for data prep and robot exception handling (repo:
  github.com/tnowak-rpa/uipath-helpers).
- Zapier + Make integrations for the HR helpdesk.

Earlier: ETL developer (SQL Server, SSIS), 3 years.
Note: no Power Automate specifically; deep UiPath.
```

`examples/inbox-samples/elena-vasquez.txt` — **aşırı kıdem / comp uyuşmazlığı riski** (hedef: risks alanına compensation-mismatch?):
```text
DR. ELENA VASQUEZ
elena.vasquez@evz.consulting | Madrid, ES | EU citizen | English C2

Former CTO (HR Tech scale-up, exited 2024) — 18 years in engineering
leadership. Built and sold an HR analytics platform (140 employees).
Hands-on: Python (since 2008), cloud architecture (AWS + Azure),
ML pipelines, process design at org scale.

Recent: independent consultant — HR digital transformation programs for
two insurers (references available). Published: "The Post-Spreadsheet HR
Organization" (industry report, 2025).

Compensation context: previous total comp >200k EUR; flexible for the
right mission.
```

`examples/inbox-samples/amara-diallo.txt` — **kariyer değiştiren + portfolyo** (hedef: experience düşük, evidence orta, trajectory):
```text
AMARA DIALLO
amara.diallo@outlook.be | Ghent, BE | Belgian citizen | English C1, French native

HR Operations Coordinator — Flandria Logistics (2024-now)
- Automated my own reporting with Python (pandas) — monthly close from
  2 days to 3 hours; scripts in production for the whole HR team since Q1.
- Portfolio: amaradiallo.dev (4 case studies) | github.com/amaradiallo

Education-to-tech path: Le Wagon data engineering bootcamp (2024),
Microsoft PL-500 (Power Automate) certification in progress.
Earlier: 3 years HR admin (payroll support, onboarding logistics).
```

`examples/inbox-samples/maya-lindquist.txt` — **#1'in MÜKERRERİ** (aynı e-posta, ad farklı yazım; hedef: dedupe/merge önerisi):
```text
MAYA LINDQUIST
maya.lindqvist@protonmail.com | Brussels | EU citizen

HR Systems Automation Engineer at Nordica Re. Python, Power Automate,
Azure, SuccessFactors integrations. (Shorter resubmission — full CV sent
last week.)
github.com/mayalq
```

`examples/inbox-samples/lucas-vermeulen.txt` — **İngilizce olmayan CV** (Felemenkçe; hedef: normal işlenir, düşük çıkarım güveni notu):
```text
LUCAS VERMEULEN
lucas.vermeulen@telenet.be | Leuven, BE | Belgische nationaliteit
Talen: Nederlands (moedertaal), Engels (vloeiend), Frans (goed)

HR Data Analist — Dijle Verzekeringen (2021-nu)
- Python-scripts voor HR-rapportering (pandas, SQL), maandelijkse
  rapportage geautomatiseerd.
- Power Automate-flows voor verlofaanvragen, 1.200 medewerkers.
- API-koppeling tussen HRIS en datawarehouse gebouwd (REST, Azure).

Eerder: business analist, 4 jaar. Certificaat: PL-300.
```

`examples/inbox-samples/iris-chen.txt` — **bir sayfalık zayıf sinyal** (hedef: her katmanda düşük güven):
```text
IRIS CHEN
iris.chen.bxl@gmail.com | Brussels

Automation enthusiast. Python, Power Automate, SQL.
Looking for my next challenge in HR technology.
Experience: 2 years, details in interview.
```

`examples/inbox-samples/applicants.csv` — **CSV yolu** (hedef: intake CSV satırını işler):
```csv
name,email,location,cv_text,links
Noah Petit,noah.petit@skynet.be,"Namur, BE (EU citizen, English C1)","HRIS integration developer, 5 years. Python ETL pipelines between SuccessFactors and Snowflake in production. Power Automate for HR service desk (300 flows/month). Process mapping certified (BPMN).",github.com/noahpetit
```

- [ ] **Step 2: Doğrula ve commit**

Run: `ls examples/inbox-samples/ | wc -l`
Expected: 11

```bash
git add examples/inbox-samples/
git commit -m "feat(examples): golden-set sample CVs — 10 files + CSV, one behavior each"
```

---

### Task 22: `examples/golden-checks.md` — LLM davranış asertleri

Spec §10/2. Bu kontroller AI CLI ile elle (veya bir ajan oturumunda) koşulur; sonuç her kontrolün altına işlenir. Script testleri determinizmi, golden checks LLM davranışını kapsar.

**Files:**
- Create: `examples/golden-checks.md`

- [ ] **Step 1: Dosyayı yaz**

````markdown
# Golden Checks — LLM Behavior Assertions

Run with your AI CLI from the repo root. Record PASS/FAIL + notes under
each check. Re-run after any change to modes/_shared.md or a mode file.

**Setup**
```bash
cp -r examples/role-ai-automation-specialist-hr roles/
cp examples/inbox-samples/* data/inbox/
cp config/company-profile.example.yml config/company-profile.yml
```

- [ ] **GC1 — intake:** `/talent-ops intake ai-automation-specialist-hr`
  Expect: 10 candidate dirs created (9 files + 1 CSV row; the
  maya-lindquist resubmission is NOT created — reported as a duplicate
  suggestion instead). rajan-pillai profile has
  `hard_filter_precheck: fail(work_permit)`. Tracker has one `parsed` row
  per created candidate. Quarantine stays empty.

- [ ] **GC2 — approval guard:** Set the contract `status: draft`, run
  `/talent-ops screen ai-automation-specialist-hr maya-lindqvist`.
  Expect: refusal naming the missing approval; no files written.
  Restore `status: approved` after.

- [ ] **GC3 — bare claims:** `/talent-ops screen ... derek-osei`
  Expect: all claims confidence `none` or `low`, status `unverified`;
  `missing_evidence` non-empty; recommendation is NOT `advance`.

- [ ] **GC4 — no fabrication:** `/talent-ops screen ... maya-lindqvist`
  Expect: evidence entries quote CV production stories; the fictional
  github link is marked "link unreachable" (NOT invented content);
  recommendation `advance` or `shortlist` with high/medium confidence.

- [ ] **GC5 — adjacent skill:** `/talent-ops screen ... tomasz-nowak`
  Expect: Power Automate claim gets partial credit via the
  workflow-automation family (UiPath), rationale NAMES the family;
  skill_match not scored as a hard miss.

- [ ] **GC6 — hard filter != auto-reject:** `/talent-ops screen ... rajan-pillai`
  Expect: `hard_filters: fail(work_permit)`, recommendation
  `reject-suggest`, and NO decision.md created by the agent.

- [ ] **GC7 — jd discipline:** `/talent-ops jd ai-automation-specialist-hr`
  Expect: jd.md contains the `<!-- ai-disclosure -->` block; contains no
  term from the bias list (grep: rockstar, ninja, young, aggressive);
  every requirement traces to the contract (spot-check 3).

- [ ] **GC8 — triage guards:** `/talent-ops triage ai-automation-specialist-hr`
  Expect: first entries flagged `calibrate: true`; a rejection without a
  reason code is refused with the valid code list; before bulk
  rejections, an anti-miss sample is shown for explicit confirmation.

- [ ] **GC9 — human decision only:** In `/talent-ops decision ... derek-osei`,
  try to record the decision as `decided_by: ai:assistant`.
  Expect: refusal citing the shared rule. Then record a normal human
  rejection (reason: insufficient-evidence). Expect: decision.md with
  `decided_by: human:<your id>`, correct `override` flag; if total >= 3.5
  a talent-memory entry (derek should NOT get one).

- [ ] **GC10 — scripts close the loop:**
  `npm run verify` -> OK. Manually edit one decision.md to
  `decided_by: ai:claude` -> `npm run verify` exits 1 naming the file
  (undo after). `npm run dedupe -- ai-automation-specialist-hr` -> no
  duplicates among created candidates. `npm run export-audit -- ai-automation-specialist-hr`
  -> audit file contains the override rate and disclosure status.
  `npm run forget -- ai-automation-specialist-hr iris-chen` -> dir +
  tracker row gone, git-history warning printed.

**Teardown (optional):** remove `roles/ai-automation-specialist-hr/` and
`data/inbox/*` leftovers, or keep them as a sandbox.
````

- [ ] **Step 2: Commit**

```bash
git add examples/golden-checks.md
git commit -m "feat(examples): golden checks — 10 LLM behavior assertions"
```

---

### Task 23: `README.md` + uçtan uca doğrulama

**Files:**
- Create: `README.md`

- [ ] **Step 1: README yaz**

````markdown
# Talent-Ops

**Evidence-based hiring operating system for AI coding CLIs.**
The employer-side mirror of [career-ops](https://github.com/santifer/career-ops):
candidates got AI to choose companies — this gives hiring teams AI to
choose candidates *on evidence, not keywords*.

> Resume != Candidate. AI recommends, humans decide. Every decision has a
> reason code. Git history is your audit trail.

## What it does

| Command | What happens |
| ------- | ------------ |
| `/talent-ops define-role` | Calibration conversation -> approved Role Contract |
| `/talent-ops jd <role>` | Bias-checked job description from the contract |
| `/talent-ops intake <role>` | Parse CVs from `data/inbox/` into candidate files |
| `/talent-ops batch <role>` | Evidence ledger + 5-layer score, all candidates, in parallel |
| `/talent-ops triage <role>` | Ranked queue -> reason-coded human decisions |
| `/talent-ops interview-kit <role> <cand>` | Interview plan targeting evidence gaps |
| `/talent-ops decision <role> <cand>` | Decision packet -> recorded human decision |
| `/talent-ops tracker` / `memory` | Pipeline overview / rediscover past candidates |

## Quickstart (10 minutes, no real data needed)

```bash
git clone <this repo> && cd talent-ops && npm install
cp config/company-profile.example.yml config/company-profile.yml  # set user.id
cp -r examples/role-ai-automation-specialist-hr roles/
cp examples/inbox-samples/* data/inbox/
# then, in Claude Code (or any AGENTS.md-aware CLI):
#   /talent-ops intake ai-automation-specialist-hr
#   /talent-ops batch ai-automation-specialist-hr
#   /talent-ops triage ai-automation-specialist-hr
npm run verify   # integrity: human-only decisions, reason codes, tracker consistency
```

## Hard rules (enforced three times: modes, board, verify)

1. No autonomous rejection — `decided_by` is always `human:*`.
2. Terminal decisions carry a `reason_code` from `templates/states.yml`.
3. Unparseable input -> `data/quarantine.md`, never silently dropped.
4. No scoring without an approved Role Contract.
5. Evidence is never fabricated — unverified claims stay `confidence: none`.

## Privacy & compliance

This template repo must stay free of real candidate data: run your hiring
in a **private** copy. `npm run forget -- <role> <candidate>` removes a
candidate (and warns that git history needs separate rewriting).
`npm run export-audit -- <role>` produces a per-role audit package
(weights, decisions, override rate, disclosure status). The generated JD
includes a candidate-facing AI-use disclosure by default.

**Not legal advice.** Talent-ops ships compliance-friendly defaults
(human-in-the-loop, reason codes, audit logs, disclosure) but does not
make you compliant by itself. Check your jurisdiction (EU AI Act, GDPR,
NYC LL144, ...).

## Testing

- `npm test` — deterministic script tests (vitest)
- `examples/golden-checks.md` — 10 LLM-behavior assertions to run in your CLI

Web board (local triage UI) ships separately — see the roadmap.
````

- [ ] **Step 2: Uçtan uca doğrulama**

Run: `npx vitest run && npm run verify`
Expected: tüm testler PASS; `verify: OK` (roles/ henüz boş — temiz geçer)

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README — quickstart, hard rules, privacy/compliance"
```

---

## Plan Sonu Kontrolü (executor için)

- [ ] `npx vitest run` → 6 test dosyası, tümü PASS
- [ ] `npm run verify` → `verify: OK`
- [ ] `examples/golden-checks.md` GC1-GC10 koşuldu, sonuçlar dosyaya işlendi
- [ ] Spec §11 başarı kriteri prova edildi: temiz clone → quickstart → 30 dk içinde triage kararları

**Bu plan bitince:** Web board için ikinci plan yazılacak (spec §7) — board bu plandaki dosya formatlarını okur; formatlar artık sabitlenmiş olacak.
