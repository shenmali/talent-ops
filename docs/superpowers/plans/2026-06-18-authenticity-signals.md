# CV Authenticity Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin, human-facing authenticity-signal layer to screening — `screen` records up to three evidence-grounded signals in `score.md`, surfaced in the board, with zero effect on the score math.

**Architecture:** A new additive step in `modes/screen.md` writes an optional `authenticity_signals[]` array into `score.md`; `modes/_shared.md` defines the three signals + a binding ethical boundary; the board (`model.mjs` + `render.mjs` + `style.css`) displays them read-only. The scoring outputs (`weighted_total`, `recommendation`, `confidence`) stay bit-identical.

**Tech Stack:** Markdown LLM-mode files, YAML frontmatter, the zero-dep board (Node http + `board/lib/*.mjs`), vitest for the board units. `npm run verify` runs on any Node; **vitest needs Node 22** (`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`).

**Spec:** `docs/superpowers/specs/2026-06-18-authenticity-signals-design.md`
**Branch:** `feat/authenticity-signals` (already created; spec committed at 27f3036).

---

### Task 1: `modes/_shared.md` — Authenticity signals rules + ethical boundary + data-contract line

**Files:**
- Modify: `modes/_shared.md`

- [ ] **Step 1: Add `authenticity_signals[]` to the `score.md` data-contract line**

Find this exact block:

```
- `score.md`: scores{hard_filters, skill_match, experience_match,
  evidence_match, behavior_signals}, weighted_total, confidence,
  missing_evidence[], risks[], recommendation, scored_by, scored_at.
```

Replace it with:

```
- `score.md`: scores{hard_filters, skill_match, experience_match,
  evidence_match, behavior_signals}, weighted_total, confidence,
  missing_evidence[], risks[], recommendation, scored_by, scored_at,
  authenticity_signals[] (optional — see "Authenticity signals").
```

- [ ] **Step 2: Add the "Authenticity signals" section before "## Guards"**

Find this exact line:

```
## Guards (preconditions for every mode)
```

Replace it with (the new section, then the original heading):

```
## Authenticity signals

`screen` may record up to three **authenticity signals** in `score.md`
`authenticity_signals[]` — flags for a human reviewer, never an input to the
score. Each entry has `signal` (one of `unverifiable-exaggeration`,
`internal-inconsistency`, `evidence-absence`), `severity` (low|medium|high),
and a concrete `basis` (a quote or observation). A one-line summary is also
appended to `risks[]` for visibility.

- `unverifiable-exaggeration` — grandiose/outsized claims with no backing
  (e.g. "transformed company revenue" with no metric, scope, or role).
- `internal-inconsistency` — contradictions WITHIN the CV (claim vs claim):
  impossible timelines, role/title or date conflicts. Distinct from an
  `evidence.md` `contradicted` status (which is claim vs external evidence).
- `evidence-absence` — a density signal: an unusually high share of
  must-have claims at `confidence: none`. References `missing_evidence`;
  flags the pattern ("most claims unbacked"), not the individual gaps.

**Ethical boundary (binding for every mode):**
- Basis is ONLY text-internal consistency + evidence-verifiability.
- FORBIDDEN: face/voice/video analysis, personality inference, social-media
  surveillance, demographic prediction.
- **No automatic effect:** signals never change `scores`, `weighted_total`,
  `recommendation`, `confidence`, or stage, and never trigger a rejection.
- A concrete `basis` is required; absence of signals is the default, NOT a
  flag.
- `generic-ai-language` is NOT a signal (AI-assisted writing is normal and
  not an authenticity concern).

## Guards (preconditions for every mode)
```

- [ ] **Step 3: Verify**

Run: `grep -n "Authenticity signals" modes/_shared.md`
Expected: two matches (the new `## Authenticity signals` heading and the data-contract cross-reference).

Run: `npm run verify`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add modes/_shared.md
git commit -m "feat(authenticity): _shared.md signals section + ethical boundary + data contract"
```

---

### Task 2: `modes/screen.md` — additive authenticity step

**Files:**
- Modify: `modes/screen.md`

- [ ] **Step 1: Insert the authenticity step and renumber tracker/report**

Find this exact block (current steps 6–7):

```
6. Update tracker row -> stage: screened, fill weighted_total and
   confidence columns, set updated_at to today's ISO date.
7. Report to user: total, confidence, missing_evidence, top risk — and
   that this is an assistive recommendation; the decision is theirs.
```

Replace it with:

```
6. Authenticity signals (ADDITIVE — must not change any score). Evaluate
   the three signals (see _shared.md "Authenticity signals") against the CV
   text and the Evidence Ledger you just built. For each that genuinely
   applies, add an entry to score.md `authenticity_signals[]` with a
   `severity` and a concrete `basis`; if none apply, OMIT the field
   (no fabrication — absence is the default). Append a one-line summary to
   `risks[]` (e.g. "authenticity: 2 signals (1 high) — see
   authenticity_signals"). Do NOT change `scores`, `weighted_total`,
   `recommendation`, or `confidence`. Allowed basis: text-internal
   consistency + evidence-verifiability ONLY; forbidden:
   face/voice/personality/social-media/demographic inference.
7. Update tracker row -> stage: screened, fill weighted_total and
   confidence columns, set updated_at to today's ISO date.
8. Report to user: total, confidence, missing_evidence, top risk, and any
   authenticity signals — and that this is an assistive recommendation; the
   decision is theirs.
```

- [ ] **Step 2: Verify**

Run: `grep -n "Authenticity signals (ADDITIVE" modes/screen.md`
Expected: one match.

Run: `grep -nE "^8\. Report to user" modes/screen.md`
Expected: one match (report is now step 8).

Run: `npm run verify`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add modes/screen.md
git commit -m "feat(authenticity): screen.md additive authenticity step (no scoring change)"
```

---

### Task 3: `board/lib/model.mjs` — card authenticity summary (TDD)

**Files:**
- Test: `test/board/model.test.mjs`
- Modify: `board/lib/model.mjs`

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the `describe('buildModel', ...)` block in `test/board/model.test.mjs` (e.g. after the existing "surfaces score fields" test):

```js
  it('summarizes authenticity signals on the card (count + max severity), null when none', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/flagged/profile.md': '---\nname: Flagged\napplied_at: 2026-06-05\n---\nb\n',
      'roles/r/candidates/flagged/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/flagged/score.md':
        '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: hold\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-06\nauthenticity_signals:\n  - signal: evidence-absence\n    severity: high\n    basis: "most must-haves unbacked"\n  - signal: unverifiable-exaggeration\n    severity: medium\n    basis: "grandiose claim, no metric"\n---\n',
      'roles/r/candidates/clean/profile.md': '---\nname: Clean\napplied_at: 2026-06-05\n---\nb\n',
      'roles/r/candidates/clean/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/clean/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-06\n---\n',
    })
    const role = buildModel(root, { now: new Date('2026-06-11') }).roles[0]
    const flagged = role.candidates.find((c) => c.slug === 'flagged')
    const clean = role.candidates.find((c) => c.slug === 'clean')
    expect(flagged.authenticity).toEqual({ count: 2, maxSeverity: 'high' })
    expect(clean.authenticity).toBe(null)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npx vitest run test/board/model.test.mjs`
Expected: FAIL — `flagged.authenticity` is `undefined`, not `{ count: 2, maxSeverity: 'high' }`.

- [ ] **Step 3: Add the `summarizeAuthenticity` helper**

In `board/lib/model.mjs`, immediately after the `slaFor` function (it ends at the line `  return 'ok'\n}` before `export function buildModel`), insert:

```js
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 }

function summarizeAuthenticity(score) {
  const sigs = Array.isArray(score?.authenticity_signals) ? score.authenticity_signals : []
  if (!sigs.length) return null
  let maxRank = 0
  let maxSeverity = 'low'
  for (const s of sigs) {
    const r = SEVERITY_RANK[s?.severity] ?? 0
    if (r > maxRank) {
      maxRank = r
      maxSeverity = s.severity
    }
  }
  return { count: sigs.length, maxSeverity }
}
```

- [ ] **Step 4: Add the `authenticity` field to the card object**

In `board/lib/model.mjs`, find this exact line inside the `candidates.map(...)` return object:

```js
        risksTop: Array.isArray(score?.risks) && score.risks.length ? score.risks[0] : null,
```

Replace it with:

```js
        risksTop: Array.isArray(score?.risks) && score.risks.length ? score.risks[0] : null,
        authenticity: summarizeAuthenticity(score),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npx vitest run test/board/model.test.mjs`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
git add board/lib/model.mjs test/board/model.test.mjs
git commit -m "feat(authenticity): board model summarizes authenticity signals on the card"
```

---

### Task 4: `board/lib/render.mjs` + `board/public/style.css` — badge + detail block (TDD)

**Files:**
- Test: `test/board/render.test.mjs`
- Modify: `board/lib/render.mjs`, `board/public/style.css`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block at the end of `test/board/render.test.mjs` (after the `renderRole` describe):

```js
describe('authenticity signals', () => {
  function flaggedRepo() {
    return makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/flagged/profile.md': '---\nname: Flagged\nsource: "inbound:f.txt"\napplied_at: 2026-06-05\n---\nCV\n',
      'roles/r/candidates/flagged/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/flagged/score.md':
        '---\nweighted_total: 2.0\nconfidence: low\nrecommendation: hold\nmissing_evidence: []\nrisks: ["authenticity: 1 signal (1 high)"]\nscored_at: 2026-06-06\nscores:\n  skill_match: 2\nauthenticity_signals:\n  - signal: evidence-absence\n    severity: high\n    basis: "most must-haves unbacked"\n---\nr\n',
    })
  }

  it('renders a severity-colored authenticity badge on the pipeline card', () => {
    const html = renderPipeline(buildModel(flaggedRepo(), { now: new Date('2026-06-11') }))
    expect(html).toMatch(/auth-high/)
  })

  it('renders an authenticity block with signal, severity, basis, and a caveat on the candidate page', () => {
    const root = flaggedRepo()
    const detail = loadCandidate(root, 'r', 'flagged')
    const states = loadStates(root)
    const html = renderCandidate(detail, states, { tokens: { decision: 'a', evidence: 'b', profileToken: 'c' }, userId: 'ali' })
    expect(html).toContain('Authenticity signals')
    expect(html).toContain('evidence-absence')
    expect(html).toContain('most must-haves unbacked')
    expect(html).toMatch(/auth-high/)
    expect(html).toMatch(/not a decision/i)
  })

  it('omits the authenticity block when a candidate has no signals', () => {
    const root = makeRepo({
      'roles/r/role-contract.md': approvedContract,
      'roles/r/candidates/clean/profile.md': '---\nname: Clean\napplied_at: 2026-06-05\n---\nCV\n',
      'roles/r/candidates/clean/evidence.md': '---\nclaims: []\n---\n',
      'roles/r/candidates/clean/score.md': '---\nweighted_total: 4.3\nconfidence: high\nrecommendation: advance\nmissing_evidence: []\nrisks: []\nscored_at: 2026-06-06\nscores:\n  skill_match: 5\n---\nr\n',
    })
    const detail = loadCandidate(root, 'r', 'clean')
    const states = loadStates(root)
    const html = renderCandidate(detail, states, { tokens: { decision: 'a', evidence: 'b', profileToken: 'c' }, userId: 'ali' })
    expect(html).not.toContain('Authenticity signals')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npx vitest run test/board/render.test.mjs`
Expected: FAIL — no `auth-high`, no "Authenticity signals" block in output.

- [ ] **Step 3: Add the authenticity badge to the `card` function**

In `board/lib/render.mjs`, find this exact block (the `card` function):

```js
function card(roleSlug, c) {
  const score = c.weightedTotal == null ? '—' : `${esc(c.weightedTotal)} (${esc(c.confidence)})`
  const missing = c.missingCount == null ? '' : `<span class="missing">missing: ${esc(c.missingCount)}</span>`
  const days = c.daysInStage == null ? '' : `<span class="days ${slaClass(c.sla)}">${c.daysInStage}d</span>`
  const rec = c.recommendation ? `<span class="rec rec-${esc(c.recommendation)}">${esc(c.recommendation)}</span>` : ''
  return `<a class="card" href="/candidate/${esc(roleSlug)}/${esc(c.slug)}">
  <span class="name">${esc(c.name)}</span>
  <span class="score">${score}</span>
  ${rec}${missing}${days}
  <span class="src">${esc(c.source)}</span>
</a>`
}
```

Replace it with:

```js
function card(roleSlug, c) {
  const score = c.weightedTotal == null ? '—' : `${esc(c.weightedTotal)} (${esc(c.confidence)})`
  const missing = c.missingCount == null ? '' : `<span class="missing">missing: ${esc(c.missingCount)}</span>`
  const days = c.daysInStage == null ? '' : `<span class="days ${slaClass(c.sla)}">${c.daysInStage}d</span>`
  const rec = c.recommendation ? `<span class="rec rec-${esc(c.recommendation)}">${esc(c.recommendation)}</span>` : ''
  const auth = c.authenticity && c.authenticity.count > 0
    ? `<span class="auth auth-${esc(c.authenticity.maxSeverity)}">⚑ auth · ${esc(c.authenticity.maxSeverity)}</span>` : ''
  return `<a class="card" href="/candidate/${esc(roleSlug)}/${esc(c.slug)}">
  <span class="name">${esc(c.name)}</span>
  <span class="score">${score}</span>
  ${rec}${auth}${missing}${days}
  <span class="src">${esc(c.source)}</span>
</a>`
}
```

- [ ] **Step 4: Add the `authenticityBlock` function and render it on the candidate page**

In `board/lib/render.mjs`, immediately after the `scoreBreakdown` function (it ends with the closing `}` of the `return` for the `<p>...</p>` block), insert:

```js
function authenticityBlock(score) {
  const sigs = Array.isArray(score?.authenticity_signals) ? score.authenticity_signals : []
  if (!sigs.length) return ''
  const items = sigs.map((s) =>
    `<li class="auth-${esc(s.severity)}"><strong>${esc(s.signal)}</strong> · ${esc(s.severity)} — ${esc(s.basis)}</li>`
  ).join('')
  return `<section><h2>Authenticity signals</h2>
<ul class="auth-signals">${items}</ul>
<p class="auth-caveat">Human-check flags — not a decision, never auto-applied. Absence is the default.</p></section>`
}
```

Then find this exact line in `renderCandidate`:

```js
<section><h2>Score</h2>${scoreBreakdown(detail.score)}</section>
<section><h2>Decision</h2>${dec}</section>
```

Replace it with:

```js
<section><h2>Score</h2>${scoreBreakdown(detail.score)}</section>
${authenticityBlock(detail.score)}
<section><h2>Decision</h2>${dec}</section>
```

- [ ] **Step 5: Add severity colors to `board/public/style.css`**

In `board/public/style.css`, find this exact line:

```css
.sla-ok { color: var(--ok); } .sla-warn { color: var(--warn); } .sla-over { background: #3a1416; color: var(--over); }
```

Insert these lines immediately after it:

```css
.auth { font-size: 11px; border-radius: 8px; padding: 0 6px; margin-left: 4px; }
.auth-low { color: var(--muted); } .auth-medium { color: var(--warn); } .auth-high { background: #3a1416; color: var(--over); }
.auth-signals { list-style: none; padding: 0; } .auth-signals li { border-left: 3px solid var(--line); padding: 2px 0 2px 8px; margin: 4px 0; }
.auth-signals li.auth-high { border-left-color: var(--over); } .auth-signals li.auth-medium { border-left-color: var(--warn); }
.auth-caveat { color: var(--muted); font-size: 12px; }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npx vitest run test/board/render.test.mjs`
Expected: PASS (all tests in the file).

- [ ] **Step 7: Commit**

```bash
git add board/lib/render.mjs board/public/style.css test/board/render.test.mjs
git commit -m "feat(authenticity): board badge on cards + signals block on candidate page"
```

---

### Task 5: Golden check GC16

**Files:**
- Modify: `examples/golden-checks.md`

- [ ] **Step 1: Append GC16 after GC15**

Find this exact block (the end of the GC15 entry):

```
  outcomes, evidence gaps framed as ramp support (not a deficiency verdict),
  Watch-fors drawn from the contract's failure scenario, and NO decision.md
  write.
```

Replace it with (GC15 unchanged, GC16 appended):

```
  outcomes, evidence gaps framed as ramp support (not a deficiency verdict),
  Watch-fors drawn from the contract's failure scenario, and NO decision.md
  write.
- [ ] GC16 — authenticity signals: `/talent-ops screen
  ai-automation-specialist-hr derek-osei` (all six evidence claims are
  `confidence: none`). Expect: score.md gains `authenticity_signals[]` with
  at least one medium/high signal (evidence-absence and/or
  unverifiable-exaggeration), each with a concrete `basis`; a one-line
  summary appears in `risks[]`; and `weighted_total`, `recommendation`,
  `confidence` are UNCHANGED from before the step ran (additive-only). Then
  `/talent-ops screen ai-automation-specialist-hr maya-lindqvist` (4 high +
  2 medium evidence claims, advance): expect NO authenticity_signals (or
  only low). The board shows a severity-colored `⚑ auth` badge for derek and
  none for maya; derek's candidate page shows the "Authenticity signals"
  block with the human-check caveat. No signal ever changes a score or
  triggers a rejection.
```

- [ ] **Step 2: Verify**

Run: `grep -n "GC16" examples/golden-checks.md`
Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add examples/golden-checks.md
git commit -m "test(authenticity): golden check GC16 (derek flagged, maya clean, scores unchanged)"
```

---

### Task 6: README — light note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add an authenticity sentence to the "Screen" step**

Find this exact block (item 4 of "How it works"):

```
4. **Screen** — `screen` (one) or `batch` (all, in parallel) builds an
   **Evidence Ledger** — every claim with its source, evidence, confidence
   and verification status — then a decomposable **5-layer score**
   (hard filters · skill · experience · evidence · behavior). Evidence is
   never fabricated; an unbacked claim stays `confidence: none`.
```

Replace it with:

```
4. **Screen** — `screen` (one) or `batch` (all, in parallel) builds an
   **Evidence Ledger** — every claim with its source, evidence, confidence
   and verification status — then a decomposable **5-layer score**
   (hard filters · skill · experience · evidence · behavior). Evidence is
   never fabricated; an unbacked claim stays `confidence: none`. It also
   surfaces up to three **authenticity signals** (unverifiable exaggeration,
   internal inconsistency, evidence absence) as human-visible flags — never
   an input to the score, never grounds for an automatic action.
```

- [ ] **Step 2: Verify**

Run: `grep -n "authenticity signals" README.md`
Expected: one match.

Run: `npm run verify`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(authenticity): note authenticity signals in the README screen step"
```

---

### Task 7: End-to-end dry run + full regression

This is a main-session task (runs the `screen` mode live against the sandbox). Sandbox artifacts under `roles/` are gitignored — leave them uncommitted.

- [ ] **Step 1: Re-screen a low-evidence candidate (signals appear, scores unchanged)**

Record derek-osei's current score first:
Run: `grep -E "weighted_total|^confidence|recommendation" roles/ai-automation-specialist-hr/candidates/derek-osei/score.md`
Expected: `weighted_total: 2.6`, `confidence: low`, `recommendation: hold` (note these).

Then in the CLI: `/talent-ops screen ai-automation-specialist-hr derek-osei` (confirm the re-score overwrite when prompted).
Expected: `score.md` now has `authenticity_signals[]` with ≥1 medium/high signal (evidence-absence and/or unverifiable-exaggeration), each with a concrete `basis`; a one-line `risks[]` summary; and `weighted_total`/`confidence`/`recommendation` are STILL `2.6`/`low`/`hold` (bit-identical — the additive step changed nothing in the math).

- [ ] **Step 2: Re-screen a well-evidenced candidate (no signals)**

In the CLI: `/talent-ops screen ai-automation-specialist-hr maya-lindqvist`.
Expected: NO `authenticity_signals` field (or only `low`); `weighted_total: 4.3`, `confidence: high`, `recommendation: advance` unchanged.

- [ ] **Step 3: Confirm the board renders the signal**

Run: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; PORT=4319 node board/server.mjs &` then open `http://localhost:4319`.
Expected: derek's pipeline card shows a `⚑ auth` badge; his candidate page shows the "Authenticity signals" block with the caveat; maya shows none. Stop the server when done (`kill %1`).

- [ ] **Step 4: Full regression**

Run: `npm run verify`
Expected: `OK`.

Run: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npm test`
Expected: all tests pass (the previous 103 + the new board tests from Tasks 3–4).

- [ ] **Step 5: No commit for sandbox artifacts**

Confirm `git status` shows no `roles/` changes staged (gitignored). Only the Task 1–6 commits should be on the branch.

---

## Self-Review

**Spec coverage:**
- §3 architecture (additive step in screen, bit-identical scoring) → Task 2 + the GC16/e2e assertions (Tasks 5, 7). ✓
- §4 three signals + schema → Task 1 (definitions + data contract) + Task 2 (screen writes them). ✓
- §5 screen step → Task 2. ✓
- §6 ethical boundary in _shared.md → Task 1 Step 2. ✓
- §7 board (model summary + render badge/block + css) → Task 3 (model) + Task 4 (render + css). ✓
- §8 schema (optional field, no verify/states change) → Task 1; no verify.mjs/states.yml task (correctly absent). ✓
- §9 testing (board vitest additive; GC16; e2e; bit-identical guard) → Tasks 3, 4 (vitest), 5 (GC16), 7 (e2e + regression). ✓
- §10 README note → Task 6. ✓
- §11 files-touched table → Tasks 1–6 touch exactly those files. ✓
- §12 sequencing → Task order 1→7 matches. ✓

**Placeholder scan:** no TBD/TODO/"handle edge cases". Test code and implementation code are complete and concrete. The `<...>` tokens appear only inside the `_shared.md`/`screen.md` prose describing the YAML field, not as plan placeholders.

**Type/string consistency:** `authenticity` (card field) is set in Task 3 (model) and read in Task 4 (`c.authenticity`, `c.authenticity.count`, `c.authenticity.maxSeverity`) — names match. `summarizeAuthenticity` returns `{ count, maxSeverity }` (Task 3) — exactly what the card badge consumes (Task 4). `authenticity_signals` / `signal` / `severity` / `basis` are spelled identically across `_shared.md` (Task 1), `screen.md` (Task 2), the model helper (Task 3, reads `score.authenticity_signals` + `s.severity`), the render block (Task 4, reads `s.signal`/`s.severity`/`s.basis`), and GC16 (Task 5). The CSS classes `auth` / `auth-low|medium|high` / `auth-signals` / `auth-caveat` (Task 4 Step 5) match the classes emitted by the badge and block (Task 4 Steps 3–4).
