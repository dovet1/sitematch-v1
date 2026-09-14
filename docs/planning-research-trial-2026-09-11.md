# Planning research trial — 11 September 2026

Prompt v5 / schema v3. Three real queued developments; three completed, no failures.
Total provider-reported cost: **$0.129455**. No budget limits were increased.

| Application | Evidence retrieved | Verified result |
| --- | --- | --- |
| Blackburn with Darwen 10/26/0740, former car wash, 30 Tontine Street | Council page disallowed by robots; web coverage mentioned an unnamed successful brand | No named operator/developer, use classes, commercial floor area or site area verified |
| Coventry PL/2026/0001569/FULM | Council page disallowed by robots; search returned a report for another application | No findings accepted. Amazon belonged to an unrelated reference and was correctly excluded |
| East Hampshire EHDC-26-1013-COUN, Holme Farm | Council page disallowed by robots; search results did not supply usable evidence | No named operator/developer, use classes, commercial floor area or site area verified |

One web response had no memo and reported `finish_reason=length` with 1,000 completion
tokens. The revised extractor completed using retrieved web evidence without another web
request. This establishes output-limit exhaustion in this trial; it does not prove why the
original earlier responses were empty. Reasoning tokens can also consume output allocation
([OpenRouter documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens));
the recorded trial does not distinguish reasoning from other completion tokens.

The software now supports separate site-area and applicant/developer/agent evidence, but
this trial does **not** demonstrate useful field coverage. Empty arrays mean unknown, not
zero area or confirmed absence of an operator. Do not scale paid research based on completion
rate. Next: audit source access and application-form availability on a representative sample,
then evaluate successful extraction separately from source availability.

New evidence is stored in classification-run JSON, with original area units, exact excerpts,
source URLs and page references. There is no new SQL migration or live website deployment.

Run IDs:
- `57321883-c1b3-492d-a7de-eb0e73e9de09`
- `9275323b-5347-4f5f-afe4-87acc26f4244`
- `ae8f7564-7d91-418e-a1b5-b220945089b4`
