# Mode: tracker

Purpose: pipeline overview + SLA warnings. data/tracker.md is a derived
cache — candidate files are the truth; this mode rebuilds the cache.

Invocation: /talent-ops tracker

## Steps
1. Walk roles/*/candidates/*. Derive each candidate's stage from files
   present and their frontmatter (decision.md > score.md > profile.md).
2. Rebuild data/tracker.md from scratch (atomic write: .tmp then rename),
   using the literal header from _shared.md
   (`| candidate | role | stage | weighted_total | confidence | updated_at | note |`).
   Report diffs against the previous version ("3 rows were stale").
3. Show: per-role counts by stage; SLA flags — triage > 5 days,
   interview > 10 days (from updated_at); quarantine row count;
   candidates scored but undecided after 14 days.
4. Suggest next actions per role ("12 screened candidates await triage").
