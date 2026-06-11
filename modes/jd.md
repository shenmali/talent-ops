# Mode: jd

Purpose: generate a bias-checked, requirement-disciplined job description
from an APPROVED role contract.

Invocation: /talent-ops jd <role-slug>

## Preconditions
- roles/<role-slug>/role-contract.md with status: approved. Refuse
  otherwise, naming the missing approval. (`revised` means awaiting
  re-approval — refuse it too; the define-role re-approval gate returns
  the status to `approved`.)
- config/company-profile.yml (fall back to the example file, and say so).

## Steps
1. Read contract + company profile.
2. Draft `roles/<role-slug>/jd.md` with frontmatter (role, generated_by:
   ai:<model>, generated_at, source_contract_status) and sections:
   - **About the role** — from business need; no company hype.
   - **What you will do** — from first-90-days outcomes, verb-first.
   - **What we need** — ONLY contract must_haves, phrased as evidence
     ("production experience with X", not "knowledge of X").
   - **Nice to have** — contract nice_to_have only; if the list is
     empty, omit the section entirely (never invent items).
   - **Compensation & process** — band if jd.include_comp_band (when
     false, omit the band line, keep the process); the contract's
     interview stages, honestly described.
   - **AI disclosure** — copy templates/disclosure.md verbatim when
     disclosure.include_default_block (keep the HTML markers).
3. Requirement discipline check: diff every requirement line against the
   contract. Anything not in the contract -> remove and report the
   removal.
4. Bias pass — scan and replace each hit with a neutral, role-specific
   descriptor (e.g. rockstar/ninja/guru -> "experienced <skill>
   practitioner"); never substitute another power-coded superlative
   ("elite", "top-tier"). LIST every replacement as original ->
   replacement:
   rockstar, ninja, guru, wizard, superhero, dominate, aggressive,
   fearless, young, energetic, digital native, recent graduate (unless a
   legal requirement), culture fit (-> "culture add"), manpower, chairman,
   salesman, he/his as default pronoun, "work hard play hard".
   Flag (don't auto-replace): unexplained "fast-paced", stacked
   superlatives — append these as a "Review notes" subsection after the
   bias-pass summary.
5. Append a **LinkedIn variant** section: <= 2600 characters,
   compressed, disclosure included (the disclosure may be condensed for
   the variant but MUST keep the HTML markers). If the variant still
   exceeds 2600 characters, report the character count and ask the human
   to trim — never silently drop requirements.
6. Save atomically (write `jd.md.tmp`, rename); tell the user to run
   `npm run verify`.

## Failure modes
- Comp band missing while include_comp_band: true -> ask; never invent
  numbers.
- roles/<role-slug>/jd.md already exists -> warn, show the existing
  generated_at, and get explicit confirmation before overwriting.
