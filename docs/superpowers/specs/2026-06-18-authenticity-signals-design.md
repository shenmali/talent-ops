# CV Authenticity Signals — Design

**Date:** 2026-06-18
**Status:** approved (design)
**Supersedes:** the Plan-2 sketch in `docs/superpowers/specs/2026-06-17-career-ops-parity-design.md` §8 (this is the full, refined design; it narrows §8's four signals to three and drops `generic-ai-language`).
**Depends on:** the existing talent-ops core + board.

## 1. Context & motivation

`screen` builds an Evidence Ledger (each claim → source, evidence,
confidence, verification status) and a 5-layer score. It answers "is the
evidence there?" but not "does this CV, read as a whole, raise authenticity
concerns a human should look at?" — e.g. grandiose claims with no backing,
internal contradictions, or a CV that is almost entirely unbacked
assertion.

This feature adds a thin, human-facing **authenticity signal layer** to the
screening output. It is the employer-side analogue of career-ops's
scam/ghost-job detector ("Block G"), pointed at CVs instead of job posts.

The hard constraint that shapes everything: **AI recommends, humans decide.**
Authenticity signals are *visible flags for a human reviewer*, never an
input to the score and never grounds for an automatic action.

## 2. Goals & non-goals

**Goals**
- Surface up to three evidence-grounded authenticity signals per candidate,
  each with a severity and a concrete basis, written by `screen`.
- Make them visible where humans review: `score.md`, the decision packet,
  and the board.
- Keep the scoring behaviour (`weighted_total`, `recommendation`,
  `confidence`) **bit-identical** to before — the signals are additive and
  inert with respect to the math.

**Non-goals (deliberately out of scope — YAGNI / ethics)**
- A `generic-ai-language` signal. AI-assisted CV writing is normal in 2026
  (and an equaliser for non-native speakers); "reads like AI" is not an
  authenticity concern and risks penalising honest, disadvantaged
  candidates. Excluded by design.
- Any automatic effect on `weighted_total`, `recommendation`, `confidence`,
  or stage. No auto-reject. Ever.
- Any face/voice/video analysis, personality inference, social-media
  surveillance, or demographic prediction.
- A separate `authenticity` mode (the step is embedded in `screen`).
- A new board write-action (the board only *displays* the signals).
- Enforcing the field in `scripts/verify.mjs` (it stays optional and
  unenforced, so old `score.md` files remain valid).

## 3. Architecture (Approach A: a thin step embedded in `screen`)

`screen` gains a final, **additive** step after scoring. It evaluates the
three signals from material it has already read (the CV text and the
Evidence Ledger it just built) and writes an optional `authenticity_signals[]`
array into `score.md`, plus a one-line summary into `risks[]` for
visibility. It does not touch the score layers, total, recommendation, or
confidence. `batch` is covered automatically (it injects `screen.md` into
each per-candidate subagent).

**Why embedded, not a separate mode:** the signals belong to the same
single pass that reads the candidate; embedding keeps it DRY and always-on
(a separate mode is easy to forget, leaving the signal usually absent). The
additive-only rule (below) protects the core scoring behaviour.

**The hard invariant:** the authenticity step MUST NOT change any scoring
output. `weighted_total`, `recommendation`, and `confidence` for a given
candidate must be identical with and without this feature. This is verified
by GC16 and the e2e dry run (re-screen a known candidate; assert the score
fields are unchanged).

## 4. The three signals

Each signal is defined precisely so it complements — never duplicates — the
Evidence Ledger.

1. **`unverifiable-exaggeration`** — grandiose or outsized claims with no
   backing evidence (e.g. "transformed company revenue" with no metric,
   scope, or role detail). NEW: not represented in the ledger.
2. **`internal-inconsistency`** — contradictions *within the CV itself*
   (claim vs claim): impossible timelines, role/title mismatches,
   conflicting dates. Distinct from `evidence.md` `status: contradicted`,
   which is claim-vs-*external-evidence*. NEW lens.
3. **`evidence-absence`** — a *density / pattern* signal: an unusually high
   share of must-have claims sitting at `confidence: none`. It references
   `missing_evidence` (it does not re-list the individual gaps); it flags
   the pattern ("most claims are unbacked"), which no single ledger field
   expresses. Complements, does not duplicate.

### 4.1 Schema (optional, backward-compatible field in `score.md`)
```yaml
authenticity_signals:        # optional; OMIT the field when nothing is observed (no fabrication)
  - signal: unverifiable-exaggeration   # | internal-inconsistency | evidence-absence
    severity: low | medium | high
    basis: "<concrete basis — a quote/observation from the CV or evidence>"
```

- A one-line summary is also appended to `risks[]` for visibility, e.g.
  `authenticity: 2 signals (1 high) — see authenticity_signals`.
- Every signal REQUIRES a concrete, falsifiable `basis`. No vague flags.
- When nothing is observed, the field is omitted/empty — the same
  no-fabrication rule the Evidence Ledger already follows. Absence of
  signals is the default and is **not** itself suspicious.

## 5. `modes/screen.md` — the additive step

A new final step (after scoring, before the report):

> Evaluate the three authenticity signals against the CV text and the
> Evidence Ledger you just built. For each that genuinely applies, add an
> entry to `authenticity_signals[]` with a severity and a concrete `basis`.
> If none apply, omit the field. Append a one-line summary to `risks[]`.
> This step is purely a human-visible signal: do NOT change `scores`,
> `weighted_total`, `recommendation`, or `confidence`.

The step also restates the ethical boundary inline (text-internal +
evidence-verifiability only) and the "absence is the default" rule.

## 6. Ethical boundary (`modes/_shared.md`, mandatory)

A new "Authenticity signals" section in `_shared.md` states, as a binding
rule for every mode:

- **Allowed basis, only:** text-internal consistency and
  evidence-verifiability (claim vs claim, claim vs the candidate's own
  provided evidence).
- **Forbidden:** face/voice/video analysis, personality inference,
  social-media surveillance, demographic prediction.
- **No automatic effect:** signals never change the score, recommendation,
  confidence, or stage, and never trigger an automatic rejection. They are
  flags for a human.
- **Concrete basis required;** absence of signals is the default (not a
  red flag).
- `generic-ai-language` is explicitly NOT a signal (AI-assisted writing is
  normal and not an authenticity concern).
- The data contract gains the optional `authenticity_signals` field on
  `score.md`.

## 7. Board integration (display only)

The board **never writes** authenticity signals (`screen` does); it only
renders them.

- **`board/lib/model.mjs`:** in `buildModel`'s per-candidate card summary
  (alongside `risksTop`), add a compact summary derived from
  `score.authenticity_signals`: `{ count, maxSeverity }` (or null when
  there are none). `loadCandidate` already carries the full `score`, so the
  detail view reads `score.authenticity_signals` directly — no further model
  change there.
- **`board/lib/render.mjs`:**
  - `card` (triage queue + pipeline): when `count > 0`, a compact
    severity-coloured badge (e.g. `⚑ auth · high`, coloured by
    `maxSeverity`). Absent when there are no signals.
  - candidate detail (`scoreBreakdown` / `renderCandidate`): an
    "Authenticity signals" block listing each `signal · severity · basis`,
    severity-coloured, with a mandatory caveat line: "human-check flag —
    not a decision, never auto-applied." Absent when there are none.
- **`board/public/style.css`:** low/medium/high severity colours, following
  the existing `rec-*` / `sla` colour pattern.

## 8. Schema changes

- `score.md`: optional `authenticity_signals[]` (per §4.1). Backward
  compatible — absent in old files; the board shows nothing; `verify.mjs`
  does not enforce it.
- `modes/_shared.md` data contract: add the `authenticity_signals` line to
  the `score.md` entry, plus the new "Authenticity signals" rules section
  (§6).
- No change to `templates/states.yml`, `scripts/verify.mjs`, or the scoring
  layers/weights.

## 9. Testing & verification

- **Board unit tests (vitest, additive):**
  - `test/board/model.test.mjs`: the card model exposes
    `{ count, maxSeverity }` when `score.authenticity_signals` is present,
    and null/absent when it is not.
  - `test/board/render.test.mjs`: the candidate-detail "Authenticity
    signals" block renders with the caveat when signals exist; the card
    badge renders when signals exist and is omitted when they do not.
  - The existing suite must stay green (this wave adds tests; tests need
    Node 22 — `nvm use 22`).
- **Golden check GC16:** `/talent-ops screen ai-automation-specialist-hr
  derek-osei` → at least one medium/high signal (exaggeration /
  evidence-absence), each with a concrete basis; and `weighted_total`,
  `recommendation`, `confidence` are **unchanged** from before the feature
  (additive-only). A well-evidenced candidate (e.g. maya-lindqvist) → no
  authenticity signals (or only low). The board shows the badge for derek,
  none for maya.
- **End-to-end dry run** in the sandbox: re-screen derek (signals appear,
  score fields unchanged) and a well-evidenced candidate (no signals);
  confirm the board renders the badge for the former only; `npm run verify`
  stays OK.
- **The bit-identical scoring guarantee (§3) is the key regression** — GC16
  and the e2e both assert it explicitly.

## 10. Documentation

- `README.md`: a light note that `screen` also surfaces authenticity
  signals (in the "Screen" step of "How it works"), framed as
  assistive/human-visible. No new command, so the command table and `SKILL`
  router are unchanged.

## 11. Files touched (summary)

| File | Change |
| ---- | ------ |
| `modes/screen.md` | additive authenticity step (no scoring change) |
| `modes/_shared.md` | "Authenticity signals" rules section + ethical boundary + `score.md` data-contract line |
| `board/lib/model.mjs` | card summary `{ count, maxSeverity }` from `authenticity_signals` |
| `board/lib/render.mjs` | candidate-detail signals block + triage/pipeline badge |
| `board/public/style.css` | severity colours |
| `test/board/model.test.mjs` | card-summary assertions (additive) |
| `test/board/render.test.mjs` | detail block + badge assertions (additive) |
| `examples/golden-checks.md` | GC16 |
| `README.md` | light "screen also surfaces authenticity signals" note |

No new modes, no new scripts, no `states.yml` / `verify.mjs` change, no new
board write-action, no `.gitignore` change.

## 12. Plan sequencing (for writing-plans)

A single plan, in this order:
1. `modes/_shared.md` — "Authenticity signals" section + ethical boundary +
   data-contract line (schema first, so the mode + board have a contract).
2. `modes/screen.md` — the additive step.
3. `board/lib/model.mjs` — card summary (TDD: model.test.mjs first).
4. `board/lib/render.mjs` + `board/public/style.css` — detail block + badge
   (TDD: render.test.mjs first).
5. `examples/golden-checks.md` — GC16.
6. `README.md` — the light note.
7. End-to-end dry run + full regression (`npm run verify` + `nvm use 22 &&
   npm test`), asserting scoring is bit-identical.
