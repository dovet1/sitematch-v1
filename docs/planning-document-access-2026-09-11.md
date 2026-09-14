# Planning document access — 11 September 2026

A read-only sample of 20 high-relevance stored developments (ordered by UUID, not a
nationally representative sample) initially retrieved no PDFs. Twelve application pages
were disallowed by robots.txt, one had a connection failure, and seven HTTP pages loaded.
Three of the seven were actually unsupported-browser notices, not application records.

## Verified recovery: Crawley CR/2026/0416/FUL

**107 High Street, Northgate, Crawley.** The collector now retrieves the application form
and planning statement through the portal's normal public disclaimer session. No AI,
Plota requests, or database writes were used for this audit.

| Field | Verified evidence |
| --- | --- |
| Existing use | Nightclub (sui generis) and restaurant (Class E) |
| Proposed use | Offices (Class E) |
| Existing gross internal floor area | 347 m², approximately 3,735 sq ft |
| Proposed gross internal floor area | 347 m², approximately 3,735 sq ft |
| Net additional floor area | 0 m² |
| Site area | 631 m², approximately 6,792 sq ft; no separate before/after site areas stated |
| Applicant clue | Connect UK; form page 2 and statement prepared for Connect UK |
| Agent | Squires Planning |
| Confirmed proposed occupier/operator | Not established by the inspected passages |

Sources: [application form](https://planningregister.crawley.gov.uk/Document/Download?module=PLA&recordNumber=64676&planId=971483&imageId=2&isPlan=False&fileName=ApplicationFormRedacted.pdf),
[planning statement](https://planningregister.crawley.gov.uk/Document/Download?module=PLA&recordNumber=64676&planId=971509&imageId=7&isPlan=False&fileName=1.%20Planning%20Statement%202026.06.29%281%29.pdf).
The site measurement appears on form page 4; floor-area figures on page 10; the change
of use is stated on the planning statement cover and section 2. The form's 347 m² lost
figure is a change of use, not proof of demolition. Square-foot values above are converted
from the original square metres using 1 sq ft = 0.09290304 m².

## Changes and limits

- Recognise Northgate's labelled document buttons without executing JavaScript.
- Accept the observed `/Disclaimer/Accept?returnUrl=...` public form as well as the existing
  anti-forgery-token variant; retain the session for same-origin document downloads.
- Keep cookies off cross-origin requests. For scanned documents behind the public session,
  provide the downloaded PDF bytes to OCR rather than an unusable session-dependent URL.
- Exclude unsupported-browser notices from application evidence; expose document-portal
  robots restrictions and HTTP errors in diagnostics.
- Extend bounded PDF text reading from 12 pages/12,000 characters to 20 pages/24,000
  characters per document. The earlier cap cut this form midway through its floor-area
  section. At most two documents are selected. Re-measure model cost before scaling paid
  research with the larger input allowance; budget settings remain unchanged.
- Ground site-area units written as `Sq. metres`, as in the recovered form.

The live recovery validates one application, not national document coverage or automated
field extraction. The verified figures above are a review of recovered text, not a new
research queue result or database update. Broader portal coverage, including the public
Continue Browsing flow used by Birmingham/Broxbourne and the dynamic NI portal, remains
unfinished. Wandsworth's separate document host disallows automated access.

Raw local audit reports are in `apps/web/reports/planning-document-access-2026-09-11*.json`
and `apps/web/reports/planning-document-crawley-evidence.json` (the latter includes text).

## Automated extraction evaluation — later on 11 September

The budget-ledger-backed v5 evaluation failed to parse JSON and charged its $0.10
reservation. The v6 retry completed (run `0e6ad204-3bd7-49fe-8f0d-6b16bc9eba24`), costing
$0.08868125. It verified use classes, proposed/lost 347 m², net zero,
site 631 m², and Squires Planning as agent. It did not produce an operator claim.

The paid output omitted existing floor space and the applicant clue. Added a bounded
standard-form reader for explicit non-residential TOTALS and company applicants on pages
labelled Applicant Details. An offline check against the recovered real document returns
existing/proposed 347 m², net zero and connect UK as applicant. This reader is integrated
into the research extractor; no extra model call was needed. These supplemental results
have not overwritten the earlier evaluation run or been promoted to reviewed product data.

Birmingham's normal Continue Browsing flow now reaches its application page; PDF retrieval
there remains incomplete. The admin review screen and broader multi-council extraction
validation are still outstanding.
