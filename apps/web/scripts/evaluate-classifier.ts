/**
 * Score the classifier against Rob's human labels, WITHOUT writing anything.
 *
 * Why read-only: tuning is a loop, and a loop that persists would rewrite 164 development
 * rows on every iteration and churn the usage ledger. Classifications are cached to a file
 * instead, so re-scoring is free and only a prompt change costs money.
 *
 * Why a held-out split: there is exactly one labeller. With no second opinion there is no
 * way to tell an improvement from fitting the model to one person, so the split does that
 * job instead. `--holdout` is the only way to see the reserved records, and using it is a
 * deliberate act that should happen once, at the end.
 *
 * Run from apps/web:
 *   npx tsx scripts/evaluate-classifier.ts --out runs/v5-a.json      # classify and score
 *   npx tsx scripts/evaluate-classifier.ts --score-only runs/v5-a.json
 *   npx tsx scripts/evaluate-classifier.ts --score-only runs/v5-a.json --holdout
 *   npx tsx scripts/evaluate-classifier.ts --out runs/smoke.json --limit 12
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { classifyWithOpenRouter, PLANNING_PROMPT_VERSION } from '../src/lib/planning-intelligence/openrouter'
import { shouldEscalate } from '../src/lib/planning-intelligence/classify'
import type { PlanningClassification, PlotaApplication } from '../src/lib/planning-intelligence/types'
import { MAJOR_HOUSING_DWELLINGS } from '../src/lib/planning-intelligence/eligibility'

loadEnvConfig(process.cwd())

const LABELLER = process.env.EVAL_LABELLER ?? 'rob'
/** Fraction reserved. Two thirds to tune on is enough to see a pattern; a third is enough to catch overfitting. */
const HOLDOUT_FRACTION = 1 / 3
const CONCURRENCY = 6

/**
 * Split on a hash of the record id, not at random and not on position. It must give the same
 * answer on every run and every machine, or a record could drift between the two sets and
 * quietly leak the reserved half into the tuning half.
 */
function isHoldout(recordId: string): boolean {
  const digest = createHash('sha256').update(`holdout:${recordId}`).digest()
  return digest.readUInt32BE(0) / 0xffffffff < HOLDOUT_FRACTION
}

type Cached = {
  promptVersion: string
  model?: string
  classifiedAt: string
  results: Record<string, { classification?: PlanningClassification; error?: string }>
}

/**
 * A single gate every worker passes through, so the whole pool shares one request budget.
 * Each caller claims the next slot and waits for it, which spaces requests evenly rather
 * than letting them bunch at the start of each minute.
 */
function createPacer(rpm: number) {
  if (rpm <= 0) return async () => {}
  const interval = 60_000 / rpm
  let slot = 0
  return async () => {
    const now = Date.now()
    slot = Math.max(now, slot) + interval
    const wait = slot - interval - now
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }
}

async function pool<T>(items: T[], limit: number, worker: (item: T, i: number) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await worker(items[i], i)
    }
  }))
}

function table(rows: string[][]) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)))
  return rows.map((r, ri) => {
    const line = r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ')
    return ri === 0 ? `${line}\n${w.map((n) => '-'.repeat(n)).join('  ')}` : line
  }).join('\n')
}

function confusion(name: string, pairs: Array<{ human: string; model: string }>, classes: string[]) {
  console.log(`\n--- ${name} ---`)
  if (pairs.length === 0) { console.log('  nothing to score'); return }
  const agreed = pairs.filter((p) => p.human === p.model).length
  console.log(`  agreement: ${agreed}/${pairs.length} (${((agreed / pairs.length) * 100).toFixed(1)}%)\n`)
  const header = [`${LABELLER} \\ model`, ...classes, 'total']
  const body = classes.map((h) => {
    const row = pairs.filter((p) => p.human === h)
    return [h, ...classes.map((m) => String(row.filter((p) => p.model === m).length)), String(row.length)]
  })
  const totals = ['total', ...classes.map((m) => String(pairs.filter((p) => p.model === m).length)), String(pairs.length)]
  console.log(table([header, ...body, totals]).split('\n').map((l) => '  ' + l).join('\n'))
  console.log('\n  per class:')
  console.log(table([['class', `${LABELLER}`, 'model', 'precision', 'recall'], ...classes.map((c) => {
    const tp = pairs.filter((p) => p.model === c && p.human === c).length
    const predicted = pairs.filter((p) => p.model === c).length
    const actual = pairs.filter((p) => p.human === c).length
    const pct = (n: number) => (Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : '—')
    return [c, String(actual), String(predicted), pct(predicted ? tp / predicted : NaN), pct(actual ? tp / actual : NaN)]
  })]).split('\n').map((l) => '  ' + l).join('\n'))
}

async function main() {
  const argv = process.argv.slice(2)
  const arg = (name: string) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1] }
  const outPath = arg('--out')
  const scoreOnly = arg('--score-only')
  const limit = Number(arg('--limit') ?? 0)
  const model = arg('--model')
  // Some models are rate limited per minute (Anthropic on a new OpenRouter account is 20 rpm).
  // Without pacing the pool blows straight through it and every record fails, which reads as
  // "the model is unsuitable" when it is nothing of the kind.
  const rpm = Number(arg('--rpm') ?? 0)
  const showHoldout = argv.includes('--holdout')
  if (!outPath && !scoreOnly) throw new Error('pass --out <file> to classify, or --score-only <file> to re-score')

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: labelRows, error: labelError } = await db
    .from('planning_label_submissions')
    .select('labeller,record_id,relevance,creates_commercial_space,dwelling_count,submitted_at')
    .eq('labeller', LABELLER).order('submitted_at', { ascending: true })
  if (labelError) throw labelError
  // Relabelling appends rather than updates, so the newest row per record wins.
  const labels = new Map<string, { relevance: string; creates?: string; dwellings?: number | null }>()
  for (const r of labelRows ?? []) {
    labels.set(String(r.record_id), {
      relevance: String(r.relevance),
      creates: r.creates_commercial_space ? String(r.creates_commercial_space) : undefined,
      dwellings: r.dwelling_count === null || r.dwelling_count === undefined ? null : Number(r.dwelling_count),
    })
  }
  const { data: apps, error } = await db
    // Only the labelled records. The tier outgrew the 1,000-row read cap in September 2026, and
    // an unfiltered read silently scored 3 of the 164 labels.
    .from('planning_applications').select('provider_id,raw').in('provider_id', [...labels.keys()])
    // Ordered so that --limit takes the SAME records every time. Without this, Postgres is
    // free to return any order and two limited runs would not be comparable.
    .order('provider_id', { ascending: true })
  if (error) throw error
  const records = (apps ?? []).map((a) => ({ id: a.provider_id as string, raw: a.raw as PlotaApplication }))
  console.log(`${labels.size} label(s) from "${LABELLER}", ${records.length} of them found`)

  let cache: Cached
  if (scoreOnly) {
    cache = JSON.parse(readFileSync(scoreOnly, 'utf8')) as Cached
    console.log(`scoring cached run: prompt ${cache.promptVersion}, classified ${cache.classifiedAt}`)
  } else {
    const todo = limit > 0 ? records.slice(0, limit) : records
    cache = { promptVersion: PLANNING_PROMPT_VERSION, model: model ?? 'default', classifiedAt: new Date().toISOString(), results: {} }
    let done = 0, spent = 0, failed = 0
    console.log(`classifying ${todo.length} record(s) under ${PLANNING_PROMPT_VERSION} on ${model ?? 'the default model'}`
      + (rpm > 0 ? `, paced to ${rpm} requests/min` : `, ${CONCURRENCY} at a time`) + '...')
    const pace = createPacer(rpm)
    // A record can take up to MAX_CLASSIFICATION_ATTEMPTS requests, so a per-minute cap has
    // to leave headroom for retries; ask for well under the true limit.
    await pool(todo, rpm > 0 ? Math.min(CONCURRENCY, 3) : CONCURRENCY, async (rec) => {
      const run = () => Promise.race([
        classifyWithOpenRouter(rec.raw, {
          apiKey: process.env.OPENROUTER_API_KEY!,
          model,
          signal: AbortSignal.timeout(90_000),
        }),
        // AbortSignal covers the request, not `await response.json()`. A body that never
        // finishes arriving hangs past the signal, so the whole record gets a deadline too.
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('record deadline exceeded')), 300_000).unref?.()),
      ])

      // A rate limit is the one failure worth retrying: unlike a schema miss it says "later",
      // not "no". The shared classifier fails fast on any non-ok response, deliberately, so
      // the waiting belongs here rather than in the code the real worker runs.
      const attempt = async (): Promise<Awaited<ReturnType<typeof classifyWithOpenRouter>>> => {
        for (let backoff = 0; ; backoff++) {
          try {
            await pace()
            return await run()
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            if (!/rate limit/i.test(message) || backoff >= 5) throw e
            const waitMs = 20_000 * 2 ** backoff
            console.log(`  rate limited, waiting ${Math.round(waitMs / 1000)}s`)
            await new Promise((r) => setTimeout(r, waitMs))
          }
        }
      }

      try {
        const r = await attempt()
        cache.results[rec.id] = { classification: r.classification }
        spent += r.costUsd ?? 0
      } catch (e) {
        cache.results[rec.id] = { error: e instanceof Error ? e.message : String(e) }
        failed++
      }
      // Checkpoint as we go. An earlier run stalled on its last four records with everything
      // held in memory, and killing it threw away 160 paid-for classifications.
      if (++done % 20 === 0) {
        console.log(`  ${done}/${todo.length}`)
        mkdirSync(dirname(outPath!), { recursive: true })
        writeFileSync(outPath!, JSON.stringify(cache, null, 2))
      }
    })
    mkdirSync(dirname(outPath!), { recursive: true })
    writeFileSync(outPath!, JSON.stringify(cache, null, 2))
    console.log(`\nwrote ${outPath} — ${done - failed} classified, ${failed} failed, $${spent.toFixed(5)} spent`)
    console.log('NOTE: this spend is not in planning_ai_usage; nothing was written to the database.')
  }

  const scored = records.filter((r) => labels.has(r.id) && cache.results[r.id]?.classification)
  const tuning = scored.filter((r) => !isHoldout(r.id))
  const held = scored.filter((r) => isHoldout(r.id))
  const set = showHoldout ? held : tuning
  console.log(`\n${'='.repeat(64)}`)
  console.log(showHoldout
    ? `HELD-OUT SET — ${held.length} records. Only meaningful once, at the end.`
    : `TUNING SET — ${tuning.length} records (${held.length} reserved, use --holdout to reveal)`)
  console.log('='.repeat(64))

  const rel: Array<{ human: string; model: string }> = []
  const com: Array<{ human: string; model: string }> = []
  const dwell: Array<{ human: number | null; model: number | null }> = []
  let gateCatches = 0, humanHigh = 0, gateFires = 0

  for (const r of set) {
    const label = labels.get(r.id)!
    const c = cache.results[r.id]!.classification!
    if (label.relevance !== 'skipped') rel.push({ human: label.relevance, model: c.relevance })
    if (label.creates) com.push({ human: label.creates, model: c.commercialSpace.creates })
    if (label.dwellings !== undefined) dwell.push({ human: label.dwellings, model: c.dwellings.count })
    const fires = shouldEscalate(c)
    if (fires) gateFires++
    if (label.relevance === 'high') { humanHigh++; if (fires) gateCatches++ }
  }

  confusion('RELEVANCE', rel, ['high', 'medium', 'low'])
  confusion('CREATES COMMERCIAL SPACE', com, ['yes', 'no', 'unclear'])

  console.log('\n--- DWELLING COUNT ---')
  if (dwell.length) {
    const big = (n: number | null) => n !== null && n >= MAJOR_HOUSING_DWELLINGS
    console.log(table([
      ['reading', 'count', 'of', 'rate'],
      ['exact match', String(dwell.filter((p) => p.human === p.model).length), String(dwell.length), ''],
      ['agrees on the 15+ cut', String(dwell.filter((p) => big(p.human) === big(p.model)).length), String(dwell.length), ''],
      ['model 0 where you said a number', String(dwell.filter((p) => p.model === 0 && p.human !== 0 && p.human !== null).length), String(dwell.length), ''],
      ['model null where you said 0', String(dwell.filter((p) => p.model === null && p.human === 0).length), String(dwell.length), ''],
    ]).split('\n').map((l) => '  ' + l).join('\n'))
  }

  // The number that decides the spend: of what the expert wants investigated, how much
  // reaches the paid pass, and how much of the paid pass is wasted on records they'd skip.
  console.log('\n--- ESCALATION GATE ---')
  console.log(table([
    ['reading', 'value'],
    [`records ${LABELLER} called high`, String(humanHigh)],
    ['of those, the gate catches', `${gateCatches} (${humanHigh ? ((gateCatches / humanHigh) * 100).toFixed(1) : '0'}%)`],
    ['records the gate fires on', String(gateFires)],
    ['of those, wanted by the expert', `${gateCatches} (${gateFires ? ((gateCatches / gateFires) * 100).toFixed(1) : '0'}%)`],
  ]).split('\n').map((l) => '  ' + l).join('\n'))
}
main()
