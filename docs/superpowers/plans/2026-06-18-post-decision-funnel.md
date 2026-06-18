# Post-Decision Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two post-decision LLM modes — `reference-check` (verify still-unproven claims via reference questions, record outcomes to the evidence ledger) and `onboarding` (an evidence-grounded 30/60/90 ramp plan for a hire).

**Architecture:** Two pure-LLM mode files plus a single documentation-only schema touch (the `evidence.md` `source` enum gains `reference`). No new scripts, no board changes, no `states.yml` changes, no new unit tests. Outputs live under the already-gitignored `roles/`. Verification is by golden checks (GC14/GC15) + an end-to-end dry run; the existing 103 vitest and `npm run verify` are a regression guard only.

**Tech Stack:** File-based markdown modes (LLM instructions), YAML frontmatter, Node built-in `scripts/verify.mjs` for the integrity regression check. Zero new dependencies. `npm run verify` runs on any Node (pure built-ins) — this plan adds no vitest, so the Node-16-default-shell trap does not apply.

**Spec:** `docs/superpowers/specs/2026-06-18-post-decision-funnel-design.md`
**Branch:** `feat/post-decision-funnel` (already created; spec committed at 70c1cee).

---

### Task 1: Schema touch — `evidence.md` source enum + data-contract lines

**Files:**
- Modify: `modes/_shared.md` (data contract section)

This is the only schema change in the whole feature. `scripts/verify.mjs` does not validate the source enum and the board does not hardcode source values (both verified by code reading), so this is documentation-only.

- [ ] **Step 1: Add `reference` to the evidence source enum**

In `modes/_shared.md`, find this exact block:

```
- `evidence.md`: claims[{claim, source(cv|linkedin|github|portfolio|interview),
  evidence, evidence_type(repo|publication|certification|story|none),
  confidence(high|medium|low|none),
  status(unverified|ai-inferred|human-confirmed|contradicted), note}].
```

Replace it with:

```
- `evidence.md`: claims[{claim, source(cv|linkedin|github|portfolio|interview|reference),
  evidence, evidence_type(repo|publication|certification|story|none),
  confidence(high|medium|low|none),
  status(unverified|ai-inferred|human-confirmed|contradicted), note}].
  `source: reference` is written only by the reference-check mode — a fact
  relayed from a reference call, recorded with human provenance.
```

- [ ] **Step 2: Add the two new files to the candidate-dir contents list**

Find this exact block:

```
- Candidate dir contents: `source/` (original files, never modified),
  `profile.md`, `evidence.md`, `score.md`, `decision.md`, `packet.md`
  (decision packet, written by the decision mode),
  `interview/<stage>-plan.md`, `interview/<stage>-scorecard.md`.
```

Replace it with:

```
- Candidate dir contents: `source/` (original files, never modified),
  `profile.md`, `evidence.md`, `score.md`, `decision.md`, `packet.md`
  (decision packet, written by the decision mode),
  `interview/<stage>-plan.md`, `interview/<stage>-scorecard.md`,
  `reference-check.md`, `onboarding.md`.
```

- [ ] **Step 3: Add data-contract summary lines after the `outreach.md` line**

Find this exact block:

```
- `outreach.md`: chronological draft messages to the candidate (invite |
  reject | offer | followup-update), each stamped `drafted_by: ai:<model>`
  and `status: draft|approved`. Drafts only — never sent. Not a decision.
```

Replace it with (append the two new bullets):

```
- `outreach.md`: chronological draft messages to the candidate (invite |
  reject | offer | followup-update), each stamped `drafted_by: ai:<model>`
  and `status: draft|approved`. Drafts only — never sent. Not a decision.
- `reference-check.md`: late-stage reference questions targeting still-
  unproven must-have claims, plus recorded responses. Written by the
  reference-check mode; consent-gated; never sent. Recording updates
  `evidence.md` with human provenance. Not a decision.
- `onboarding.md`: an evidence-grounded 30/60/90 ramp plan for an approved
  hire (first-90 outcomes -> milestones; evidence gaps -> ramp support).
  `generated_by: ai:<model>`, `status: draft|approved`. An assistive draft,
  not a decision.
```

- [ ] **Step 4: Verify the edit landed and integrity holds**

Run: `grep -n "portfolio|interview|reference" modes/_shared.md`
Expected: one match showing the enum now includes `reference`.

Run: `npm run verify`
Expected: `OK` (exit 0) — no regression from the doc edit.

- [ ] **Step 5: Commit**

```bash
git add modes/_shared.md
git commit -m "feat(post-decision): add reference to evidence source enum + data contract"
```

---

### Task 2: `modes/reference-check.md`

**Files:**
- Create: `modes/reference-check.md`

- [ ] **Step 1: Create the mode file with this exact content**

````markdown
# Mode: reference-check

Purpose: verify a late-stage candidate's still-unproven must-have claims
through structured reference questions, then record the human-reported
outcome into the evidence ledger. Drafts/records only — talent-ops never
contacts a reference.

Invocation: /talent-ops reference-check <role-slug> <candidate-slug>

## Two phases (same file)
- GENERATE: if reference-check.md is absent or its Responses section is
  empty, produce the questions (Steps 1-5).
- RECORD: if reference-check.md exists with filled responses (or the human
  reports outcomes in chat), update evidence.md (Step 6). Never invent an
  outcome — only transcribe what the human reports.

## Preconditions & gates
- Contract `status: approved` (see _shared.md Guard 1; `revised` = refuse).
- score.md exists — else refuse: "screen first".
- Stage (soft): reference checks belong after interviews. If the candidate
  has not reached the interview/decision stage, warn and ask before
  proceeding (do not hard-block).
- Consent (HARD): confirm the candidate consented to reference contact
  (normally implied — the candidate supplied the references). If not
  confirmed, refuse to generate and say consent comes first. On
  confirmation, stamp `consent: confirmed by human:<id> on <date>`
  (user.id from config/company-profile.yml).
- Current employer: if a reference works at the candidate's CURRENT
  employer, flag it and require separate explicit approval to contact that
  reference — never out a candidate's job search.

## Steps
1. Read: contract must_have + first-90 outcomes; score.md missing_evidence
   + risks; evidence.md claims with confidence below high or status
   ai-inferred; interview scorecard digests. Compute the must-have claims
   still unproven after screening AND interviews.
2. If that set is empty (all must-haves human-confirmed), say a reference
   check may not be needed and stop.
3. Collect consent + the reference list (name, relationship, company;
   mark current_employer per the guard).
4. For each target claim, generate 1-3 questions. Format:
   `Q: <question> | target: <claim/outcome> | listen for: <what
   corroboration vs contradiction sounds like>`. Forbidden: protected
   attributes (age, health, family plans, origin, beliefs) and any question
   not tied to a job-relevant claim. Factual, behavior-based, legally-safe
   questions only.
5. Write candidates/<slug>/reference-check.md (atomic: write <file>.tmp,
   then rename): frontmatter header + Target claims + Questions grouped by
   reference + an empty Responses section.
6. RECORD (after the calls) — for each claim a reference addressed, update
   evidence.md:
   - corroborates an existing claim -> set status: human-confirmed; LEAVE
     source unchanged (origin is preserved — the reference is the verifier,
     not the origin); append note `reference <name/relationship>: <gist>,
     recorded by human:<id> on <date>`.
   - contradicts an existing claim -> set status: contradicted; append the
     note; add a risks note. NEVER auto-reject — the human decides.
   - new information not in the CV -> add a NEW claim with source:
     reference, status: human-confirmed, and a note.
   Do NOT recompute score.md (no silent score change); the human re-runs
   screen for an updated score. Atomic write.

## Rules
1. Drafts/records only — never contact a reference; the human runs calls.
2. Not a decision: never write decision.md, never stamp decided_by.
3. Consent gate + current-employer guard are mandatory.
4. Questions are job-relevant and factual; protected attributes forbidden.
5. Recording transcribes the human's report with human provenance; never
   invent a reference outcome.
6. Never leak internal scores or other candidates' data to a reference.
7. After writing, tell the user to run `npm run verify` and review.

## Output file: candidates/<slug>/reference-check.md
Each generation writes the header + questions; the human fills Responses.

```
---
candidate: <candidate-slug>
role: <role-slug>
generated_by: ai:<model>
generated_at: <YYYY-MM-DD>
consent: "confirmed by human:<id> on <YYYY-MM-DD>"
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
````

- [ ] **Step 2: Verify the file is well-formed**

Run: `grep -nE "Consent \(HARD\)|never contact a reference|source: *reference|Not a decision" modes/reference-check.md`
Expected: matches for the consent gate, the no-contact rule, the reference-source recording, and the not-a-decision rule.

Run: `npm run verify`
Expected: `OK` (regression — a new mode file must not break integrity).

- [ ] **Step 3: Commit**

```bash
git add modes/reference-check.md
git commit -m "feat(post-decision): reference-check mode — verify unproven claims, record to ledger"
```

---

### Task 3: `modes/onboarding.md`

**Files:**
- Create: `modes/onboarding.md`

- [ ] **Step 1: Create the mode file with this exact content**

````markdown
# Mode: onboarding

Purpose: turn an approved hire into an evidence-grounded 30/60/90 ramp plan
— the contract's first-90 outcomes become milestones; the new hire's
evidence gaps become focused ramp support. An assistive draft, not a
decision.

Invocation: /talent-ops onboarding <role-slug> <candidate-slug>

## Preconditions
- decision.md exists with `decision: hired` (stage hired). Else refuse:
  "record the hire decision first" — onboarding is post-hire.
- Contract `status: approved` (it is, since the hire was made under it);
  first-90 outcomes are read from it.

## Steps
1. Read: contract First-90-days outcomes + Failure scenario + interview
   stages; score.md missing_evidence + low-confidence claims + risks;
   evidence.md (what stayed unproven/weak through the full process).
2. Build the plan:
   - 30/60/90 milestones derived from the contract's first-90 outcomes,
     distributed across the timeline with concrete checkpoints.
   - Ramp focus / support areas: for each evidence gap (a must-have that
     stayed low-confidence or ai-inferred, plus risks), a concrete support
     (pairing, a ramp project, a mentor check-in). Frame as
     "verify-and-build", never "this person is weak".
   - Tie milestones to the Failure scenario (how to avoid the documented
     90-day failure mode).
3. Framing: respectful, forward-looking. A development aid for the manager
   and new hire — NOT a performance verdict, NOT a re-litigation of the
   hire. No protected attributes; no comparison to other candidates.
4. Write candidates/<slug>/onboarding.md (atomic) with status: draft. Like
   outreach, the manager edits/approves: status draft -> approved.
5. Tell the user to review it with the new hire's manager and run
   `npm run verify` (unaffected — keeps the habit).

## Rules
1. An assistive draft, not a decision — never write decision.md.
2. Runs only post-hire (decision: hired).
3. Evidence gaps are framed as ramp support, never as a deficiency verdict.
4. No protected attributes; no cross-candidate data.

## Output file: candidates/<slug>/onboarding.md

```
---
candidate: <candidate-slug>
role: <role-slug>
generated_by: ai:<model>
generated_at: <YYYY-MM-DD>
status: draft
---
# Onboarding Plan — <candidate name>, <title>

## First-90 outcomes (from the role contract)
1. <outcome>  2. <outcome>  3. <outcome>

## 30 days
- Milestone: <derived from an outcome / early ramp>
- Ramp focus: <evidence-gap-derived support>

## 60 days
- Milestone: <next outcome / deepening>
- Ramp focus: <evidence-gap-derived support>

## 90 days
- Milestone: <outcome delivery checkpoint>

## Watch-fors (from the documented failure scenario)
- <how to avoid the 90-day failure mode>
```
````

- [ ] **Step 2: Verify the file is well-formed**

Run: `grep -nE "record the hire decision first|decision: hired|ramp support|not a decision|performance verdict" modes/onboarding.md`
Expected: matches for the post-hire gate, the hired precondition, the ramp-support framing, and the not-a-judgment rules.

Run: `npm run verify`
Expected: `OK` (regression).

- [ ] **Step 3: Commit**

```bash
git add modes/onboarding.md
git commit -m "feat(post-decision): onboarding mode — evidence-grounded 30/60/90 ramp plan"
```

---

### Task 4: Documentation — README + SKILL router

**Files:**
- Modify: `modes/_shared.md` (Guard 1 list)
- Modify: `README.md` (command table, How-it-works narrative, mermaid)
- Modify: `.claude/skills/talent-ops/SKILL.md` (argument-hint, routing table, discovery menu, context loading)

- [ ] **Step 0: `modes/_shared.md` — add `reference-check` to the Guard 1 approved-contract list**

(Surfaced by the Task 2 code-quality review: `reference-check.md` says "see _shared.md Guard 1" but Guard 1 did not name it, making the cross-reference misleading.) Find this exact block in `modes/_shared.md`:

```
1. jd / screen / batch / triage / interview-kit / decision require the
   role's contract `status: approved`. Refuse otherwise, naming the missing
   approval.
```

Replace it with:

```
1. jd / screen / batch / triage / interview-kit / decision / reference-check
   require the role's contract `status: approved`. Refuse otherwise, naming
   the missing approval. (onboarding's gate is a recorded `decision: hired`,
   which implies an approved contract.)
```

- [ ] **Step 1: README — add two command-table rows**

Find this exact line:

```
| `/talent-ops decision <role> <cand>` | Decision packet -> recorded human decision |
```

Replace it with:

```
| `/talent-ops decision <role> <cand>` | Decision packet -> recorded human decision |
| `/talent-ops reference-check <role> <cand>` | Reference questions for unproven claims; records outcomes to the ledger |
| `/talent-ops onboarding <role> <cand>` | Evidence-grounded 30/60/90 ramp plan for a hire |
```

- [ ] **Step 2: README — add a post-decision sentence to "How it works"**

Find this exact block (end of the numbered list):

```
8. **Remember & audit** — strong-but-rejected candidates enter talent memory
   for rediscovery when a future role opens; `verify` checks integrity and
   `export-audit` produces a per-role compliance package on demand.
```

Replace it with:

```
8. **Remember & audit** — strong-but-rejected candidates enter talent memory
   for rediscovery when a future role opens; `verify` checks integrity and
   `export-audit` produces a per-role compliance package on demand.

After a decision, two post-decision modes extend the same evidence trail:
**reference-check** turns still-unproven must-haves into structured
reference questions and records the outcome back into the ledger
(`source: reference`); **onboarding** turns an approved hire's first-90
outcomes and evidence gaps into a 30/60/90 ramp plan.
```

- [ ] **Step 3: README — extend the mermaid with the two post-decision modes**

Find this exact block:

```
flowchart TD
    DR["define-role"] -->|"role-contract.md (approved)"| JD["jd"]
    JD -->|"jd.md (bias-checked + AI disclosure)"| IN["intake"]
    IN -->|"profile.md per candidate"| SC["screen / batch"]
    SC -->|"evidence.md + score.md"| TR["triage"]
    TR -->|"your reason-coded decision"| IK["interview-kit"]
    IK -->|"scorecards"| DE["decision"]
    DE -->|"decision.md (decided_by: human:*)"| MEM["talent memory"]
    TR -.->|"any time"| V["npm run verify · export-audit"]
```

Replace it with:

```
flowchart TD
    DR["define-role"] -->|"role-contract.md (approved)"| JD["jd"]
    JD -->|"jd.md (bias-checked + AI disclosure)"| IN["intake"]
    IN -->|"profile.md per candidate"| SC["screen / batch"]
    SC -->|"evidence.md + score.md"| TR["triage"]
    TR -->|"your reason-coded decision"| IK["interview-kit"]
    IK -->|"scorecards"| DE["decision"]
    IK -.->|"verify unproven claims"| RC["reference-check"]
    RC -.->|"evidence.md (source: reference)"| DE
    DE -->|"decision.md (decided_by: human:*)"| MEM["talent memory"]
    DE -.->|"hired"| ONB["onboarding (30/60/90)"]
    TR -.->|"any time"| V["npm run verify · export-audit"]
```

- [ ] **Step 4: SKILL.md — add to argument-hint**

Find this exact line:

```
argument-hint: "[define-role | jd | intake | screen | batch | triage | interview-kit | decision | outreach | followup | analytics | tracker | memory]"
```

Replace it with:

```
argument-hint: "[define-role | jd | intake | screen | batch | triage | interview-kit | decision | reference-check | onboarding | outreach | followup | analytics | tracker | memory]"
```

- [ ] **Step 5: SKILL.md — add routing-table rows**

Find this exact line:

```
| `decision <role-slug> <candidate-slug>` | decision |
```

Replace it with:

```
| `decision <role-slug> <candidate-slug>` | decision |
| `reference-check <role-slug> <candidate-slug>` | reference-check |
| `onboarding <role-slug> <candidate-slug>` | onboarding |
```

- [ ] **Step 6: SKILL.md — add discovery-menu lines**

Find this exact line:

```
  /talent-ops decision <role> <cand> -> Decision packet + recorded human decision
```

Replace it with:

```
  /talent-ops decision <role> <cand> -> Decision packet + recorded human decision
  /talent-ops reference-check <role> <cand> -> Reference questions for unproven claims; records outcomes
  /talent-ops onboarding <role> <cand> -> Evidence-grounded 30/60/90 ramp plan for a hire
```

- [ ] **Step 7: SKILL.md — update the context-loading section**

Find this exact block:

```
- Modes requiring `modes/_shared.md` + their own file: define-role, jd,
  intake, screen, batch, triage, interview-kit, decision.
  (Note: Guard 1 in _shared.md — the approved-contract gate — applies only
  to jd, screen, batch, triage, interview-kit, decision. define-role and
  intake load _shared.md for slug/quarantine/provenance rules and run
  without an approved contract.)
```

Replace it with:

```
- Modes requiring `modes/_shared.md` + their own file: define-role, jd,
  intake, screen, batch, triage, interview-kit, decision, reference-check,
  onboarding.
  (Note: Guard 1 in _shared.md — the approved-contract gate — applies to
  jd, screen, batch, triage, interview-kit, decision, reference-check.
  onboarding requires a recorded `decision: hired` (which implies an
  approved contract). define-role and intake load _shared.md for
  slug/quarantine/provenance rules and run without an approved contract.)
```

- [ ] **Step 8: Verify docs landed**

Run: `grep -c "reference-check\|onboarding" README.md .claude/skills/talent-ops/SKILL.md`
Expected: `README.md` >= 3 and `SKILL.md` >= 4 (both new commands present in each).

Run: `grep -n "interview-kit / decision / reference-check" modes/_shared.md`
Expected: one match (Guard 1 now names reference-check).

Run: `npm run verify`
Expected: `OK`.

- [ ] **Step 9: Commit**

```bash
git add modes/_shared.md README.md .claude/skills/talent-ops/SKILL.md
git commit -m "docs(post-decision): add reference-check + onboarding to README + SKILL router; fix Guard 1 list"
```

---

### Task 5: Golden checks GC14, GC15

**Files:**
- Modify: `examples/golden-checks.md` (append two checks)

- [ ] **Step 1: Append GC14 and GC15**

Find this exact block (the GC13 entry, currently the last check before the Teardown note):

```
- [ ] GC13 — analytics disclaimer: `node scripts/analyze-funnel.mjs
  ai-automation-specialist-hr`. Expect: valid JSON with funnel/reasonCodes/
  overrideRate/source; `fairnessSignals.disclaimer` present and states it is
  NOT a protected-class audit.
```

Replace it with (append GC14 + GC15 after GC13):

```
- [ ] GC13 — analytics disclaimer: `node scripts/analyze-funnel.mjs
  ai-automation-specialist-hr`. Expect: valid JSON with funnel/reasonCodes/
  overrideRate/source; `fairnessSignals.disclaimer` present and states it is
  NOT a protected-class audit.
- [ ] GC14 — reference-check: `/talent-ops reference-check
  ai-automation-specialist-hr <a candidate with an unproven must-have, in
  interview/decision stage>`. Expect (GENERATE phase): refuses to generate
  until candidate consent is confirmed; once confirmed, questions target
  ONLY still-unproven must-have claims (each `Q | target | listen for`), no
  protected-attribute questions; reference-check.md written with
  `consent:` stamped, NO decision.md created. Then (RECORD phase) report a
  corroboration: the targeted claim becomes `status: human-confirmed` with
  a `reference ...recorded by human:<id>` note and its origin `source`
  preserved; a contradiction becomes `status: contradicted` + a risks note,
  never an auto-rejection.
- [ ] GC15 — onboarding: `/talent-ops onboarding ai-automation-specialist-hr
  <candidate>`. Before a hire: expect refusal ("record the hire decision
  first"). After recording `decision: hired`: expect onboarding.md with
  `status: draft`, 30/60/90 milestones mapped from the contract's first-90
  outcomes, evidence gaps framed as ramp support (not a deficiency verdict),
  Watch-fors drawn from the contract's failure scenario, and NO decision.md
  write.
```

- [ ] **Step 2: Verify the checks landed**

Run: `grep -nE "GC14|GC15" examples/golden-checks.md`
Expected: one match each for GC14 and GC15.

- [ ] **Step 3: Commit**

```bash
git add examples/golden-checks.md
git commit -m "test(post-decision): golden checks GC14 (reference-check) + GC15 (onboarding)"
```

---

### Task 6: End-to-end dry run + final regression

This task runs the two new modes against the demo role in the sandbox to confirm real behavior, then confirms no regression. Sandbox artifacts under `roles/` are gitignored — leave them uncommitted.

- [ ] **Step 1: Ensure the sandbox role exists**

If `roles/ai-automation-specialist-hr/` is not present, set it up from the fixtures:

```bash
cp -r examples/role-ai-automation-specialist-hr roles/ai-automation-specialist-hr
cp examples/inbox-samples/* data/inbox/ 2>/dev/null || true
```

Then, in the CLI, run `/talent-ops intake ai-automation-specialist-hr` and `/talent-ops batch ai-automation-specialist-hr` if no scored candidates exist yet. Expected: scored candidate dirs with `score.md` + `evidence.md`.

- [ ] **Step 2: Dry-run reference-check (GENERATE + consent gate)**

Pick a candidate that has at least one must-have still unproven (low confidence / ai-inferred). In the CLI:
`/talent-ops reference-check ai-automation-specialist-hr <candidate>`

Expected: the mode asks for consent first; if you decline, it refuses to generate. When you confirm consent and provide a reference, it writes `roles/ai-automation-specialist-hr/candidates/<candidate>/reference-check.md` with the `consent:` stamp, target claims limited to unproven must-haves, and `Q | target | listen for` questions. No `decision.md` is created or modified.

- [ ] **Step 3: Dry-run reference-check (RECORD)**

Fill the `Responses` section of that `reference-check.md` with a corroboration for one target claim, then re-run the same command (or report the outcome in chat).

Expected: that claim in `evidence.md` is now `status: human-confirmed` with a `reference ... recorded by human:<id>` note, and its original `source` is unchanged. `score.md` is NOT modified.

Run: `npm run verify`
Expected: `OK` (evidence edits are integrity-clean).

- [ ] **Step 4: Dry-run onboarding (gate + plan)**

First run before a hire decision:
`/talent-ops onboarding ai-automation-specialist-hr <candidate>`
Expected: refusal — "record the hire decision first".

Then record a hire (`/talent-ops decision ... <candidate>` with `decision: hired`, or hand-write a minimal `decision.md` with `decided_by: human:<id>`, `decision: hired`), and re-run onboarding.
Expected: `roles/.../candidates/<candidate>/onboarding.md` with `status: draft`, 30/60/90 milestones mapped from the contract's first-90 outcomes, evidence gaps framed as ramp support, and Watch-fors from the failure scenario.

- [ ] **Step 5: Final regression check**

Run: `npm run verify`
Expected: `OK`.

Run (Node 22 for the unit suite — the default shell is Node 16 here):
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npm test
```
Expected: the existing 103 tests still pass (no new tests added; this is a pure regression guard).

- [ ] **Step 6: No commit for sandbox artifacts**

Confirm `git status` shows no `roles/` or `data/` changes staged (they are gitignored). Only the Task 1–5 commits should be on the branch. Nothing to commit here.

---

## Self-Review

**Spec coverage:**
- §3 schema touch → Task 1. ✓
- §4 reference-check (gates, two phases, evidence-write semantics, file format, rules) → Task 2 (full file) + GC14 (Task 5) + e2e (Task 6). ✓
- §5 onboarding (post-hire gate, 30/60/90, ramp framing, file format, rules) → Task 3 (full file) + GC15 (Task 5) + e2e (Task 6). ✓
- §6 schema (enum + dir contents + data-contract lines) → Task 1 Steps 1-3. ✓
- §7 ethics (consent, current-employer, protected-attributes, development-aid-not-judgment) → embedded in the mode files (Task 2 gates/rules, Task 3 framing/rules) and asserted by GC14/GC15. ✓
- §8 testing (no new vitest; golden checks; e2e) → Task 5 + Task 6. ✓
- §9 docs (README table + sentence + mermaid; SKILL router/discovery) → Task 4. ✓
- §10 files-touched table → matches Tasks 1-5 exactly. ✓
- §11 sequencing (schema → reference-check → onboarding → docs → golden → e2e) → Task order 1-6. ✓

**Placeholder scan:** Mode-file bodies are complete; the `<...>` tokens inside the output-file templates are intentional fill-in markers for the LLM at runtime (same convention as the existing `outreach.md`/`scorecard.md` templates), not plan placeholders. No "TBD"/"implement later"/"add error handling" anywhere.

**Type/string consistency:** `source: reference` is identical across Task 1 (enum), Task 2 (recording rule + GC14), and the spec. `decision: hired` matches `states.yml` and the decision template. `consent: confirmed by human:<id> on <date>` is identical in Task 2 body, file format, and GC14. `status: human-confirmed` / `contradicted` match the existing evidence enum. Mode names (`reference-check`, `onboarding`) are spelled identically in README, SKILL routing/discovery/argument-hint, golden checks, and file paths.
