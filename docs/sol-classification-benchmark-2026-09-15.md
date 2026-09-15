# Sol classification and allowance trial — 15 September 2026

The user authorised the proposed 100-application trial. All 100 applications were classified
successfully using **gpt-5.6-sol, low reasoning**, through the ChatGPT-authenticated Codex CLI.
No live classifications, queues, budgets, migrations or deployments were changed. There were no
Plota requests, document reads, web searches by the classifier, or external API-key model calls.

## Sample and method

- Seeded sample of 100 from all 2,915 stored August 2026 applications with `intelligence_tier = true`.
- 84 councils represented. SHA256 rank of `sol-100-2026-09-15-v1` plus application ID selected the sample.
- Only the existing Plota classification-input fields were supplied: description, reference,
  council, address, categories, procedure, route, stated quantities/use, stage and decision.
- Four sequential batches of 25, each in a fresh ephemeral session outside the repository.
- ChatGPT authentication confirmed; user config ignored for the invocation, research/connector/
  shell/agent tools disabled, read-only sandbox retained. No persistent Codex configuration changed.
- Short research-priority rubric; output was ID, relevance, confidence and a reason of up to 25 words.
- Existing classifier labels were hidden from Sol and retrieved separately for comparison.
- All 100 expected IDs appeared exactly once. All four runs succeeded without retry or tool use.

This tests applications **after the current deterministic rules**. It cannot discover relevant
schemes those rules excluded, and it does not deduplicate all scheme families. The sample itself
contains planning/listed-building twins. The revised short rubric differs from the existing
classifier, so differences cannot be attributed to model quality alone.

## Measured usage

Total model-run elapsed time: **118.6 seconds**. Account snapshots bracketed the run:

| Account usage consumed | Before (11:12:06 UTC) | After (11:14:16 UTC) | Change |
| --- | ---: | ---: | ---: |
| Five-hour window | 49% | 61% | **12 percentage points** |
| Weekly window | 21% | 23% | **2 percentage points** |

Both reset timestamps remained unchanged. These are rounded, account-wide readings; they can
include coordinator/concurrent activity and reporting lag. They are **not an exact per-model
allowance ledger**. Setup and the subsequent quality review fall outside this measurement window.

CLI-reported usage across the four successful runs:

| Metric | Tokens |
| --- | ---: |
| Input | 52,719 |
| Cached input (within input) | 12,032 |
| Output | 4,520 |
| Separately reported reasoning output | 1,031 |

The reasoning field is preserved as reported rather than added to output and potentially
double-counted. Detailed per-batch events are retained locally.

The earlier measured workload was 26,747 eligible applications received January–August 2026:
**3,343 per month**, or about **772 per week**. Linear extrapolation of this trial gives:

- About **15.4 percentage points of weekly allowance per normal week** of classification.
- Since the observed weekly change is only two whole percentage points, rounding alone could
  plausibly put this nearer **8–23 points per week**. Use roughly **10–25%** as an initial planning
  range, not a guaranteed limit; task mix, caching, other work and batching may change it.
- About **13 points of a five-hour allowance for an average day's 110 applications** when spread
  across seven days. A full monthly batch should not be expected to fit into one five-hour window.
- Approximately one hour of model runtime per month's records at this batch size, excluding
  extraction, validation and review. This is an extrapolation, not a scheduled production run.

Do not interpret the 67-point monthly equivalent as 67% of a monthly quota: the measured quota
resets weekly. No reset credit was consumed or additional credits purchased.

## Results and quality review

| Label | Existing classifier | Sol trial |
| --- | ---: | ---: |
| High | 35 | **52** |
| Medium | 1 | **10** |
| Low | 64 | **38** |

Sol retained 30 existing highs, moved four to low and one to medium. It promoted 21 existing
lows and the one existing medium to high. Nine existing lows became medium. Therefore this
trial **expanded** the high-priority list; it did not demonstrate a smaller or more accurate list.

I read the outputs and recorded closer post-hoc checks on 20 cases: 13 looked reasonable, three
need a product-policy decision, three are borderline, and one amendment decision was overconfident.
These are Codex review judgements, **not blind expert labels or an accuracy percentage**.

Useful decisions included storage-to-gym conversions, new shops within mixed developments, a
retail-unit subdivision, six external storage yards, and four new commercial buildings. Routine
condition submissions and residential-only schemes were generally put low.

Questions to resolve before a production change:

1. **Small holiday lets and home businesses.** Sol put a single garage-to-short-let, two serviced
   flats and a domestic-outbuilding barber shop high. Decide which deserve agent research.
2. **Amendments.** Sheffield 26/02476/FUL was confidently labelled low because it varies approved
   plans and other conditions. The description does not establish that the plan change is minor.
   Link it to the family or preserve uncertainty rather than discarding a potentially material change.
3. **Ancillary commercial expansion.** A new valet building and covered storage were medium.
   Unclear scope may justify that, but missing floor area alone must not reduce relevance.
4. **Scheme rather than application.** Condition submissions still matter as family activity,
   and listed-building twins should not generate duplicate human research tasks.

Recommendation: the usage is promising for a small recurring classifier. Review the selected
borderline cases with an agent, tighten the short rubric, then test fresh records before replacing
the live classifier. This experiment does not justify another portal build or bulk reclassification.

## Evidence and reproduction

Local, ignored report directory:
`apps/web/reports/sol-classification-100-2026-09-15/`

It contains the frozen rubric, four exact input batches, schema, sample and existing labels,
four model results, JSONL events, before/after allowance snapshots, per-batch usage, 20 review
notes in `summary.json`, and copies of the preparation/run/comparison scripts. Raw application
records are not committed or pushed. The preparation script initially misread the one-to-one
relationship shape when collecting old labels; the comparison script corrected those labels
after the trial. This did not affect the sample, Sol's inputs or the usage measurement.

Official references consulted for the execution method:
[Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode),
[ChatGPT authentication](https://learn.chatgpt.com/docs/auth), and
[usage guidance](https://learn.chatgpt.com/docs/pricing).
