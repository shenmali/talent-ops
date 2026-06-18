# Post-Decision Funnel — Design

**Date:** 2026-06-18
**Status:** approved (design)
**Depends on:** the existing talent-ops core + board + career-ops parity Plan 1.

## 1. Context & motivation

The talent-ops pipeline today ends at the decision:
`define-role → jd → intake → screen → triage → interview-kit → decision → talent-memory`.
Everything *after* the decision is unbuilt. Two activities that belong to a
serious, evidence-based hiring process have no home:

1. **Reference checks** — late-stage verification of the claims that are
   still unproven after screening and interviews. Today a recruiter does
   this off-system, so the result never re-enters the evidence ledger.
2. **Onboarding handoff** — turning an approved hire into a concrete
   first-90-day ramp plan. The role contract already captured
   *first-90-day outcomes* and a *failure scenario*; nothing uses them
   after the hire.

This is the largest coherent gap in the system, and both activities reuse
data talent-ops already captures (the evidence ledger, `score.md`
gaps/risks, the contract's first-90 outcomes). career-ops (candidate side)
has no employer equivalent, so this is net-new ground rather than parity.

## 2. Goals & non-goals

**Goals**
- A `reference-check` mode: generate structured, claim-targeted reference
  questions; record the human-reported outcome back into `evidence.md`.
- An `onboarding` mode: produce an evidence-grounded 30/60/90 ramp plan for
  an approved hire.
- Stay faithful to the core principles: *AI recommends, humans decide*;
  evidence over assertion; provenance everywhere; no silent data loss.

**Non-goals (deliberately out of scope — YAGNI)**
- A post-decision dashboard script ("who needs a reference check / who is
  onboarding"). Add later only if a real need emerges.
- Board UI changes (badge, onboarding page). The board already renders
  `evidence.md` live, so reference outcomes surface without board work.
- Automatic re-scoring after reference evidence lands.
- Sending anything to a reference automatically (drafts only, like
  `outreach`).
- A generic onboarding checklist (laptop, accounts, orientation) — every
  HRIS already does this and it carries none of our evidence value.
- Any change to the stage model in `templates/states.yml`.

## 3. Architecture (Approach A: two thin LLM modes + one schema line)

Two pure LLM modes, mirroring the non-invasive shape of parity Plan 1:

- `modes/reference-check.md` → writes/updates
  `roles/<role>/candidates/<slug>/reference-check.md` and updates that
  candidate's `evidence.md`.
- `modes/onboarding.md` → writes
  `roles/<role>/candidates/<slug>/onboarding.md`.

Both output paths sit under `roles/`, which is already gitignored, so real
candidate PII is never committed.

**Single schema touch:** add `reference` to the `evidence.md` `source`
enum in the `modes/_shared.md` data contract
(`cv | linkedin | github | portfolio | interview | reference`). Verified:
`scripts/verify.mjs` does not validate the source enum (it checks tracker
consistency, "score without evidence.md", and "scored before approval"),
and the board does not hardcode source values — so this is a
documentation-only change with no code edit to `verify.mjs` or the board.

**Untouched:** `templates/states.yml` (stage model), `score.md`/`screen`
scoring logic, the board, the deterministic scripts, and the existing 103
vitest + `npm run verify`. Because no deterministic code is added, **no new
vitest is added** — verification is by golden checks + an end-to-end dry
run in the sandbox. (This is the one structural difference from Plan 1,
which added scripts and therefore unit tests.)

**Why not the alternatives.** Approach B (full lifecycle: a dashboard
script + an onboarding lifecycle marker) is more complete but adds code,
tests, and a stage-ish concept for a surfacing convenience that can be
added later. Approach C (fold the logic into `interview-kit`/`decision`)
avoids new files but muddies single-responsibility and bloats the decision
mode; reference-check and onboarding are distinct activities with distinct
triggers and deserve their own, independently-invokable modes.

## 4. `modes/reference-check.md`

**Purpose:** verify a late-stage candidate's still-unproven must-have
claims through structured reference questions, and record the
human-reported outcome into the evidence ledger.

**Invocation:** `/talent-ops reference-check <role-slug> <candidate-slug>`

### 4.1 Preconditions & gates
1. Contract `status: approved` (shared Guard 1; `revised` = refuse).
2. `score.md` exists — else refuse: "screen first".
3. **Stage check (soft):** reference checks belong after interviews. If the
   candidate has not reached the `interview`/`decision` stage, warn and ask
   before proceeding (do not hard-block — some teams check earlier).
4. **Consent gate (hard):** the mode asks the human to confirm the
   candidate consented to reference contact (normally implied because the
   candidate supplied the references). If consent is not confirmed, the
   mode **refuses to generate** and explains that consent comes first. On
   confirmation it stamps `consent: confirmed by human:<id> on <date>` in
   the file header.
5. **Current-employer guard:** if a named reference works at the
   candidate's *current* employer, flag it and require separate explicit
   confirmation that the candidate approved contacting that specific
   reference (never out a candidate's job search).

### 4.2 Steps
1. **Read:** contract `must_have` + first-90 outcomes; `score.md`
   `missing_evidence` + `risks`; `evidence.md` claims with
   `confidence` below `high` or `status: ai-inferred`; interview scorecard
   digests. Compute the set of must-have claims still unproven after
   screening *and* interviews.
2. If that set is empty (everything is `human-confirmed`), say so — a
   reference check may not be needed.
3. Collect consent + the reference list (name, relationship, company;
   set `current_employer` per the guard).
4. **Generate questions:** for each target claim, 1–3 questions. Format
   (twin of `interview-kit`):
   `Q: <question> | target: <claim/outcome> | listen for: <what
   corroboration vs contradiction sounds like>`.
   **Forbidden:** protected attributes (age, health, family plans, origin,
   beliefs) and anything not tied to a job-relevant claim. Factual,
   behavior-based, legally-safe questions only.
5. **Write** `candidates/<slug>/reference-check.md` (atomic: `.tmp` +
   rename): header + target claims + questions grouped by reference + an
   empty `Responses` section to fill in after the calls.
6. **Record (second phase — after the calls):** the mode operates in two
   phases over the same file. If `reference-check.md` is absent or its
   `Responses` section is empty, it runs the generate phase (steps 1–5). If
   the file exists with filled responses (the human filled the `Responses`
   section, or reports outcomes in chat), it runs the record phase and
   updates `evidence.md`:
   - Reference **corroborates an existing claim** → set that claim's
     `status: human-confirmed`; **leave `source` unchanged** (origin is
     preserved — the reference is the *verifier*, not the origin); append a
     note: `reference <name/relationship>: <gist>, recorded by human:<id>
     on <date>`.
   - Reference **contradicts an existing claim** → set
     `status: contradicted`; append the note; also surface it as a `risks`
     note. **No autonomous rejection** — the human still decides.
   - Reference supplies **new information not in the CV** → add a new claim
     with `source: reference`, `status: human-confirmed`, and a note. This
     is the case the `reference` enum value exists for.
   - **No re-scoring.** `score.md` is not recomputed (no silent score
     change); the human re-runs `screen` if they want an updated score. The
     board renders `evidence.md` live, so updated statuses already show.

### 4.3 Rules
1. Drafts/records only — never contacts a reference; the human runs the
   calls.
2. `reference-check` is **not a decision** — it never writes `decision.md`
   and never stamps `decided_by`.
3. Consent gate + current-employer guard (§4.1) are mandatory.
4. Questions are job-relevant and factual; protected attributes are
   forbidden (mirror `interview-kit`).
5. Recording **transcribes the human's report** with human provenance; the
   AI never invents a reference outcome. If no call has happened yet, only
   questions are produced.
6. Never leak internal scores or other candidates' data into reference
   material.

### 4.4 File format — `reference-check.md`
```markdown
---
candidate: <candidate-slug>
role: <role-slug>
generated_by: ai:<model>
generated_at: <YYYY-MM-DD>
consent: "confirmed by human:<id> on <YYYY-MM-DD>"   # absent/pending -> generation refused
references:
  - { name: "<name>", relationship: "<former manager / peer>", company: "<company>", current_employer: false }
---
# Reference Check — <candidate name>

## Target claims (still unproven after screening + interviews)
- <claim> (confidence: low, status: ai-inferred) — from must-have "<skill>"

## Questions
### <reference name> (<relationship>)
- Q: <question> | target: <claim/outcome> | listen for: <corroboration vs contradiction>

## Responses  (fill after the call, then re-run to record into evidence.md)
### <reference name> — <YYYY-MM-DD>, recorded_by: human:<id>
- <claim>: corroborated | contradicted | unclear — <gist>
```

## 5. `modes/onboarding.md`

**Purpose:** turn an approved hire into an evidence-grounded 30/60/90 ramp
plan — the contract's first-90 outcomes become milestones; the new hire's
evidence gaps become focused ramp support.

**Invocation:** `/talent-ops onboarding <role-slug> <candidate-slug>`

### 5.1 Preconditions
1. `decision.md` exists with `decision: hired` (stage `hired`). Else
   refuse: "record the hire decision first" — onboarding is post-hire.
2. Contract is `approved` (it must be, since the hire was made under it);
   first-90 outcomes are read from it.

### 5.2 Steps
1. **Read:** contract first-90 outcomes + **failure scenario** + interview
   stages; `score.md` `missing_evidence` + low-confidence claims + `risks`;
   `evidence.md` (what stayed unproven/weak even through the full process).
2. **Build the plan:**
   - **30/60/90 milestones** derived from the contract's first-90 outcomes,
     distributed across the timeline with concrete checkpoints.
   - **Ramp focus / support areas:** for each evidence gap (a must-have
     that stayed low-confidence or `ai-inferred`, plus `risks`), a concrete
     onboarding support (pairing, a ramp project, a mentor check-in). Framed
     as "verify-and-build", never "this person is weak".
   - Tie milestones to the **failure scenario** (how to avoid the
     documented 90-day failure mode).
3. **Framing:** respectful and forward-looking. This is a development aid
   for the manager and new hire — **not** a performance verdict and **not**
   a re-litigation of the hiring decision. No protected attributes; no
   comparison to other candidates.
4. **Write** `candidates/<slug>/onboarding.md` (atomic) with
   `status: draft`. Like `outreach`, the hiring manager edits/approves:
   `draft → approved`.
5. Tell the user to review it with the new hire's manager; run
   `npm run verify` (unaffected — keeps the habit).

### 5.3 Rules
1. An assistive draft, not a decision — never writes `decision.md`.
2. Runs only post-hire (`decision: hired`).
3. Evidence gaps are framed as ramp support, never as a deficiency verdict.
4. No protected attributes; no cross-candidate data.

### 5.4 File format — `onboarding.md`
```markdown
---
candidate: <candidate-slug>
role: <role-slug>
generated_by: ai:<model>
generated_at: <YYYY-MM-DD>
status: draft   # draft -> approved (manager)
---
# Onboarding Plan — <candidate name>, <title>

## First-90 outcomes (from the role contract)
1. <outcome>  2. <outcome>  3. <outcome>

## 30 days
- Milestone: <derived from an outcome / early ramp>
- Ramp focus: <evidence-gap-derived support>

## 60 days
- Milestone: ...
- Ramp focus: ...

## 90 days
- Milestone: <outcome delivery checkpoint>

## Watch-fors (from the documented failure scenario)
- <how to avoid the 90-day failure mode>
```

## 6. Schema changes

Single change, in `modes/_shared.md` (the data contract section):

1. Evidence `source` enum gains `reference`:
   `source(cv|linkedin|github|portfolio|interview|reference)`.
2. Add the candidate-dir contents + a one-line data-contract summary for
   `reference-check.md` and `onboarding.md`, in the same style as the
   existing `outreach.md` line.

No code change to `scripts/verify.mjs` or the board (neither validates the
source enum). The existing 103 vitest and `npm run verify` stay green.

## 7. Ethics & compliance (mandatory)

This section MUST be reflected in the mode files, not just the spec.

**reference-check**
- **Consent first.** No reference questions are generated until the human
  confirms candidate consent. No reference is contacted by the system.
- **No current-employer surprise.** A reference at the candidate's current
  employer requires separate explicit approval.
- **Job-relevant only.** Questions target recorded claims; protected
  attributes are forbidden (same list as `interview-kit`).
- **Human verdict.** A contradiction sets evidence status + a risk; it
  never auto-rejects. The AI transcribes the human's report; it never
  invents an outcome.

**onboarding**
- **A development aid, not a judgment.** Evidence gaps are framed as ramp
  support. The plan does not re-grade the hire or rank them against others.
- **No protected attributes; no cross-candidate data.**

**Not legal advice.** Reference checks and onboarding are
jurisdiction-sensitive (consent, data retention, what may be asked). These
modes ship cautious defaults; they do not make the user compliant by
themselves.

## 8. Testing & verification

- **No new deterministic code → no new vitest.** The existing suite and
  `npm run verify` must remain green (regression guard only).
- **Golden checks** (`examples/golden-checks.md`):
  - **GC14 — reference-check:** with a candidate carrying an unproven
    must-have, the mode (a) targets only unproven must-haves, (b) refuses
    to generate when consent is not confirmed, (c) on a reported
    corroboration sets the claim `status: human-confirmed` with reference
    provenance in the note and the origin `source` preserved, (d) never
    writes `decision.md`.
  - **GC15 — onboarding:** the mode refuses unless `decision: hired`; when
    hired, it maps the contract's first-90 outcomes into 30/60/90
    milestones, frames evidence gaps as ramp support (not a verdict), and
    writes `status: draft`.
- **End-to-end dry run** in the sandbox role against an interview/decision
  -stage candidate (reference-check) and a hired candidate (onboarding).

## 9. Documentation

- `README.md`: two rows in the command table (`reference-check`,
  `onboarding`); a short sentence in "How it works"; optionally extend the
  mermaid with light dashed edges (`decision -.-> reference-check`,
  `hired -.-> onboarding`).
- `.claude/skills/talent-ops/SKILL.md`: add both commands to the router and
  discovery list.

## 10. Files touched (summary)

| File | Change |
| ---- | ------ |
| `modes/reference-check.md` | **new** — mode |
| `modes/onboarding.md` | **new** — mode |
| `modes/_shared.md` | `reference` source enum value + 2 data-contract lines |
| `examples/golden-checks.md` | GC14, GC15 |
| `README.md` | command table + flow sentence (+ optional mermaid edges) |
| `.claude/skills/talent-ops/SKILL.md` | router + discovery entries |

No new scripts, no new tests, no board changes, no `states.yml` changes,
no `.gitignore` changes (outputs live under already-ignored `roles/`).

## 11. Plan sequencing (for writing-plans)

A single plan, in this order:
1. `_shared.md` schema touch (`reference` enum + data-contract lines).
2. `modes/reference-check.md`.
3. `modes/onboarding.md`.
4. Docs: README + SKILL.md.
5. Golden checks GC14, GC15.
6. End-to-end dry run + `npm run verify` regression check.
