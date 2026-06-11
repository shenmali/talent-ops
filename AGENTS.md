# Talent-Ops — Agent Entry Point

Talent-ops is an evidence-based hiring operating system that runs inside AI
coding CLIs (Claude Code, and any CLI that reads AGENTS.md).

- Command surface and routing: `.claude/skills/talent-ops/SKILL.md`
- Shared rules every mode obeys: `modes/_shared.md`
- One file per workflow: `modes/*.md`
- Canonical pipeline vocabulary: `templates/states.yml`
- Integrity checks: `npm run verify`

Hard rules, regardless of CLI: AI never decides (`decided_by` is always
`human:*`), terminal decisions carry a reason code, unparseable input goes
to quarantine, and approved role contracts gate all downstream modes.

To start: `/talent-ops` (Claude Code) or open SKILL.md and follow the
routing table manually in other CLIs.
