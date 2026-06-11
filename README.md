# Talent-Ops

**Evidence-based hiring operating system for AI coding CLIs.**
The employer-side mirror of [career-ops](https://github.com/santifer/career-ops):
candidates got AI to choose companies — this gives hiring teams AI to
choose candidates *on evidence, not keywords*.

> Resume != Candidate. AI recommends, humans decide. Every decision has a
> reason code. Git history is your audit trail.

## What it does

| Command | What happens |
| ------- | ------------ |
| `/talent-ops define-role` | Calibration conversation -> approved Role Contract |
| `/talent-ops jd <role>` | Bias-checked job description from the contract |
| `/talent-ops intake <role>` | Parse CVs from `data/inbox/` into candidate files |
| `/talent-ops screen <role> <cand>` | Evidence ledger + 5-layer score for one candidate |
| `/talent-ops batch <role>` | Same as screen, all parsed candidates, in parallel |
| `/talent-ops triage <role>` | Ranked queue -> reason-coded human decisions |
| `/talent-ops interview-kit <role> <cand>` | Interview plan targeting evidence gaps |
| `/talent-ops decision <role> <cand>` | Decision packet -> recorded human decision |
| `/talent-ops tracker` / `memory` | Pipeline overview / rediscover past candidates |

## Quickstart (10 minutes, no real data needed)

```bash
git clone <this repo> && cd talent-ops && npm install
cp config/company-profile.example.yml config/company-profile.yml  # set user.id
cp -r examples/role-ai-automation-specialist-hr roles/ai-automation-specialist-hr
cp examples/inbox-samples/* data/inbox/
# then, in Claude Code (or any AGENTS.md-aware CLI):
#   /talent-ops intake ai-automation-specialist-hr
#   /talent-ops batch ai-automation-specialist-hr
#   /talent-ops triage ai-automation-specialist-hr
npm run verify   # integrity: human-only decisions, reason codes, tracker consistency
```

## Hard rules (enforced in the modes and by `npm run verify`)

1. No autonomous rejection — `decided_by` is always `human:*`.
2. Terminal decisions carry a `reason_code` from `templates/states.yml`.
3. Unparseable input -> `data/quarantine.md`, never silently dropped.
4. No scoring without an approved Role Contract.
5. Evidence is never fabricated — unverified claims stay `confidence: none`.

## Privacy & compliance

This template repo must stay free of real candidate data: run your hiring
in a **private** copy. `npm run forget -- <role> <candidate>` removes a
candidate (and warns that git history needs separate rewriting).
`npm run export-audit -- <role>` produces a per-role audit package
(weights, decisions, override rate, disclosure status). The generated JD
includes a candidate-facing AI-use disclosure by default.

**Not legal advice.** Talent-ops ships compliance-friendly defaults
(human-in-the-loop, reason codes, audit logs, disclosure) but does not
make you compliant by itself. Check your jurisdiction (EU AI Act, GDPR,
NYC LL144, ...).

## Testing

- `npm test` — deterministic script tests (vitest)
- `examples/golden-checks.md` — 10 LLM-behavior assertions to run in your CLI

Web board (local triage UI) ships separately — see the roadmap.
