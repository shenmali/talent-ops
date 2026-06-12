# Board Behavior Checks

Run against a populated repo (e.g. after the CLI golden-checks run).

```bash
npm run board   # http://localhost:4319
```

- [ ] BC1 — Pipeline: every candidate appears in the column matching its
  derived stage; cards show score+confidence, recommendation, missing
  count, source, and an SLA-colored day count.
- [ ] BC2 — Candidate page: evidence ledger table, 5-layer score
  breakdown, and decision section all render; write forms carry a
  `sinceToken` hidden input.
- [ ] BC3 — Record a decision (e.g. advanced): decision.md gains
  `decided_by: human:<your id>`, correct `override`, and the pipeline
  reflects the new stage. `npm run verify` → OK.
- [ ] BC4 — Reject without a reason code: the form's empty reason option
  is refused; the page returns with `?error=reason-required`.
- [ ] BC5 — Change stage to a non-terminal stage (screened→triage): the
  card moves; attempting a terminal stage is not offered in the dropdown.
- [ ] BC6 — Mark an evidence claim human-confirmed / contradicted: the
  ledger status updates and is color-coded.
- [ ] BC7 — Add a note: it appears under `## Notes` in profile.md, stamped
  with date + `human:<id>`.
- [ ] BC8 — Conflict: open a candidate, edit its decision.md by hand
  (e.g. via the CLI), then submit the board form → redirected with
  `?error=conflict`, board write refused, your hand edit intact.
- [ ] BC9 — Live refresh: with the board open, run a CLI mode that writes
  a file (or `npm run forget`); the open page reloads within ~1s.
- [ ] BC10 — Disclosure/identity: the top bar shows `human:<id>`; no view
  offers any way to record an AI decision.
- [ ] BC11 — Triage bulk reject: select two screened candidates, pick a
  reason code, tick the anti-miss box, submit → both gain a human-stamped
  rejected decision.md; submitting without the anti-miss box is refused
  with `?error=anti-miss-unconfirmed`.
