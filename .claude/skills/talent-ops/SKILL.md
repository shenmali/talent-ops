---
name: talent-ops
description: Evidence-based hiring command center — define roles, generate JDs, screen applications, triage with reason-coded decisions
user_invocable: true
argument-hint: "[define-role | jd | intake | screen | batch | triage | interview-kit | decision | tracker | memory]"
---

# talent-ops — Router

## Mode routing

Determine the mode from the first argument:

| Input | Mode |
|-------|------|
| (empty) | discovery — show the menu below |
| `define-role` | define-role |
| `jd <role-slug>` | jd |
| `intake <role-slug>` | intake |
| `screen <role-slug> <candidate-slug>` | screen |
| `batch <role-slug>` | batch |
| `triage <role-slug>` | triage |
| `interview-kit <role-slug> <candidate-slug>` | interview-kit |
| `decision <role-slug> <candidate-slug>` | decision |
| `tracker` | tracker |
| `memory [role-slug]` | memory |

Unknown input that looks like a hiring need ("we need a senior X") =>
suggest `define-role`. Anything else => discovery.

## Discovery menu

```
talent-ops — Hiring Command Center

  /talent-ops define-role            -> Role intake conversation -> approved Role Contract
  /talent-ops jd <role>              -> Bias-checked job description from the contract
  /talent-ops intake <role>          -> Parse CVs from data/inbox/ into candidate files
  /talent-ops screen <role> <cand>   -> Evidence ledger + 5-layer score for one candidate
  /talent-ops batch <role>           -> Screen all parsed candidates in parallel
  /talent-ops triage <role>          -> Ranked queue + reason-coded human decisions
  /talent-ops interview-kit <role> <cand> -> Structured interview plan from evidence gaps
  /talent-ops decision <role> <cand> -> Decision packet + recorded human decision
  /talent-ops tracker                -> Pipeline overview + SLA warnings
  /talent-ops memory [role]          -> Talent memory: rediscover strong past candidates

Flow: define-role -> jd -> (publish) -> intake -> batch -> triage ->
interview-kit -> decision. Integrity: npm run verify
```

## Context loading

- Modes requiring `modes/_shared.md` + their own file: define-role, jd,
  intake, screen, batch, triage, interview-kit, decision.
- Standalone (own file only): tracker, memory.
- `batch` delegates per-candidate work to subagents, injecting the content
  of `_shared.md` + `screen.md` into each subagent prompt.

Read the required files, then execute the mode file's instructions.

## Non-negotiable rules (apply in every mode)

1. Never write `decided_by: ai:*` in any decision.md.
2. Terminal decisions need a reason_code from templates/states.yml.
3. Unparseable input -> data/quarantine.md, never silently skipped.
4. Contract not `approved` -> refuse dependent modes, name what's missing.
