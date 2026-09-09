# Planning classifier v3 — revised specification

Date: 9 September 2026
Status: **implemented**. Schema, prompt, persistence and labelling tool all landed 9 September 2026. Not yet run over the sample.
Supersedes the classification design in `plota-development-intelligence-plan.md`. Read
`plota-development-intelligence-session-2-handover.md` first for pipeline state and cautions.

## Why revise

The classifier was specified before we had run it on real data. 164 records have now been
classified under `planning-stage1-v4`, and measuring the output against the three business
objectives shows the schema is aimed slightly off-target.

The objectives, and how the current classifier serves each:

| Objective | Served by | Status |
|---|---|---|
| 1. Surface applications that matter to a commercial property professional | Plota `commercial_work` for the filter, model `relevance` for the ranking | Working |
| 2. Show which brands are expanding and where | model `brandMentions` | Zero output across 164 records |
| 3. Track market size from housing schemes over 15 dwellings | Plota `dwelling_count`, eligibility limb B | 2 qualifying records |

### What the measurement showed

**`opportunityType` serves no objective and nothing reads it.** It is not a column on any
table. No product code queries it. Two of its seven values, `subdivision` and `other`, were
never returned once. Its distribution across the 164 records was `change_of_use` 62,
`commercial_loss` 40, `new_space` 40, `mixed_use` 14, `residential_scheme` 8.

**It also forces a false choice.** `mixed_use` requires the model to decide whether a
scheme is principally residential or principally commercial. A block of flats with a ground
floor shop and a shop with flats above are the same thing for our purposes, but the enum
makes the model pick a side, and it will pick inconsistently. We do not need to know which
half dominates.

**Plota's own numeric fields are too sparse to carry objective 3 alone.**

| Field | Populated | Empty |
|---|---|---|
| `dwelling_count` | 34 | 130 |
| `dwelling_count` at 16 or more | 2 | 162 |
| `floorspace_sqm` | 2 | 162 |

**Housing is not concentrated in `commercial_work = loss`.** An earlier proposal was to ask
the dwelling question only on `loss` records. The distribution rules that out.

| commercial_work | records | model found housing |
|---|---|---|
| new | 46 | 8 |
| to-commercial | 44 | 8 |
| between | 30 | 3 |
| loss | 44 | 3 |

Gating on `loss` would catch 3 of the 22 housing records. It also aims at the wrong size
range: loss conversions run 1, 2, 3 and 6 dwellings and will almost never reach 16, while
the single 556-dwelling scheme in the sample is `new`. 13 of the 22 housing records have no
Plota `dwelling_count` at all, which is precisely where the model earns its cost.

**Objective 2 is limited by the source text, not by the model.** The model returned no
brand mentions on any of the 164 records. The independent alias matcher hit only 14 of 240
records, and most hits are common words caught by accident: PADEL seven times, THREE five
times, GYM twice, WILLOW once. One genuine hit, Tesco. UK planning descriptions usually name
the use, not the operator. They say "change of use of retail warehouse to gymnasium".

That reframes the classifier's job for objective 2. It is not an extractor. It is a **cost
gate** that decides which minority of applications justify spending on document retrieval
and web search with a more expensive model.

## The revision

### Removed

- **`opportunityType`.** Replaced by two orthogonal fields below.
- **`developmentType`.** A free-text field that produced 27 distinct values across 164
  records, mixing snake_case, slugs and prose. Nothing reads it.
- **`needsDetail`, `needsDocuments`, `needsWebResearch`.** Nothing consumes them and they
  are badly calibrated: `needsWebResearch` fired on 6 of 183 completed runs, one of which
  was a low-relevance record. The escalation decision moves into code, where it is
  deterministic and auditable.

### Added

Two independent outputs replacing the single enum. Neither depends on the other, so a
mixed scheme answers both without anyone adjudicating which half dominates.

```
commercialSpace: {
  creates:    'yes' | 'no' | 'unclear'   // built, or moved to a different use -- see below
  useClasses: string[]        // as written in the source, e.g. "E(b)", "B8", "sui generis"
  evidence:   string          // short verbatim excerpt
  confidence: number
}

dwellings: {
  count:      number | null   // null when homes are proposed but no number is stated
  basis:      'stated' | 'counted_from_description' | 'not_stated'
  evidence:   string
  confidence: number
}
```

`dwellings` is asked on **every** record regardless of `commercial_work`, and the count
decides whether it matters, not the Plota category.

**`commercialSpace.creates` asks whether a unit is built or moves to a different use. It does
not ask whether the finished building contains occupiable commercial space.** The distinction
decides real money. This answer gates the expensive document and web-search pass, and that
pass exists to identify an operator. A trading shop getting a new shopfront contains
occupiable space but has no arriving occupier to find, so researching it returns nothing.
Extensions, signage, plant and repairs to a business that keeps trading as before are `no`.
A retail warehouse becoming a gym, or a new-build unit, are `yes`.

The prompt and the labelling page must both carry this wording, or the model and the humans
will be answering different questions and the agreement figure will be meaningless.

`dwellings.count` must stay nullable for the reason recorded in the session 2 handover: the
model previously wrote `0` for "not stated", producing a record that asserted zero
commercial floorspace at 0.85 confidence beside evidence describing two commercial units.
Null means unstated. Zero means the source says none.

### Changed

**`relevance` is rewritten as an investigation gate.** It currently asks whether there is
commercial space an occupier could take. It should ask whether this application is worth
paying to investigate further. Those are close but not identical, and the second is the
question the pipeline actually acts on.

Proposed rubric:

- **high** — a real commercial unit is created or changes hands, and an operator plausibly
  exists to be identified. New-build commercial, a change of use into or between commercial
  uses at a scale someone would occupy, or a major scheme with a genuine commercial component.
- **medium** — commercial consequence exists but is small, ancillary, or too thinly
  described to act on. Also a large residential scheme with no commercial element.
- **low** — no commercial consequence worth money. Householder work, one or two dwellings,
  trees, advertising, or alterations that do not change what the building can be used for.

Most applications are low. The rubric must not name a category repeatedly; the session 2
handover records that telling the model "never commercial_loss" made 9 of 10 records come
back `commercial_loss`. Describe each band positively.

**Escalation becomes a code-side derivation**, not a model output:

```
escalate = relevance === 'high' && commercialSpace.creates === 'yes'
```

On the current sample that gate keeps 44 of 164 records, about 27 percent, which is the
population that would reach document retrieval and web search. That number is the thing to
tune once labels exist, because it is directly a budget.

### Unchanged

`brandMentions`, `observations`, `substantiveProposal`, `confidence`, `reasons`,
`uncertainties`, `unansweredQuestions`. The `partitionObservations` null-handling and the
`developmentSummary` enum guard both stay; they exist because of live failures.

`observations` keeps `metric: 'commercial_floorspace'` but drops `metric: 'dwellings'`,
which is superseded by the first-class `dwellings` field. 31 of the 38 stored observations
are `dwellings/stated_unspecified`, a scope that carries no usable information.

## Persistence

The new fields must be queryable, which `opportunityType` never was. Proposed columns:

| Table | Column | Type |
|---|---|---|
| `developments` | `creates_commercial_space` | text, check in ('yes','no','unclear') |
| `developments` | `commercial_use_classes` | text[] |
| `developments` | `model_dwelling_count` | integer, nullable |
| `developments` | `model_dwelling_basis` | text, nullable |

`model_dwelling_count` is deliberately separate from Plota's `dwelling_count` rather than
overwriting it. They disagree, both are evidence, and a reviewer needs to see both.

**Open question for review:** these sit on `developments`, matching where `relevance` and
`confidence` already live. That is correct while the relationship is one application to one
development, which it is today. It becomes wrong once related applications are merged, since
two applications on one site will carry different dwelling counts. Flagging rather than
resolving, because merging is not implemented.

## What landed

| File | Change |
|---|---|
| `src/lib/planning-intelligence/types.ts` | `PlanningClassification` carries `commercialSpace` and `dwellings`; the five retired fields are gone. |
| `src/lib/planning-intelligence/openrouter.ts` | Zod and JSON schemas rebuilt; system prompt rewritten; versions bumped to v5 / v3. |
| `src/lib/planning-intelligence/classify.ts` | `shouldEscalate` derives the research gate in code; the new fields are persisted. |
| `supabase/migrations/20260920000000_add_classifier_v3_development_columns.sql` | The five columns those writes need, plus a partial index for the research pass. |
| `scripts/labelling/page.template.html` | Step 2 asks "create or change", with the exclusions spelled out. |

The prompt and the labelling page carry the same wording for `commercialSpace.creates`,
deliberately and word for word. If they drift, the model and the humans are answering
different questions and the agreement figure means nothing.

Planning tests: **76 across 9 suites**, up from 70. The additions cover the null-versus-zero
dwelling distinction, a scheme that is both commercial and residential, the escalation gate,
and the absence of the retired fields.

## Two regressions the first v5 draft introduced, and the fixes

Both were found by classifying live records under the new prompt and comparing with the
stored v4 verdict. Neither would have been visible by reading the prompt.

**Relevance collapsed to `low`.** The first draft said "most applications are low" in the
schema description AND again in the system prompt, plus "be strict". Three records v4 called
`high` all came back `low`, and the escalation gate passed nothing at all. This is the same
anchoring failure the session 2 handover already records, where naming `commercial_loss`
repeatedly made 9 of 10 records come back `commercial_loss`. The fix was the one that worked
last time: describe each band positively, give `high` concrete examples, and state the
calibration once rather than three times.

**`commercialSpace.creates` flipped on a leading phrase.** The Wandsworth record reads
"Alterations in connection with change of use of retail warehouse to gymnasium". The model
answered `yes` sometimes and `no` others, latching onto "Alterations" and treating a real
change of use as building works. Councils write this construction routinely, so the prompt
now says to judge the substantive change rather than the opening words, and to answer `no`
only when no change of use appears anywhere.

After both fixes, on the record carrying the one human label, `creates` came back `yes` on
5 runs of 5 and relevance `high` on 4 of 5, against a human label of `high`. The remaining
variance is the model's own: `strict: true` is still not enforced, and this model is
stochastic even at temperature 0.

**The lesson worth carrying forward: a prompt change cannot be reviewed by reading it.** Both
faults were introduced deliberately and carefully, and both were invisible until real records
went through. Any future prompt edit needs the same before-and-after comparison against
stored verdicts, which costs less than a penny.

### And the trap that comparison sets

Comparing against v4 tells you what *changed*. It does not tell you what is *right*, and
treating it as though it does is circular. The fix for the collapse briefly did exactly that:
it named three schemes as `high` in the rubric, and those three were simply the records v4
had called high, written back into the prompt as if they were ground truth. The model then
agrees with the answer it was handed, and the agreement looks like evidence.

Those examples have been removed. What remains is the abstract criterion, which comes from
the business objective rather than from any model output: is there an operator to go and find.

**The band boundary is still unset.** Only human labels may move it. The distinction to hold
on to:

| Safe to fix before labels | Must wait for labels |
|---|---|
| The gate passing nothing at all | Where `high` stops and `medium` starts |
| The same input giving different answers across runs | Whether a small unit is worth researching |
| The model misreading a leading phrase | Whether the current 44 of 164 is the right yield |

The first column is broken behaviour: wrong regardless of where anyone thinks the threshold
sits. The second is judgement, and it is not ours to make.

## The tuning pass, 9 September 2026

Done on `google/gemini-2.5-flash-lite` at a 0.0% flip rate, so every difference below is the
change and not the model. Three edits, each measured before the next was made. Prompt is now
`planning-stage1-v6`; the schema did not move.

| | relevance | gate fires | gate recall | gate precision |
|---|---|---|---|---|
| baseline | 45.9% | 86 | 94.4% | 39.5% |
| 1. bands rewritten for the real population | 38.2% | 28 | 48.6% | 64.3% |
| 2. medium narrowed, low made decisive | 56.9% | 35 | 61.1% | 62.9% |
| 3. two over-broad exclusions fixed | **59.1%** | 50 | **83.8%** | 62.0% |

Every fault found was in the prompt I had written, not in the model:

1. **The low band described records that never arrive.** It listed householder work, trees and
   advertising, but everything reaching this classifier has already passed a commercial
   filter. Given no way to call a commercial application low, the model defaulted upward and
   called 86 of 109 records high. Rewriting the bands around what actually arrives fixed the
   over-calling immediately, though it moved the mass into `medium`.
2. **`medium` was a catch-all.** It ended with "or a description too thin to tell what would
   be occupied", which swallowed everything the model was unsure about and contradicted the
   low band. Removing that clause, saying `medium` is the rarest of the three, and putting the
   residential-outcome rule first in `low` produced the largest single gain.
3. **Two exclusions were too broad.** "Infrastructure nobody lets" was applied, correctly, to
   an EV charging hub and a floodlit football pitch, both of which the expert calls high: the
   test is whether somebody runs it, not whether it is infrastructure. And "a description too
   garbled to judge is low" was applied to "Use as class E (Cafe)", which is short but
   perfectly clear. Length and clarity are different things.

### The held-out third

Never inspected until the tuning stopped. It scores **better** than the set that was tuned on,
so the changes generalise rather than fitting 110 records.

| | tuning (110) | held out (54) |
|---|---|---|
| relevance | 59.1% | **70.4%** |
| creates commercial space | 88.2% | 85.2% |
| dwelling 16+ cut | 110/110 | **54/54** |
| gate recall | 83.8% | **86.7%** |
| gate precision | 62.0% | 59.1% |

**What is left.** Gate precision around 60% means two of every five paid research calls go to
a record the expert would skip. Whether that is acceptable is a spending judgement, not a
modelling one: the gate now catches roughly six of every seven records he wants, and missing
an opportunity is likely worse than a wasted lookup. Improving it further needs either more
labels or a decision about that trade.

## The v6 reclassification, 9 September 2026

All 164 records reclassified through the real worker path and scored against the expert's
labels. **Zero failures**, against roughly 5% under the previous model. Every development row
carries the v3 fields; 156 of 164 carry a dwelling count.

| | v4 (previous model) | v6 (current) |
|---|---|---|
| relevance agreement | 64.0% | 62.2% |
| creates commercial space | not asked | **87.2%** |
| dwelling count, exact | not asked | **87.2%** |
| dwelling 16+ cut | not asked | **164/164** |
| classification failures | ~5% | **0** |
| run-to-run flip rate | 32.3% | **0.0%** |

**Raw relevance agreement did not improve, and that needs saying plainly.** But v4's 64.0% is
a single sample from a distribution 13 points wide, so it is not a number the new one has to
beat; re-running v4 could as easily have produced 51%. What changed is that 62.2% is now
repeatable, and that two of the three questions the product actually asks are answered at all.

The prediction held: the tuning split scored 59.1% and the held-out third 70.4%, so the full
set was expected to land between them, and did.

### The persisted escalation gate

This is what the research pass will select, read from `developments.escalate_for_research`
rather than recomputed.

| | |
|---|---|
| records the expert called high | 52 |
| gate fires on | 72 |
| of those, wanted | 44 (61.1% precision) |
| of the expert's highs, caught | 44 (84.6% recall) |

**`medium` is effectively unlearned** at 7.4% precision and 8.3% recall. It does not affect
the gate, which turns on `high` alone, so it is not currently worth fixing. It would matter if
`medium` ever became a product surface.

## How to measure anything here

Two scripts, both read-only. Neither writes to the database, so a measurement can be repeated
without churning development rows or the usage ledger.

```bash
cd apps/web
# classify and score against the expert's labels
npx tsx scripts/evaluate-classifier.ts --out runs/<name>.json
# ... on a candidate model, over a fixed subset
npx tsx scripts/evaluate-classifier.ts --out runs/<name>.json --model <id> --limit 80
# re-score a cached run for free
npx tsx scripts/evaluate-classifier.ts --score-only runs/<name>.json
# the held-out third: reveal ONCE, at the end
npx tsx scripts/evaluate-classifier.ts --score-only runs/<name>.json --holdout
# noise floor, or any A/B
npx tsx scripts/compare-runs.ts runs/<a>.json runs/<b>.json
```

Three properties of the harness are load-bearing, and each exists because its absence caused
a real problem:

- **A third of the labels are held back**, split on a hash of the record id so the same
  records are reserved on every run and every machine. There is one labeller, so nothing else
  can tell a real improvement from fitting the model to one person's taste.
- **Records are returned in a fixed order.** Without it `--limit 80` takes a different 80 each
  time and two runs cannot be compared at all.
- **Classifications are checkpointed every 20 records.** An early run stalled on its last four
  with everything in memory; killing it threw away 160 paid-for classifications.

**Always establish the noise floor before reading an A/B as a result.** Run the identical
prompt and model twice, compare, and treat the flip rate as the resolution limit of every
other comparison. `runs/` is gitignored: the files hold live record data and are rebuilt on
demand.

## STOP: this model cannot be tuned by prompt on this sample

Measured 9 September 2026. **Two runs of the byte-identical prompt over the same 99 records
disagreed with each other on 32.3% of them, and their agreement with the expert's labels
differed by 13.1 points** (59.6% against 46.5%). `temperature` is already 0; this is
provider-side nondeterminism in `openai/gpt-oss-120b`, the same unreliability that makes
`strict: true` unenforced for it.

Every relevance comparison made that day is therefore unsupported, including two this
document previously stated as findings:

| Comparison | Difference | Verdict |
|---|---|---|
| v4 against v5 | 8.7 points | inside the noise |
| v5 against v5 plus a substance rule | 5.2 points | inside the noise |
| **the same prompt against itself** | **13.1 points** | **the floor** |

The claim that the v5 rubric was a regression against v4 does not survive this. Neither does
the claim that adding a substance rule helped. Both were single-run numbers read as results.

**One nuance worth keeping.** The aggregate distribution barely moved between the two runs:
high 65 then 65, medium 13 then 15, low 21 then 19. It is not the model's overall behaviour
that is unstable, it is which record gets which answer. That is the worst arrangement for
this product, because the escalation gate is per-record: a third of the research budget would
chase different applications on every run, and the expert's high-value records would be
missed at random rather than systematically.

### Measured alternatives, 9 September 2026

Two runs each over the same 80 records, same prompt, scored on the tuning split.

| Model | Flip rate | Failures | Agreement with the expert | 16+ dwelling cut | $/164 | Rate limit |
|---|---|---|---|---|---|---|
| `openai/gpt-oss-120b` (current) | **32.3%** | ~5% | 46-60% | 99% | 0.03 | none hit |
| `google/gemini-2.5-flash-lite` | **0.0%** | 1.3% | 37.7% | 100% | 0.07 | none hit |
| `google/gemini-2.5-flash` | **5.6%** | 0% | 50-54% | 98% | 0.38 | none hit |
| `anthropic/claude-haiku-4.5` | **0.0%** | 1.3% | 47.2% | 98% | 0.88 | 20 rpm, new account |

**Two models are effectively deterministic.** Flash Lite and Haiku both returned identical
free-text on 79 of 79 records; Haiku's entire output matched on 77 of 79, differing only in
minor fields. Either makes prompt tuning measurable, which is the gate. Flash, despite the
best raw agreement, is the only candidate that still carries noise.

**Recommendation: `google/gemini-2.5-flash-lite`, with Haiku as the fallback.**

- Both are equally tunable, so the 9.5-point head start Haiku has is prompt work, and prompt
  work is exactly what determinism unlocks.
- Flash Lite is roughly a twelfth of the cost. The classifier is the high-volume rationing
  step in front of an expensive research pass, so its unit cost is the one that compounds.
- Haiku is capped at 20 requests a minute on this account. A full pass took over 8 minutes
  paced, against about 2 for Flash Lite, which makes any backfill materially slower.
- Flash Lite scored 100% on the 16-plus dwelling cut, the one thing objective 3 acts on.

If prompt work fails to close the accuracy gap, switch to Haiku: at $0.88 for a full pass the
absolute cost is still negligible, and it starts closer.

### Switching the worker

`classify.ts` refuses a custom model unless the reservation is set explicitly, so both of
these are required together:

Flash Lite is now the built-in default, so no environment variable is needed for it. The
reservation moved from 0.003 to **0.002** in `budget.ts`, sized from a measured $0.000214 a
call: a two-run sample has not seen the cost tail, so the worst single call is taken as double
the average and a queue item as three of those. A first attempt at 0.001 was rejected by the
budget test for not covering three attempts, which is the test doing its job.

To run the Haiku fallback instead, both of these are required together, because `classify.ts`
refuses a custom model without an explicit reservation:

```
OPENROUTER_PLANNING_MODEL=anthropic/claude-haiku-4.5
PLANNING_LLM_CLASSIFICATION_RESERVATION_USD=0.017
```

**Flash Lite returned byte-identical output on both runs**, including the free-text summary on
all 79 records. Checked against the degenerate explanation: it is not answering the same thing
to everything, and uses all three relevance bands and every dwelling bucket. It over-calls
`high` badly, 55 of 79 where the expert calls about a third, so its agreement is the worst of
the three.

That is the right problem to have. A model that is wrong consistently can be corrected by
prompt work and every correction is measurable; a model that is wrong randomly cannot be
corrected at any price. Zero noise means any change at all is signal.

`anthropic/claude-haiku-4.5` could not be measured on the first attempt: every failure was
`new-account-rpm`, a 20 requests-per-minute cap on new OpenRouter accounts, against a harness
firing six at a time with retries. **That is a harness fault, not a model result, and must not
be recorded as one.** `--rpm` now paces requests through a single shared gate.

### What makes it measurable again

Either raise the sample count or change the model.

- **Average several runs per prompt variant.** Variance falls with the square root of the
  count. Two runs is not enough to pin the spread down, but a swing of 13 points between them
  puts the per-run standard deviation somewhere around 6 or 7, so roughly ten runs would be
  needed to resolve a 5-point difference. At about 8p a run that is under a pound per variant,
  which is affordable — it is patience, not budget, that it costs.
- **Try a model that is not this stochastic.** Classification costs $0.0004 a record, so even
  a model ten times dearer is about 66p for the whole sample. `evaluate-classifier.ts` takes
  any model, and `compare-runs.ts` will measure its noise floor the same way.

Do the second before the first. There is no point averaging ten runs of a model that may
simply be unfit, and the arithmetic above assumes a spread we would no longer have.

**Nothing about the dwelling or commercial-space findings is affected by prompt tuning being
blocked**, but both were measured on single runs too and carry the same uncertainty. The one
result that looks robust is the 16-plus dwelling threshold at 103 of 104 and 104 of 105 across
two independent runs.

## Versioning and cost

- `PLANNING_PROMPT_VERSION` → `planning-stage1-v5`
- `PLANNING_SCHEMA_VERSION` → `planning-classification-v3`

Both are persisted per run, so v4 and v5 output coexist and stay comparable. Reclassifying
all 164 records costs roughly $0.07 at the observed ~$0.0004 per record including retries.
That is affordable; the Plota request budget, not the LLM budget, is the scarce resource.

`MAX_CLASSIFICATION_ATTEMPTS` stays at 3. `strict: true` is still not enforced by
`openai/gpt-oss-120b`, and adding two nested objects to the schema may raise the off-schema
rate. Watch the failure count on the first batch.

## Effect on the calibration exercise

The labelling tool asks for `relevance` and `opportunityType`. `opportunityType` is being
removed, so the tool needs to ask the two new questions instead. Only one human label has
been submitted so far, so nothing is lost by changing it now.

Revised labelling questions, now live in the page:

1. Is this worth paying to investigate further? high / medium / low
2. Does this create or change commercial space someone could occupy? yes / no / unclear
3. How many homes does this create? a number, "none", or left empty for "not stated"

Question 3 gives something the current exercise lacks: a directly checkable ground truth,
since a human reading the description can usually count the flats. Relevance is a judgement
call and needs two labellers to bound it. Dwelling count does not.

The empty-versus-zero distinction is carried all the way through, because it is the specific
failure being watched. An empty box is "not stated" and stores null; typing 0 asserts the
application says none. Anything that is not a whole number is refused rather than coerced,
since `Number("")` is 0 and a silent zero here would manufacture the exact false figure the
exercise exists to detect.

### What is built

| File | Purpose |
|---|---|
| `apps/web/scripts/labelling/page.template.html` | The page. Edit this, never a built copy. |
| `apps/web/scripts/build-labelling-page.ts` | Pulls the live sample and emits the standalone file. |
| `supabase/migrations/20260919000000_extend_planning_label_submissions.sql` | Adds the two columns the page posts. |
| `apps/web/scripts/score-relevance-sample.ts` | Scores all three questions, and the two labellers against each other. |

Build it with `npx tsx scripts/build-labelling-page.ts <out.html>` from `apps/web`. The
output is one self-contained file that opens straight from the filesystem, and
`/planning-labelling*.html` is gitignored so a built copy carrying live records is never
committed by accident.

**The migration must be applied before labelling starts.** Without it every post is rejected
with `PGRST204`. The page survives that -- unsent judgements queue in the browser and flush
on the next successful post, and Export results always holds everything -- but a labeller
would be working with nothing reaching the shared table.

The scorer works either side of the migration: it asks for the new columns, and falls back
to the old shape with a note rather than failing when they are not there yet.

### Verified, not assumed

Driven in a browser against the built page: each label attaches to the record on screen; an
empty box stores null and the None button stores 0; a non-numeric entry is refused and
nothing is saved; skip records a skip; the CSV hand-back carries an empty cell for "not
stated" and a 0 for a stated none; and the scorer reads that CSV back correctly. The
rejected post was confirmed to be `PGRST204` for the missing column and nothing else.

## Sequence

1. Apply `20260919000000`, then gather labels on the existing 164-record sample under v4.
   Labels on relevance and dwelling count remain valid across the prompt change; they
   describe the application, not the model. The tool for this is built.
2. ~~Land the schema and prompt changes behind the existing flags, still off.~~ Done.
   Apply `20260920000000` before any v5 run, or every classification will fail on the write.
3. Reclassify the 164 records under v5.
4. Score v5 against the labels, and compare with v4 on the same labels.
5. Tune the escalation gate against the measured budget.

Step 1 first, because a prompt tuned without labels is tuned by eye, which is what this
exercise exists to stop.

## Known issue this does not address

A record can still strand in `processing` forever. The queue selects only
`queued|failed|deferred_budget`, so a worker dying mid-record leaves it unreachable. One
record did this during session 2. It will recur during any long backfill and needs a
separate fix, most simply a `classification_started_at` column and a stale-lease reclaim.
