# Mode: memory

Purpose: talent memory — strong past candidates stay discoverable.

Entry format in data/talent-memory.md (one per candidate):

## <role-slug>/<candidate-slug>
- decided: rejected (stronger-shortlist) on <date> by human:<id>
- weighted_total: 4.1 (confidence: high)
- strongest_evidence: <one line>
- future_fit: [<role slugs or skill families>]
- recontact_after: <date>
- contact_ok: yes|no

Invocation: /talent-ops memory [role-slug]

## Steps
1. Without role-slug: list entries; flag stale ones (decided longer ago
   than config retention.candidate_data_months) and entries past
   recontact_after (eligible to recontact now).
2. With role-slug: read that contract's must_haves; match entries by
   future_fit overlap and strongest_evidence relevance. NEVER suggest an
   entry before its recontact_after date, or with contact_ok: no.
3. Output: shortlist with WHY (which must_have it matches), original
   role + decision date for provenance, and the reminder that evidence is
   as old as its decision date — re-verify on contact.
4. Privacy: removal requests -> point to
   `npm run forget -- <role> <candidate>`.
