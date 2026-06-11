# Mode: tracker

Purpose: pipeline overview + SLA warnings. data/tracker.md is a derived
cache — candidate files are the truth; this mode rebuilds the cache.

Invocation: /talent-ops tracker

## Steps
1. Walk roles/*/candidates/*. Derive each candidate's stage from files
   present and their frontmatter (decision.md > score.md > profile.md;
   a decision maps to its stage via the states.yml decisions table).
   Derive updated_at from the newest of decided_at (decision.md),
   scored_at (score.md), applied_at (profile.md) — NEVER the rebuild
   timestamp, or SLA flags go silent.
2. Rebuild data/tracker.md from scratch (atomic write: .tmp then rename),
   using the literal header from _shared.md
   (`| candidate | role | stage | weighted_total | confidence | updated_at | note |`).
   Report diffs against the previous version ("3 rows were stale").
3. Show: per-role counts by stage; SLA flags — screened (awaiting
   triage) > 5 days, interview > 10 days (from the derived updated_at);
   quarantine row count; candidates scored but undecided after 14 days.
   (No file marks a separate `triage` stage — screened IS the
   awaiting-triage state.)
4. Suggest next actions per role ("12 screened candidates await triage").
