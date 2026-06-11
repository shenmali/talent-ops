# Mode: interview-kit

Purpose: a structured interview plan targeting THIS candidate's evidence
gaps — not a generic question list.

Invocation: /talent-ops interview-kit <role-slug> <candidate-slug>

## Preconditions
- Contract approved (`revised` = awaiting re-approval, refuse); score.md
  exists (refuse: "screen first").

## Steps
1. Read: contract interview stages, score.md missing_evidence + risks,
   evidence.md claims with confidence below high.
2. For each contract stage generate 3-6 questions. EVERY question maps to
   a target — a claim to verify or a 90-day outcome capability. Format:
   `Q: <question> | target: <claim/outcome> | listen for: <what a strong
   vs weak answer sounds like>`
3. Forbidden: brainteasers, culture-fit vibe questions, and any question
   touching protected attributes (age, family plans, origin, health,
   beliefs).
4. Write candidates/<slug>/interview/<stage>-plan.md (frontmatter:
   generated_by: ai:<model>, generated_at) and one scorecard per stage at
   candidates/<slug>/interview/<stage>-scorecard.md from
   templates/scorecard.md (dimensions = the targets).
5. Point the user to the files; completed scorecards feed the decision
   packet.
