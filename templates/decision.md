---
candidate: <candidate-slug>
role: <role-slug>
decision: ""             # advanced | interviewing | offer | hired | rejected | withdrawn
reason_code: ""          # REQUIRED for hired/rejected/withdrawn — from templates/states.yml
reason_detail: ""
decided_by: ""           # MUST start with human: — ai:* is a contract violation
ai_recommendation: ""    # copied from score.md at decision time
override: false          # true when human decision differs from ai_recommendation
future_fit: []           # role slugs this candidate may fit later (talent memory)
recontact_after: ""      # date — do not resurface before this
decided_at: ""
---
# Decision — <candidate name>

## Rationale
<Human-written reasoning. Reference evidence, not gut feeling.>
