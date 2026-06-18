# Mode: batch

Purpose: screen every parsed candidate of a role in parallel.

Invocation: /talent-ops batch <role-slug>

## Preconditions
- Contract approved (`revised` = awaiting re-approval, refuse); at least
  one candidate at stage parsed.

## Steps
1. Collect candidates at stage parsed. Skip already-screened ones — this
   makes the run resumable after interruption.
2. Initialize or append data/batch-state.md:
   `| candidate | status (pending|running|done|failed) | updated_at |`
   On initialization, re-queue any existing `running` rows as `pending` —
   they are interrupted attempts from a previous run, not work in
   progress.
3. Process with up to 4 concurrent subagents. Each subagent prompt = full
   text of modes/_shared.md + modes/screen.md + role slug + candidate
   slug (subagents have filesystem access to the repo root and read the
   contract/profile themselves). Subagents produce the same files screen
   would — EXCEPT data/tracker.md and data/batch-state.md, which they
   MUST NOT touch.
4. As results land: the CONTROLLER (this orchestrating session, never a
   subagent) serializes updates to batch-state.md and the tracker (stage:
   screened, weighted_total, confidence, updated_at — per screen step 7),
   one write at a time. Concurrent read-modify-write on a shared file
   loses rows; serialization is the rule that prevents it.
5. Failures: mark failed in batch-state.md with a one-line reason; the
   candidate STAYS at parsed for retry. Never quarantine a parsed
   candidate for a screening failure.
6. Summary: done/failed counts, recommendation distribution (count per
   bucket), pointer to `/talent-ops triage <role>`.
