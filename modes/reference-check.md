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
