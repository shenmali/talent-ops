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
