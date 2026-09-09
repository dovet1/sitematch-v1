/**
 * Score the model's judgements against human labels.
 *
 * Three things are measured, matching the three questions the labelling page asks and the
 * classifier v3 spec: relevance, whether commercial space is created, and how many homes.
 * The dwelling comparison carries a fourth reading that the other two cannot give -- a
 * count is checkable ground truth, where relevance is a judgement call.
 *
 * Labels come from the calibration Artifact's own store (a directory of JSON documents) or
 * from a CSV exported by the standalone page, or both mixed in one directory. Nothing here
 * generates a label: a record with no human judgement is reported as unlabelled, never assumed.
 *
 * Run from apps/web:
 *   npx tsx scripts/score-relevance-sample.ts              # database only
 *   npx tsx scripts/score-relevance-sample.ts <labels-dir>  # database plus files
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Labels arrive by two routes, because a collaborator outside the organisation cannot open
 * a db-backed artifact: a directory of JSON documents dumped from the artifact store, or a
 * CSV pasted back from the standalone page. Both carry the labeller, so both merge here.
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v !== '')) rows.push(row)
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Label = {
  relevance?: string
  createsCommercialSpace?: string
  /** null is "the application does not say"; 0 is "it says none". The distinction is the point. */
  dwellingCount?: number | null
  /** Retired with v3. Still read so labels from the v4 exercise are not silently dropped. */
  opportunityType?: string
  by?: string
}

/** An empty cell is "not stated", which is a real answer, so it must not become 0. */
function parseCount(raw: string | undefined | null): number | null | undefined {
  if (raw === undefined || raw === null) return undefined
  const s = String(raw).trim()
  if (s === '') return null
  return /^\d{1,5}$/.test(s) ? Number(s) : undefined
}

/**
 * Label documents are named `<labellerSlug>__<plotaProviderId>`, because the page has no
 * viewer identity to key on and two people share one sample. Splitting the id back out is
 * what lets each labeller be scored separately, and lets them be compared with each other.
 */
function loadLabels(dir: string): Map<string, Map<string, Label>> {
  const byLabeller = new Map<string, Map<string, Label>>()
  const walk = (path: string) => {
    for (const entry of readdirSync(path)) {
      const full = join(path, entry)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (entry.endsWith('.csv')) {
        for (const r of parseCsv(readFileSync(full, 'utf8'))) {
          const labeller = (r.labeller || 'unknown').trim()
          const recordId = (r.record_id || '').trim()
          if (!recordId) continue
          if (!byLabeller.has(labeller)) byLabeller.set(labeller, new Map())
          byLabeller.get(labeller)!.set(recordId, {
            relevance: r.relevance || undefined,
            createsCommercialSpace: r.creates_commercial_space || undefined,
            dwellingCount: parseCount(r.dwelling_count),
            opportunityType: r.opportunity_type || undefined,
            by: labeller,
          })
        }
        continue
      }
      if (!entry.endsWith('.json')) continue
      const docId = entry.replace(/\.json$/, '')
      const split = docId.indexOf('__')
      // A document with no separator predates namespacing; attribute it to "unknown"
      // rather than silently dropping a real human judgement.
      const labeller = split === -1 ? 'unknown' : docId.slice(0, split)
      const recordId = split === -1 ? docId : docId.slice(split + 2)
      try {
        const body = JSON.parse(readFileSync(full, 'utf8')) as Label
        if (!byLabeller.has(labeller)) byLabeller.set(labeller, new Map())
        byLabeller.get(labeller)!.set(recordId, body)
      } catch {
        console.warn(`skipped unreadable label file: ${full}`)
      }
    }
  }
  walk(dir)
  return byLabeller
}

function table(rows: string[][]) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)))
  return rows
    .map((r, ri) => {
      const line = r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ')
      return ri === 0 ? `${line}\n${widths.map((w) => '-'.repeat(w)).join('  ')}` : line
    })
    .join('\n')
}

function report(name: string, pairs: Array<{ human: string; model: string }>, classes: string[]) {
  console.log(`\n=== ${name} ===`)
  if (pairs.length === 0) { console.log('  no labelled records to score'); return }

  const agreed = pairs.filter((p) => p.human === p.model).length
  console.log(`  overall agreement: ${agreed}/${pairs.length} (${((agreed / pairs.length) * 100).toFixed(1)}%)\n`)

  console.log('  confusion — rows are your label, columns the model:')
  const header = ['human \\ model', ...classes, 'total']
  const body = classes.map((h) => {
    const row = pairs.filter((p) => p.human === h)
    return [h, ...classes.map((m) => String(row.filter((p) => p.model === m).length)), String(row.length)]
  })
  const totals = ['total', ...classes.map((m) => String(pairs.filter((p) => p.model === m).length)), String(pairs.length)]
  console.log(table([header, ...body, totals]).split('\n').map((l) => '  ' + l).join('\n'))

  console.log('\n  per class:')
  const stats = classes.map((c) => {
    const tp = pairs.filter((p) => p.model === c && p.human === c).length
    const predicted = pairs.filter((p) => p.model === c).length
    const actual = pairs.filter((p) => p.human === c).length
    const precision = predicted ? tp / predicted : NaN
    const recall = actual ? tp / actual : NaN
    const pct = (n: number) => (Number.isNaN(n) ? '—' : (n * 100).toFixed(1) + '%')
    return [c, String(actual), String(predicted), pct(precision), pct(recall)]
  })
  console.log(table([['class', 'yours', 'model', 'precision', 'recall'], ...stats]).split('\n').map((l) => '  ' + l).join('\n'))
}

/**
 * Dwelling counts are a number, not a class, so the categorical report says nothing useful
 * about them. Three readings matter, in increasing order of what they cost us:
 *
 *   exact      did the model read the same number off the page
 *   threshold  did it agree on the only cut the product acts on, 16 or more homes
 *   false zero did it write 0 where the application states no figure at all
 *
 * The last one is the specific regression this exercise exists to catch. Session 2 found
 * the model writing 0 for "not stated" at high confidence, which is indistinguishable from
 * a measured zero once stored and would be summed as one.
 */
function reportDwellings(pairs: Array<{ human: number | null; model: number | null }>) {
  console.log('\n=== DWELLING COUNT ===')
  if (pairs.length === 0) { console.log('  no records where both you and the model gave a count'); return }

  const same = (a: number | null, b: number | null) => a === b
  const exact = pairs.filter((p) => same(p.human, p.model)).length
  const big = (n: number | null) => n !== null && n >= 16
  const threshold = pairs.filter((p) => big(p.human) === big(p.model)).length
  const falseZero = pairs.filter((p) => p.human === null && p.model === 0).length
  const missedCount = pairs.filter((p) => p.human !== null && p.model === null).length

  const pct = (n: number) => ((n / pairs.length) * 100).toFixed(1) + '%'
  console.log(table([
    ['reading', 'count', 'of', 'rate'],
    ['exact match', String(exact), String(pairs.length), pct(exact)],
    ['agrees on the 16+ cut', String(threshold), String(pairs.length), pct(threshold)],
    ['model wrote 0 for "not stated"', String(falseZero), String(pairs.length), pct(falseZero)],
    ['model missed a count you found', String(missedCount), String(pairs.length), pct(missedCount)],
  ]).split('\n').map((l) => '  ' + l).join('\n'))

  const wrong = pairs.filter((p) => !same(p.human, p.model)).slice(0, 12)
  if (wrong.length) {
    console.log('\n  where the numbers differ:')
    for (const p of wrong) {
      const show = (n: number | null) => (n === null ? 'not stated' : String(n))
      console.log(`    you=${show(p.human).padEnd(10)} model=${show(p.model)}`)
    }
  }
}

/**
 * Read judgements posted by the standalone labelling page. Relabelling appends rather than
 * updates (the page holds insert-only rights), so the newest row per labeller and record
 * wins and earlier attempts are ignored.
 */
async function loadFromDb(): Promise<Map<string, Map<string, Label>>> {
  const byLabeller = new Map<string, Map<string, Label>>()

  const V3 = 'labeller,record_id,relevance,creates_commercial_space,dwelling_count,opportunity_type,submitted_at'
  const V4 = 'labeller,record_id,relevance,opportunity_type,submitted_at'

  // The v3 columns arrive with a migration the operator applies by hand, so this script has
  // to work on both sides of it: ask for them, and fall back to the older shape rather than
  // failing outright when they are not there yet.
  let rows: Array<Record<string, unknown>> | null = null
  for (const columns of [V3, V4]) {
    const { data, error } = await db
      .from('planning_label_submissions')
      .select(columns)
      .order('submitted_at', { ascending: true })
    if (!error) { rows = (data ?? []) as unknown as Array<Record<string, unknown>>; break }
    const code = (error as { code?: string }).code
    if (code === '42P01') {
      console.log('(no planning_label_submissions table yet — reading files only)')
      return byLabeller
    }
    // 42703 is an unknown column; PGRST204 is PostgREST saying the same from its cache.
    if (columns === V3 && (code === '42703' || code === 'PGRST204')) {
      console.log('(planning_label_submissions predates the v3 columns — apply 20260919000000 to collect them)')
      continue
    }
    throw error
  }
  for (const r of rows ?? []) {
    const labeller = String(r.labeller)
    if (!byLabeller.has(labeller)) byLabeller.set(labeller, new Map())
    // A row from the v4 exercise has no answer to either new question, and its null
    // dwelling_count means "never asked" rather than "the application does not say". The
    // v3 page always sends creates_commercial_space, so its presence separates the two.
    const askedNewQuestions = r.creates_commercial_space !== null && r.creates_commercial_space !== undefined
    byLabeller.get(labeller)!.set(String(r.record_id), {
      relevance: r.relevance ? String(r.relevance) : undefined,
      createsCommercialSpace: askedNewQuestions ? String(r.creates_commercial_space) : undefined,
      dwellingCount: !askedNewQuestions
        ? undefined
        : (r.dwelling_count === null || r.dwelling_count === undefined ? null : Number(r.dwelling_count)),
      opportunityType: r.opportunity_type ? String(r.opportunity_type) : undefined,
      by: labeller,
    })
  }
  return byLabeller
}

async function main() {
  const dir = process.argv[2]
  const byLabeller = await loadFromDb()
  const fromDb = [...byLabeller.values()].reduce((n, m) => n + m.size, 0)
  if (fromDb > 0) console.log(`${fromDb} judgement(s) read from planning_label_submissions`)

  if (dir) {
    // A directory can still be merged in: artifact-store dumps, or a CSV pasted back by
    // someone whose posts never reached the database.
    for (const [labeller, labels] of loadLabels(dir)) {
      if (!byLabeller.has(labeller)) byLabeller.set(labeller, new Map())
      const target = byLabeller.get(labeller)!
      for (const [recordId, label] of labels) if (!target.has(recordId)) target.set(recordId, label)
    }
  }

  const total = [...byLabeller.values()].reduce((n, m) => n + m.size, 0)
  if (total === 0) {
    console.log('no labels found — nothing to score yet.')
    return
  }
  console.log(`scoring ${total} judgement(s) from ${byLabeller.size} labeller(s): ${[...byLabeller.keys()].join(', ')}`)

  const { data: apps, error } = await db
    .from('planning_applications')
    .select('id,provider_id,reference,authority_name,description')
    .eq('intelligence_tier', true)
  if (error) throw error

  const { data: runs } = await db
    .from('planning_classification_runs')
    .select('planning_application_id,output,prompt_version,finished_at')
    .eq('status', 'complete')
    .order('finished_at', { ascending: true })

  /**
   * v5 answers the two new questions directly. v4 answers neither, but it does emit
   * dwelling observations, so a count can still be recovered from those and scored -- which
   * is what gives v5 a baseline to beat rather than a blank column.
   */
  function modelDwellings(o: Record<string, unknown>): number | null | undefined {
    const direct = o.dwellings as { count?: unknown } | undefined
    if (direct && typeof direct === 'object' && 'count' in direct) {
      const c = direct.count
      return c === null ? null : (typeof c === 'number' ? c : undefined)
    }
    const observations = Array.isArray(o.observations) ? (o.observations as Array<Record<string, unknown>>) : []
    const dwelling = observations.filter((x) => x.metric === 'dwellings' && typeof x.value === 'number')
    if (dwelling.length === 0) return observations.length > 0 ? null : undefined
    // Prefer what the scheme proposes over a bare stated figure of unspecified scope.
    const proposed = dwelling.find((x) => x.scope === 'proposed') ?? dwelling[0]
    return proposed.value as number
  }

  type ModelVerdict = {
    relevance: string
    opportunityType: string
    createsCommercialSpace: string | undefined
    dwellingCount: number | null | undefined
    promptVersion: string
  }
  const latest = new Map<string, ModelVerdict>()
  for (const r of runs ?? []) {
    const o = r.output as Record<string, unknown> | null
    if (!o) continue
    const commercial = o.commercialSpace as { creates?: unknown } | undefined
    latest.set(r.planning_application_id as string, {
      relevance: String(o.relevance),
      opportunityType: String(o.opportunityType),
      createsCommercialSpace: commercial && typeof commercial === 'object' && commercial.creates
        ? String(commercial.creates)
        : undefined,
      dwellingCount: modelDwellings(o),
      promptVersion: String(r.prompt_version),
    })
  }

  const promptVersions = new Set<string>()

  for (const [labeller, labels] of byLabeller) {
    console.log(`\n\n${'#'.repeat(70)}\n# LABELLER: ${labeller}\n${'#'.repeat(70)}`)

    const relevancePairs: Array<{ human: string; model: string }> = []
    const commercialPairs: Array<{ human: string; model: string }> = []
    const dwellingPairs: Array<{ human: number | null; model: number | null }> = []
    const opportunityPairs: Array<{ human: string; model: string }> = []
    const disagreements: Array<{ reference: string; authority: string; human: string; model: string; description: string }> = []
    let unlabelled = 0, skipped = 0, noVerdict = 0

    for (const a of apps ?? []) {
      const label = labels.get(a.provider_id as string)
      const model = latest.get(a.id as string)
      if (!label) { unlabelled++; continue }
      if (label.relevance === 'skipped') { skipped++; continue }
      if (!model) { noVerdict++; continue }
      promptVersions.add(model.promptVersion)

      if (label.relevance) {
        relevancePairs.push({ human: label.relevance, model: model.relevance })
        if (label.relevance !== model.relevance) {
          disagreements.push({
            reference: a.reference as string,
            authority: a.authority_name as string,
            human: label.relevance,
            model: model.relevance,
            description: String(a.description).slice(0, 100),
          })
        }
      }
      if (label.createsCommercialSpace && model.createsCommercialSpace) {
        commercialPairs.push({ human: label.createsCommercialSpace, model: model.createsCommercialSpace })
      }
      // `undefined` on either side means the question was never asked of that side, which is
      // not a disagreement. `null` means it was asked and the answer is "not stated".
      if (label.dwellingCount !== undefined && model.dwellingCount !== undefined) {
        dwellingPairs.push({ human: label.dwellingCount, model: model.dwellingCount })
      }
      if (label.opportunityType && model.opportunityType && model.opportunityType !== 'undefined') {
        opportunityPairs.push({ human: label.opportunityType, model: model.opportunityType })
      }
    }

    console.log(`unlabelled: ${unlabelled} | skipped: ${skipped} | labelled but no model verdict: ${noVerdict}`)
    report('RELEVANCE', relevancePairs, ['high', 'medium', 'low'])
    report('CREATES COMMERCIAL SPACE', commercialPairs, ['yes', 'no', 'unclear'])
    reportDwellings(dwellingPairs)
    // Retired in v3. Reported only where labels from the v4 exercise still line up with a
    // v4 verdict, so the earlier work is not thrown away.
    if (opportunityPairs.length > 0) {
      report('OPPORTUNITY TYPE (retired)', opportunityPairs, [
        'new_space', 'change_of_use', 'subdivision', 'commercial_loss',
        'residential_scheme', 'mixed_use', 'other',
      ])
    }

    if (disagreements.length) {
      console.log(`\n=== RELEVANCE DISAGREEMENTS (${disagreements.length}) ===`)
      // Over-rating reads first: it is the failure that wastes a reviewer's time.
      const rank: Record<string, number> = { high: 3, medium: 2, low: 1 }
      disagreements
        .sort((a, b) => (rank[b.model] - rank[b.human]) - (rank[a.model] - rank[a.human]))
        .slice(0, 20)
        .forEach((d) => {
          console.log(`\n  ${labeller}=${d.human.padEnd(6)} model=${d.model.padEnd(6)} ${d.reference} (${d.authority})`)
          console.log(`    ${d.description}`)
        })
    }
  }

  console.log(`\n\nscored against prompt version(s): ${[...promptVersions].join(', ') || 'none'}`)

  // Where two people judged the same record, how often do THEY agree? This bounds what the
  // model can be expected to reach: a class the humans dispute is not a class it can nail.
  const names = [...byLabeller.keys()]
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = byLabeller.get(names[i])!, b = byLabeller.get(names[j])!
      const shared = [...a.keys()].filter((k) => b.has(k))
      const usable = shared.filter((k) => a.get(k)!.relevance !== 'skipped' && b.get(k)!.relevance !== 'skipped')
      if (usable.length === 0) continue
      // An empty denominator is "neither of you was asked", which a 0.0% would misreport.
      const rate = (n: number, of: number) => (of === 0 ? 'no records judged by both' : `${n}/${of} (${((n / of) * 100).toFixed(1)}%)`)
      const relAgree = usable.filter((k) => a.get(k)!.relevance === b.get(k)!.relevance).length
      const bothCommercial = usable.filter((k) => a.get(k)!.createsCommercialSpace && b.get(k)!.createsCommercialSpace)
      const comAgree = bothCommercial.filter((k) => a.get(k)!.createsCommercialSpace === b.get(k)!.createsCommercialSpace).length
      const bothCount = usable.filter((k) => a.get(k)!.dwellingCount !== undefined && b.get(k)!.dwellingCount !== undefined)
      const cntAgree = bothCount.filter((k) => a.get(k)!.dwellingCount === b.get(k)!.dwellingCount).length
      console.log(`\n=== INTER-RATER: ${names[i]} vs ${names[j]} (${usable.length} records judged by both) ===`)
      console.log('  This is the ceiling. A question the two of you dispute is not one the model can be held to.')
      console.log(`  relevance:                ${rate(relAgree, usable.length)}`)
      console.log(`  creates commercial space: ${rate(comAgree, bothCommercial.length)}`)
      console.log(`  dwelling count:           ${rate(cntAgree, bothCount.length)}`)
      const clashes = usable.filter((k) => a.get(k)!.relevance !== b.get(k)!.relevance)
      if (clashes.length) {
        console.log(`\n  records the two of you judged differently:`)
        for (const k of clashes.slice(0, 15)) {
          const app = (apps ?? []).find((x) => x.provider_id === k)
          console.log(`    ${names[i]}=${a.get(k)!.relevance} ${names[j]}=${b.get(k)!.relevance}  ${app?.reference ?? k}`)
          if (app) console.log(`      ${String(app.description).slice(0, 96)}`)
        }
      }
    }
  }
}

main()
