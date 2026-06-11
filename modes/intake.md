# Mode: intake

Purpose: turn raw applications in data/inbox/ into normalized candidate
files for ONE role.

Invocation: /talent-ops intake <role-slug>

## Preconditions
- The role's contract file exists (any status — intake may run while
  approval is pending; screening may not).

## Steps
1. List data/inbox/*. Supported: .pdf .docx .txt .md (one candidate per
   file); .csv (one candidate per row; required headers: name, email,
   location, cv_text; optional: links).
2. For each item:
   a. Read content. Unreadable/empty -> append to data/quarantine.md
      (`| file | reason | date |`) and CONTINUE. Never delete originals.
   b. Extract: name, email, location, links[], years_experience,
      last_roles[] (max 3), languages[].
   c. Slug = kebab-case full name; if the slug exists for a DIFFERENT
      person, append -2.
   d. Duplicate check BEFORE creating: same normalized (lowercased)
      email OR same slug within this role -> do not create; record a
      merge suggestion in the run summary; leave the file in inbox.
   e. Create roles/<role>/candidates/<slug>/, MOVE the original into
      source/, write profile.md (frontmatter per _shared data contract,
      parsed_by: ai:<model>; body: structured CV summary).
   f. Hard-filter precheck vs contract.hard_filters -> write
      hard_filter_precheck: pass | fail(<filter>) into profile
      frontmatter. A fail does NOT stop processing or trigger any
      decision.
   g. Append tracker row, stage: parsed.
3. Summary: created N, quarantined M (with reasons), duplicates K.

## Failure modes
- No extractable identity -> quarantine, reason "no identity".
- CSV missing required headers -> quarantine the file, name the headers.
- Non-English CV: process normally (extract what you can); add
  `languages` and a note; flag low extraction confidence in profile body.
