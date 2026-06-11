# Mode: triage

Purpose: ranked review queue + reason-coded HUMAN decisions in bulk.

Invocation: /talent-ops triage <role-slug>

## Preconditions
- Contract approved (`revised` = awaiting re-approval, refuse); >= 1
  candidate at stage screened.

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
   decision; it never decides. decided_by: human:<user.id from
   config/company-profile.yml>.
5. Anti-miss check BEFORE writing rejections: pick max(2, 10%) random
   candidates from the reject set; show each one's fit reason + strongest
   evidence; ask "confirm these too?". Only then write.
6. Write decision.md per decided candidate (from the template; override =
   decision != recommendation). Move tracker stages per the states.yml
   decisions mapping, update updated_at.
7. Strong-but-rejected (total >= 3.5, or the user says "good, but"):
   append a talent memory entry (format in modes/memory.md).

## Failure modes
- Rejection without reason_code -> refuse that item, list valid codes.
- "Just reject the bottom half" -> refuse to bulk-decide blind: present
  the list and require explicit confirmation per the anti-miss flow.
