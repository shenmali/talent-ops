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
   Do not filter inbox files by apparent role fit — the user pre-stages
   data/inbox/ before each run. If a file clearly names a different
   role, still process it and note the mismatch in the run summary (the
   human decides at triage).
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
      CSV exception: never move the shared CSV per candidate. Write the
      candidate's OWN row (plus header) to source/row.csv and set
      source: csv:<original-filename> in profile.md — other applicants'
      rows must not enter this candidate's dir (forget.mjs deletes per
      candidate). After ALL rows are processed, move the original CSV to
      data/inbox/processed/.
   f. Hard-filter precheck vs contract.hard_filters -> write
      hard_filter_precheck: pass | fail(<filter>) into profile
      frontmatter. A fail does NOT stop processing or trigger any
      decision.
   g. Append tracker row, stage: parsed. If data/tracker.md does not
      exist, create it first with the literal header
      `| candidate | role | stage | weighted_total | confidence | updated_at | note |`
      and a `| --- | --- | --- | --- | --- | --- | --- |` separator row.
      Row format: `| <slug> | <role-slug> | parsed | - | - | <ISO date> | |`
      (`-` = not yet scored).
3. Summary: created N, quarantined M (with reasons), duplicates K.

## Failure modes
- No extractable identity -> quarantine, reason "no identity".
- CSV missing required headers -> quarantine the file, name the headers.
- Non-English CV: process normally (extract what you can); add
  `languages` and a note; flag low extraction confidence in profile body.
