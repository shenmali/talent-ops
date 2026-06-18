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
