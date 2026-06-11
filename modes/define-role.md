# Mode: define-role

Purpose: turn a vague hiring need into an approved Role Contract through a
calibration conversation with the hiring manager (the user).

## Preconditions
- None (entry point). If a contract already exists for this role, load it
  and switch to revision mode: changes append to the Criteria drift log.

## Steps
1. Ask ONE question at a time. Required set:
   a. Job title and business need — what is the official job title, and
      why does this role exist? Which business goal? Derive the role slug
      (lowercase kebab-case from the title) and confirm it with the HM:
      "Slug will be `ai-automation-specialist-hr` — correct?"
   b. First-90-days outcomes — 2-4 concrete, verifiable outcomes.
   c. Failure scenario — "How would this hire fail in 90 days?"
   d. Must-haves — for EACH, immediately ask "what evidence would prove
      it?" (repo | production-story | certification | portfolio). A
      must-have with no provable evidence is a preference: move it to
      nice_to_have and say why.
   e. "Which of these can be trained in 90 days?" — trained ones move to
      nice_to_have.
   f. Location and employment type — where is the role based, what is
      the remote policy? Confirm employment_type explicitly (default
      full-time — state the assumption if the HM does not specify).
      These fill the top-level `location` and `employment_type` fields.
   f2. Hard filters (pass/fail gates): work permit, language, any other
      factual gate — these go under `hard_filters`. Disqualifiers
      (factual only) → top-level `disqualifiers`; comp band →
      `comp_band`.
   g. Interview stages — what each verifies, who runs it.
   h. Scoring weights — propose defaults (0.30 / 0.20 / 0.30 / 0.20), let
      the HM adjust, validate sum = 1.0. If one weight changes, show the
      full redistributed set and get confirmation before writing.
2. Challenge vague answers exactly once: "senior" -> "what does senior
   mean here, in outcomes?". More than 5 must-haves -> "which 3 are truly
   blocking?" After one challenge, accept the HM's call — do not
   re-challenge.
3. Write `roles/<role-slug>/role-contract.md` from
   `templates/role-contract.md`, status: draft, every section filled,
   drift log table header-only (no data rows).
4. Show a compact summary — slug, title, location, must-haves
   (bulleted), hard filters, comp band, weights, interview stages; omit
   narrative sections — and ask for explicit approval.
5. ONLY on explicit approval: status: approved, approved_by:
   human:<user.id from config/company-profile.yml>, approved_date: today.
   Otherwise stay draft and list exactly which sections block approval.

## Outputs
- roles/<role-slug>/role-contract.md (draft or approved)

## Failure modes
- "I don't know" on outcomes: park as draft, name the blocking sections.
  Never invent outcomes.
- Post-approval changes: append drift log row (date, changed_by, change,
  re-approved_by), set status: revised until explicitly re-approved.
  Re-approval uses the same gate as step 5: compact summary → explicit
  approval → status: approved, re-approved_by: human:<user.id>, update
  approved_date.
