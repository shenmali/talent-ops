# Mode: followup

Purpose: surface candidates who have been waiting past cadence, and (on
request) draft a warm "your application is moving" update. The script
decides nothing — it flags timing; the human acts.

Invocation: /talent-ops followup [role-slug]

## Steps
1. Run the cadence script and read its output:
   ```bash
   npm run followup
   ```
   It lists, sorted by urgency (overdue > due > waiting): each waiting
   candidate with role/slug, what they're waiting for (triage / decision /
   candidate-response), days waiting, and the threshold. Thresholds come
   from `config/company-profile.yml` `cadence:` (defaults 5/7/5).
2. Present a dashboard table:
   ```
   Follow-up — {date}   ({N} waiting)
   | urgency | candidate | role | awaiting | days | threshold |
   ```
   Use indicators: overdue (act now), due (today), waiting (on track).
   If role-slug was given, filter to that role.
3. If the user asks to draft an update for a candidate, switch to the
   outreach `followup-update` type (see modes/outreach.md): append a short,
   warm, honest "still moving / next step / thanks for your patience" note
   to `candidates/<slug>/outreach.md`. No new commitments. Draft only.

## Rules
- The script never writes and never decides — it only reads + computes.
- A "decision" candidate is only a followup when `decision: offer`
  (awaiting the candidate's response); other terminal stages are not
  followups.
- Drafts go through the outreach format (drafted_by: ai:<model>, status:
  draft) — never sent.
