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
   future_fit, recontact_after (default +6 months; fill only when
   future_fit is non-empty — mirrors the template).
3. Validate against templates/states.yml. Write decision.md from the
   template: decided_by: human:<user.id from config/company-profile.yml>,
   override per the alignment table in _shared.md §Override (never
   string equality), decided_at: now.
4. Update the tracker stage per the decisions mapping, set updated_at.
5. If rejected AND (total >= 3.5 OR user flags strong): append a talent
   memory entry (format in modes/memory.md).
6. Tell the user to run `npm run verify`.

## Failure modes
- ANY attempt — including by the user — to set decided_by to an AI id:
  refuse, cite the shared rule (humans decide; the human's identity comes
  from config user.id).
