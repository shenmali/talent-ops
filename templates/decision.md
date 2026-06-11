---
candidate: <candidate-slug>
role: <role-slug>
decision: ""             # advanced | interviewing | offer | hired | rejected | withdrawn
reason_code: ""          # terminal decisions only (hired/rejected/withdrawn); valid codes: templates/states.yml
reason_detail: ""
decided_by: ""           # MUST start with human: — ai:* is a contract violation
ai_recommendation: ""    # copied from score.md at decision time
override: false          # true when human decision differs from ai_recommendation
future_fit: []           # talent memory: fill for strong rejected/withdrawn candidates
recontact_after: ""      # ISO date — fill only when future_fit is non-empty
decided_at: ""
---
# Decision — <candidate name>

## Rationale
<Human-written reasoning. Reference evidence, not gut feeling.>
