# Mode: outreach

Purpose: draft a personalized message from the recruiter TO the candidate.
Drafts only — talent-ops never sends. The human copies/sends manually.

Invocation: /talent-ops outreach <role-slug> <candidate-slug> [invite|reject|offer]

## Preconditions
- candidates/<slug>/profile.md exists (refuse: "run intake first").
- If type is omitted, infer from stage: interview -> invite, rejected ->
  reject, decision+`decision: offer` -> offer. If the requested type
  conflicts with the stage, warn and ask.
- `reject` requires a recorded rejection (decision.md); `offer` requires a
  recorded offer/hired decision. Refuse otherwise: "record the decision
  first" (outreach reflects a decision, it does not make one).

## Output file: candidates/<slug>/outreach.md
Chronological append. Each entry:

```
## <type> — <YYYY-MM-DD> · drafted_by: ai:<model> · status: draft
<message body>
```

Append a new entry (never overwrite prior drafts). Atomic write: read the
file (or start empty), append, write to `<file>.tmp`, rename. After the
human edits/approves, they change `status: draft` to `status: approved`.

## Tone
Read `config/company-profile.yml`: use `jd.tone` and `company.values`. Warm,
specific, human. No buzzwords. Default to the candidate's language if the
profile/CV signals one; otherwise English.

## Message types

### invite (interview invitation)
- Source: profile (name), score.md strengths, evidence.md strongest item.
- Structure (3 short paragraphs): (1) genuine, specific reason they stood
  out — cite a concrete strength/evidence item, not flattery; (2) what the
  next step is (which interview stage, what it covers, who runs it — from
  the role contract); (3) a clear, low-friction call to schedule.

### reject (respectful decline)
- Source: decision.md (`reason_code`, `reason_detail`), score.md.
- MUST stay consistent with the recorded `reason_code` — do not invent a
  different reason, do not over-explain, do not promise feedback you can't
  give. Respectful and brief. If the candidate is in talent memory
  (future_fit set), you may add one honest sentence inviting future contact.
- Never disclose other candidates or internal scores.

### offer
- Source: decision.md, `config/company-profile.yml` comp_bands.
- Structure: congratulations + role + the comp band (ONLY if present in
  config; never invent numbers — if absent, leave a clear placeholder and
  flag it) + next concrete step. This is a draft, not a binding offer;
  say final terms come in writing from a named human.

### followup-update (written by the followup mode, same format)
- A short, warm "your application is moving / here's the next step / thanks
  for your patience" note for a candidate who has been waiting. No new
  commitments; honest about timing.

## Rules
1. Drafts only — never send, never call an email/LinkedIn API.
2. outreach is NOT a decision: never write to decision.md, never stamp
   `decided_by`. The draft is `drafted_by: ai:<model>` and starts `draft`.
3. Reject drafts MUST match the recorded reason_code.
4. Never leak other candidates' data or internal scores into a message.
5. After writing, tell the user to run `npm run verify` (unaffected, but
   keeps the habit) and to review/approve the draft before sending.
