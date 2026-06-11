---
role: <role-slug>
title: "<Job Title>"
status: draft            # draft -> approved -> revised. Modes refuse to run on non-approved contracts.
approved_by: ""          # human:<name> — set only on explicit approval
approved_date: ""
location: "<city / remote policy>"
employment_type: full-time
comp_band: "<min-max currency, or 'see company profile'>"
hard_filters:            # pass/fail checks. Failing candidates still need a HUMAN decision.
  work_permit: "<e.g. EU>"
  language: "<e.g. English C1>"
scoring_weights:         # must sum to 1.0
  skill_match: 0.30
  experience_match: 0.20
  evidence_match: 0.30
  behavior_signals: 0.20
must_have:               # every entry needs evidence_required
  - skill: "<skill>"
    evidence_required: "repo | production-story | certification | portfolio"
nice_to_have: []
disqualifiers: []        # factual only, e.g. "no cloud experience at all"
---
# Role Contract: <Job Title>

## Business need
<Why are we hiring? Link to a business goal, not a vacancy.>

## First-90-days outcomes
1. <Concrete, verifiable outcome>
2. <Concrete, verifiable outcome>
3. <Concrete, verifiable outcome>

## Failure scenario
<How would this hire fail within 90 days? What would we observe?>

## Interview stages
1. <Stage name — what it verifies, who runs it>
2. <Stage name — what it verifies, who runs it>

## Criteria drift log
<!-- Every expectation change after approval is appended here. No silent drift. -->
| date | changed_by | change | re-approved_by |
| ---- | ---------- | ------ | -------------- |
