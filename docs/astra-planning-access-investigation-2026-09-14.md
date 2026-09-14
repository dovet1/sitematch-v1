# Planning information access: investigation for Claude

14 September 2026. Read-only investigation: no Plota API requests, OpenRouter calls, live database changes, worker changes or messages to external parties. The only repository additions are this note and the supporting evidence JSON. This does not replace Claude's implementation plan.

## Main finding

The council-access audit measures what the current collector can retrieve from application portals. It does not measure the availability of planning facts across all public sources. There is now a tested alternative for London, and concrete evidence that wider web research can provide useful context elsewhere. Neither establishes complete national coverage.

## 1. London has a working public source of structured floorspace

The [GLA's official description](https://www.london.gov.uk/programmes-strategies/planning/digital-planning/planning-london-datahub) describes an open dataset combining council records and applicant information. Its [guest API instructions](https://www.london.gov.uk/sites/default/files/planninglondondatahub_api_connection_technical_documentation_v1.pdf) document read-only application lookup and search, including floorspace details.

I successfully queried the live guest API. Using the same applications already in Claude's audit, I selected three records each from Bromley, Camden, Hillingdon, Hounslow, Lambeth, Southwark, Wandsworth and Westminster. All eight had been labelled blocked or page-only by the collector.

| Measure | Result |
| --- | ---: |
| Application references requested | 24 |
| Exact constructed IDs matched | 20 |
| Records containing detailed floorspace rows | 15 |
| Records containing a site-area value | 14 |

These measure field availability, not verified correctness or final checklist completion. The eight boroughs are a purposive sample, and the underlying audit used the old eligibility rules. Do not extrapolate these rates nationally. The four unmatched IDs were all three Bromley examples and Wandsworth 2026/2938; this could reflect coverage, timing or ID conventions and needs diagnosis.

Evidence is in `apps/web/reports/astra-planning-access-evidence-2026-09-14.json`, including requested IDs, returned fields and three additional illustrative records.

Concrete examples:

- **Camden 2026/3418/P**, a proposed gym: detailed rows record 516.82 m² in an existing use and 516.82 m² in the new use. The data uses codes `EB` and `ED`; these need an authoritative mapping before display.
- **Wandsworth 2025/3651**, replacement care accommodation: a `C2` row records existing GIA 6,135.67 m², GIA lost 6,135.67 m² and GIA gained 13,734.9 m². Site area is also supplied. Treat the amounts according to the dataset's gained/lost definitions, not as interchangeable measures.
- **Wandsworth 2019/4915**, the missing original of the pilot family: returned 369 m² non-residential gained and 351 m² lost, a site-area value, detailed use rows and commencement information. These belong to the original permission; they do not establish the size approved by the later 2025/3409 amendment.
- **Wandsworth 2025/3409**, the pilot amendment: the API returned the record and decision conditions, but its `application_details` was empty. A condition specifically describes the permitted office/gallery uses. This is useful evidence even where the structured size fields are absent.

Quality checks are essential. For example, Camden's gym has useful detailed rows while aggregate non-residential gain/loss fields are zero. Hounslow P/2026/2133 describes conversion of a flat to office but has two existing-area rows and no gained/lost quantities. Wandsworth 2022/2709 has divergent totals in different blocks and site-area values requiring unit interpretation. Do not copy a zero aggregate over detailed evidence or assume every site-area field uses the same unit. Verify the schema, scope and source version first.

The existing grouped-assessment report contains **3,730 applications / 3,496 assessment units across the 33 London borough entries**, including the archive backlog. This is the potential lookup population, not a count of records the GLA will successfully enrich. It is about 9.8% of the 38,088 applications nationally.

Suggested bounded implementation: exact council/reference lookup as an optional evidence source before paid research; preserve the returned field path and source date; route contradictions to review. Measure matches and usable facts separately. Do not replace Plota ingestion or build a second national collector.

## 2. Other public sources contain useful evidence

**Glasgow 26/01611/FUL:** [Glasgow Waters' developer announcement](https://glasgowwaters.co.uk/whisky-and-jazz-bar-proposed-for-16-robertson-street/) identifies a proposed whisky/jazz venue at the matching Clydeport building address, an intended capacity of approximately 80–90 guests, Glasgow Arts Centre Limited's involvement, and Peel Waters' management of the building. This supplies useful scheme context and a named party to investigate. It does not explicitly establish the eventual operator or provide floor/site area, so those facts remain open.

**Wandsworth 2019/4915:** the council's [non-residential monitoring report](https://www.wandsworth.gov.uk/media/12551/non_residential_development_report_2019_2021.pdf), printed page 76, records the same 369 m² gain / 351 m² loss / 18 m² net change. This is a separate source from the application-form portal. It is historical and must not be published as the later amendment's current floorspace.

I also found the listing for the 2025/3409 committee report. However, `https://democracy.wandsworth.gov.uk/robots.txt` returned `User-agent: *` and `Disallow: /` when checked directly. I did not retrieve that report after checking the restriction. A publicly indexed report listing is not proof of permitted automated retrieval.

A bounded search for the Broadland/Long Stratton self-storage pilot did not establish a sourced operator or floor/site area. Do not manufacture a completion rate from the more successful examples.

Recommendation: test web research for **all missing commercially useful facts**, not operator alone. Search the exact reference first, then the scheme address/name plus its intended use. Distinguish an applicant, developer, manager and operator. An alternative source can improve a record without completing every checklist item.

## 3. The reader audit needs several qualifications

Code checked: `apps/web/src/lib/planning-intelligence/research-sources.ts` and `research-coverage.ts`.

- The generic reader follows recognised HTML links and a limited set of portal-specific patterns. It limits candidate traversal and collected documents to two, with one bounded level through a document list. It does not generally render JavaScript-driven applications. Some page-only labels may therefore describe an unsupported reader, not unavailable documents.
- A successful HTML fetch is generally recorded as a council page without confirming that the expected application reference or description appears in it. A JavaScript shell or generic landing page could count as page-only even when no application facts have been retrieved.
- **The four councils labelled as needing OCR are not proven to have scanned PDFs.** `onlineRegisterSources` sends every retrieved PDF to OCR without first calling the local text extractor. The label currently describes the implementation path. Try free text extraction before deciding OCR is necessary. Affected audit entries: Exmoor, North Warwickshire, South Oxfordshire and Vale of White Horse.
- The four detached-ArrayBuffer failures are in Bridgend (one) and Wealden (three). The code passes PDF bytes into PDF.js and can later reuse them to construct the OCR payload. Buffer ownership is a likely cause to reproduce and fix; this investigation did not modify or rerun that code.
- Of the 81 page-only entries, ten share the Northern Ireland host, seven have Salesforce `my.site.com` hosts, and four use StatMap hosts. These **21 entries are candidates for reusable portal support**, not 21 confirmed recoveries. Start by proving access to actual application content and permitted documents on one representative portal in each group.
- Keep robots exclusions, transport errors, unsupported portals and unavailable documents separate. Use labels as dated evidence and routing hints, not permanent council-wide bans based on three records.

## 4. What Plota publicly documents, and what to ask

The [API documentation](https://plota.co.uk/api-docs) describes `commercial_use_class`, `floorspace_sqm` and document counts. I did not find a documented document-body or extracted-form endpoint in its [published OpenAPI schema](https://plota.co.uk/openapi.json). That does not establish that a custom or undocumented service is unavailable.

Plota's [Edinburgh example](https://plota.co.uk/application/91241) displays document titles, categories and dates, with links leading back to the council. This proves it has document-list metadata for at least some records; it does not prove it hosts PDFs or extracted document text.

Draft question, **not sent**:

> We use your API to identify substantive commercial developments and need use classes, existing/proposed commercial floorspace and site area. Your public application pages sometimes display document titles and categories. Can the API supply that document metadata, usable document URLs, application-form fields, or extracted document text? For `floorspace_sqm`, what source, measurement basis and existing/proposed/net meaning does it have? What coverage do these fields have by council and application type, particularly where our own collector cannot access the council portal? Are these capabilities included in our existing account, available as an add-on, or obtainable through a bulk export? Please distinguish hosted content from links to council-hosted files and explain the additional charges, if any.

## Recommended next work

1. Test a minimal London Datahub evidence adapter against the exact sample above, including contradictory and missing-field cases. Verify unit/code definitions before writing facts.
2. Ask Plota the concrete capability/coverage question; user sends or explicitly authorises sending.
3. Fix the small collector defects and separately assess the highest-value shared unsupported portal families. Recheck only affected samples initially.
4. Run the proposed small alternate-source research experiment across operator, use and size, retaining scheme/version matching and measuring verified facts rather than completed API calls.
5. Send only prioritised, commercially worthwhile unresolved schemes to admin. Do not build the national workflow around manually completing 95% of records.

This is an evidence-backed improvement path, not proof that the national access problem has been solved. No production changes were made.
