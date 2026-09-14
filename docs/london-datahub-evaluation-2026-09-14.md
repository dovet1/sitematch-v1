# London Datahub: 40-record evaluation

The lookup is useful as evidence, but **does not pass the gate for automatic fact completion**.
Seven of the 30 records offering floor figures contradict the work described in the application.
More have unresolved scope or source inconsistencies. No live records were changed.

## What was checked

The existing adapter and fact resolver were frozen before reviewing outputs. A seeded selection
chose 40 previously unseen records from a pool of 175 recent public records with commercial-class
rows: 30 offering at least one completing floor fact, and 10 offering none, across 21 boroughs.
All IDs in Claude's 406-record report and existing fixture were excluded. Up to three records per
borough were allowed in each stratum. The date window was 1 August–14 September 2026.

This deliberately tests candidate figures. It is not a random sample of our eligible developments,
does not measure match rate, and cannot be extrapolated to national coverage or overall accuracy.
The first search returned no candidates because it used a non-nested existence query; it produced
no reviewed sample. The corrected search produced the frozen sample before manual labelling.

All 40 descriptions and detailed rows were read. Labels distinguish contradictions, values needing
clarification, and values that remain unverified. **Not finding a contradiction is not verification.**
These are manual Codex review labels; there is no claim of an independent second reviewer.

Frozen inputs, predictions, hashes, methodology and all labels:
`apps/web/src/lib/planning-intelligence/__tests__/fixtures/london-datahub-blind-2026-09-14.json`.
Original source snapshots remain locally in `apps/web/reports/london-blind-2026-09-14-v2/`.

## Results by fact

Each row counts records where the frozen adapter would complete that fact. A single scheme may
appear in multiple rows. Unverified values must not be reported as correct.

| Fact | Would complete | Contradicts description | Needs clarification | Still unverified |
| --- | ---: | ---: | ---: | ---: |
| Existing floor area | 29 | 1 | 2 | 26 |
| Proposed floor area | 28 | 6 | 5 | 17 |
| Net commercial change | 29 | 7 | 5 | 17 |
| Site area | 38 | 0 | 1 | 37 |
| Existing use class | 30 | 0 | 3 | 27 |
| Proposed use class | 32 | 4 | 2 | 26 |

Some descriptions corroborate broad use classes or the direction of change. They do not validate
the finer subclass, measurement basis, building extent or numerical amount. The table therefore
keeps such outputs in the unverified column. Contradictions concern the scope stated in the
description; they do not establish a replacement numerical value.

Examples:

- **Haringey HGY/2026/2303:** a new C3 flat becomes 64 m² of commercial gain, classified E(c)(ii).
- **Ealing 262975FUL:** storage demolished for flats becomes 193.5 m² of proposed storage space.
- **Lewisham DC/26/145319:** shopfront/signage works on an already amalgamated unit double its
  area from 105 to 210 m² because the existing total is also entered as a gain.
- **Haringey HGY/2026/2465:** a dropped kerb and elevation works double 350 to 700 m².
- **Newham 26/01694/FUL:** replacement classrooms have zero existing/lost area despite removal
  of three classrooms, making the calculated net change unreliable.
- **Tower Hamlets PA/26/01376/NC:** a recorded loss exceeds the existing area. The adapter
  withholds the existing figure but still publishes the inconsistent loss as the net change.
- **Hackney 2026/1430:** an extension's area may be labelled as the whole development's area.

There are also missed opportunities: the blanket Sui Generis guard withholds the proposed hotel
area for Tower Hamlets PA/26/01452/A1. Fixing one false-positive rule can reduce useful coverage.

## Independent source checks

The public council collector was run for eight fixed examples: five apparent failures and three
plausible commercial schemes. It obeyed robots.txt and made no AI calls.

- Two Haringey URLs returned script shells, with no application content.
- Hammersmith & Fulham returned HTTP 500.
- Ealing and Southwark records did not supply a usable council URL.
- Lewisham and Kingston disallowed collection in robots.txt.
- Havering returned the matching application description and a document-list shell, but no PDF
  or numerical evidence. Its page corroborated the broad C3-to-E conversion, not 26 m².

Consequently **no numerical output was independently verified** by those checks. The current
collector's inability to retrieve a form does not prove the form is unavailable to a person.
Raw page snapshots are local only; they contain applicant details and are not committed.

## Decision and code changes

`findingsFromDatahub` now returns every value as review evidence with `completes: false`.
The prior calculations are explicitly named `candidateFindingsFromDatahub` and are for offline
evaluation, not writing directly to the checklist. A regression test checks the publication gate.
The research worker is **not connected** to the Datahub. No new admin backlog has been created.

Do not pass these numbers to a model as established facts: that could simply reproduce the same
bad figure with a new research source label. A future integration needs independent evidence
before completing a fact, including application/version, use, scope and measurement basis.

The next useful step is the Plota capability question, now drafted separately. Continue the small
commercial-agent pilot with sourced facts already available. Avoid another national portal build
or another round of special-case rules solely to make this sample pass. If the source improves,
test the revised system on a new unseen sample; preserve these failed predictions as a baseline.

Validation: all 359 planning tests pass (21 suites), the full TypeScript check passes, and
`git diff --check` passes. No Plota requests, external model
calls, live database writes, migrations, budget changes or worker deployments were made.
