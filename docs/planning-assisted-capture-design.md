# Planning: assisted capture of floor area, site area and use class

Draft, 25 September 2026. Nothing here is built.

## Why

Measured 25 September on the 10,206 unmerged high-relevance developments:

| Fact | Coverage |
| --- | --- |
| Use class (existing and proposed combined) | 77% (classifier); Plota `commercial_use_class` 71% |
| Floor area | 2.4% (Plota `floorspace_sqm`, and some of those values are wrong) |
| Floor area stated in the description | 3.7% |
| Site area stated in the description | 0.5% |

The figures we need are on the application form and in the officer report. Automated research
reaches documents at about 5% of councils (74% of tier applications are blocked by robots.txt,
mostly Idox). This workflow gets them from the other 95% by having a person do the lookup, as any
member of the public would, and letting the machine do the reading and recording.

## The boundary

robots.txt and bot checks govern automated collection. They do not govern a person using a
portal. The workflow stays on the right side of that line only if all of these hold:

- **A person starts every lookup.** One record at a time, opened by a named admin user. Nothing
  queues, schedules or loops lookups without a person on each one.
- **The person does the retrieval.** They open the portal in their own browser and download or
  view the document themselves. Our servers never fetch a portal URL for this workflow.
- **No bot checks are passed by anything other than the person.** If a portal shows a CAPTCHA or
  "are you human" check, the person deals with it or skips the record.
- **Pace is the person's pace.** No batching or tabs opened in bulk.

Claude in Chrome may help the person at their own screen (finding the form among the documents,
reading it). It must not be driven through a list of records unattended; that is a crawler and is
out of scope.

## Which records

A new capture queue, separate from the existing completion queue. The completion queue
(`/api/admin/planning/facts`) only lists schemes whose research has finished, and research never
runs on blocked councils, so it would never show most of the records that need capturing.

Selection:
1. Development is unmerged, `relevance = high` and creates commercial space (the escalation gate).
2. At least one of `proposed_floorspace`, `site_area`, `proposed_use_class` is not `found` and
   has no admin decision.
3. The council's access label is not "documents readable" (those go to automated research first).

Order, highest first: developments watched in a Planning Monitor patch or matched to a customer's
brand requirement; then by stage (approved and pending ahead of withdrawn/refused); then newest.
Condition and amendment records are captured on the family's principal application, not their own.

## The workflow, per record

1. **Claim.** The researcher opens the next record in `/admin/planning/capture`. It is leased to
   them for 20 minutes so two people don't do the same one.
2. **Open the portal.** The page shows the reference, council, description, current facts and the
   council link, and opens the portal in a new tab.
3. **Find the source.** In priority order: the application form (standard 1APP), the officer or
   committee report, the design and access statement, the plans. The page tells them what is
   still missing so they stop once it's complete.
4. **Hand it over.** Either:
   - **Drop the PDF** onto the capture page (the default); or
   - **Paste text** copied from the page or document (for HTML portals and reports), with the URL
     it came from.
   The researcher always enters the portal URL of the document, which becomes the evidence link.
5. **Extract.** The server reads the file and proposes findings (below). Nothing is saved yet.
6. **Confirm.** Each proposed finding is shown with its excerpt and page. The researcher accepts,
   corrects or rejects each one, and can add a value by hand. Unanswered facts can be marked
   "not in the documents" or "documents not available".
7. **Save.** Accepted findings are written to `development_facts`; the lease is released. Target
   time: under two minutes per record, measured (see Pilot).

A "skip" button with a reason (portal down, bot check, no documents published) releases the
record and records the reason, so repeated failures at one council show up.

## Extraction

Reuse what exists; don't build a second reader.

- **Text.** The PDF goes through the same extraction as research (`pdfText` in
  `research-sources.ts`, with `[PDF page n]` markers), and scanned PDFs through the bounded OCR
  pass. That needs `pdfText` and the OCR call exported and callable on uploaded bytes.
- **Standard form, deterministic first.** `standardFormFloorspace` in `research-form-facts.ts`
  already reads the labelled totals in the non-residential floorspace table (existing, lost,
  proposed, net, GIA, whole development). Run it first; its findings need no model.
- **Model pass for everything else.** The same research model call and `findingsFromResearch`,
  given the uploaded text as the only source, with web search off. It covers use classes, site
  area, report text and non-standard forms.
- **Existing rules apply unchanged.** Extent and basis rules in `facts.ts` (a unit or phase figure
  never completes a whole-development fact), `derivedNetFinding`, conflict detection.

Findings carry `source.kind = 'document'` or `'council_page'`, the researcher's portal URL, the
excerpt and page, and a new `origin: 'capture'`, so they are distinguishable from unattended
research and from facts an admin typed. Accepting a finding records the researcher as the decider,
in the same way an admin decision does today.

## Storage and privacy

- **Don't keep the file.** Store the excerpts and page numbers only. Forms contain private
  applicants' names and home addresses (a known defect in the current reader), and keeping council
  documents adds copyright and data-retention questions we don't need.
- Uploads are processed in memory and discarded, with a size cap (25 MB) and PDF/text types only.
- Excerpts stay admin-only, as today. Published values show the source as "stated in the
  application form" or "stated in the officer report", with no excerpt.

## What the published figure means

Form figures are what the applicant stated. The Datahub evaluation showed these are wrong often
enough (7 of 30 contradicted the proposal) that "verified" is not a claim we can make. Captured
values are published as **stated in the application** with the document named, and the officer
report wins where both are captured and disagree, since the officer has checked it. This needs the
user's agreement before anything is published (open question 1).

## What is new

| Piece | Notes |
| --- | --- |
| `/admin/planning/capture` page | Queue, claim, upload/paste, confirm. Built alongside the completion page, reusing its fact cards. |
| `/api/admin/planning/capture` routes | `GET` next record, `POST` claim/release, `POST` extract (returns proposals, writes nothing), `POST` save. Admin only. |
| Migration | Lease columns (`capture_claimed_by`, `capture_claimed_at`), `capture_skips` log, `'capture'` allowed as a finding origin. |
| Exports | `pdfText` and the OCR call callable on uploaded bytes; the research model call callable with given sources and no web search. |
| Tests | Extraction on fixture forms (the pilot's Crawley forms), lease expiry, save idempotency, rejection of unsupported uploads. |

No Plota requests. Model cost per record is one research-model call, and none when the standard
form covers everything.

## Pilot before building the queue at scale

1. Build the upload/extract/confirm page only, without the queue; pick records by hand.
2. Rob and one other person capture 50 records across at least 10 councils, including
   Idox, Arcus and a Welsh or Scottish council.
3. Measure: minutes per record; share where each fact was found; share of records where no
   document had it; how often the researcher corrected the extraction.
4. Check 15 of them a second time, blind, for agreement.

The pilot decides the rest. The escalated set is 10,163 unmerged developments (live count,
25 September; about 95% at councils without readable documents). At two minutes a record that is
about 320 hours as a backlog, plus the weekly inflow, so the backlog must be worked in priority
order (watched and matched first) rather than end to end. INSPIRE site areas and VOA/EPC existing
floor areas shrink it further.

## Open questions for the user

1. May we publish figures labelled "stated in the application form"? (This also decides whether
   the London Datahub figures can be switched on under the same label.)
2. Who captures: internal staff, a contracted researcher, or customers themselves on records
   they care about?
3. Does the product need exact square metres, or a size band? A band lets an estimate stand in
   where capture hasn't reached yet.
4. Is Claude in Chrome part of the researcher's standard kit (it's on Rob's machine), and on what
   plan?

## Out of scope

- Any server-side or unattended fetch from a council portal that disallows it.
- Passing bot checks or CAPTCHAs by anything other than the researcher.
- Site area from INSPIRE polygons, and existing floor area from VOA and EPC data. These are
  separate, automatic sources that fill the same facts and reduce what needs capturing; they are
  worth doing first or in parallel.
