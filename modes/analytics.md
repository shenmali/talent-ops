# Mode: analytics

Purpose: turn the deterministic funnel script into a human-readable
hiring-pipeline report with actionable insights. The script computes; you
present and recommend.

Invocation: /talent-ops analytics [role-slug]

## Steps
1. Run the script and parse its JSON:
   ```bash
   node scripts/analyze-funnel.mjs <role-slug>   # omit slug for all roles
   ```
   Fields: `total`, `funnel` (count per stage), `reasonCodes`,
   `overrideRate` ({decided, overrides, ratePct}), `source` (per source:
   {total, qualified}), `timing` ({avgDaysToDecision}), `fairnessSignals`
   ({disclaimer, sourceQualificationRates, reasonConcentration}).
2. Present a readable report:
   - **Funnel:** counts per stage + where the biggest drop-off is.
   - **Reasons:** the reason-code distribution for terminal decisions.
   - **AI override:** the rate; if high (>~30%), note the scoring rubric in
     `modes/_shared.md` may need calibration.
   - **Sources:** qualification rate per source (which channel yields
     candidates that reach screened+).
   - **Speed:** average days to decision.
   - **Fairness signals:** ALWAYS print `fairnessSignals.disclaimer`
     verbatim first, then the proxy signals (source qualification disparity,
     reason-code concentration). NEVER frame these as a protected-class /
     adverse-impact audit — talent-ops has no protected-attribute data.
3. Give the top 3-5 actionable recommendations grounded in the numbers
   (e.g. "12 screened candidates await triage — run /talent-ops triage";
   "override 40% — review scoring weights"; "source X qualifies 0% — check
   that channel or its filters").
4. Write the report (atomic write): role-scoped to
   `roles/<role-slug>/analytics-<YYYY-MM-DD>.md`; for all-roles to
   `data/analytics-<YYYY-MM-DD>.md` (gitignored). Include the disclaimer.

## Rules
- The script is deterministic and calls no LLM; you only present + advise.
- The fairness disclaimer is mandatory in every output and every written
  report. Do not claim a protected-class audit.
