/**
 * Backtest for Brand Matcher demographic fit (migrations 20261023000000 and 20261023020000).
 * Answers: does a fascia's town profile pick out the towns it really trades in, compared with
 * towns of the same size? The method is documented in
 * src/app/sitematcher-unified/lib/brand-matcher-demographics-backtest.ts.
 *
 * Read-only. Needs rebuild_all_demographics() to have run (the ranks and profiles tables are not
 * read — both are rebuilt here from training towns only). Run from apps/web:
 *   npm run backtest:brand-demographics -- [--level fascia|brand] [--holdout 0.2]
 *     [--negatives 300] [--min-towns 12] [--out results.json]
 */

import { writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { percentileCont } from '../src/app/sitematcher-unified/lib/brand-matcher-demographics'
import {
  VARIANTS,
  runBacktest,
  type BandCounts,
  type UnitResult,
} from '../src/app/sitematcher-unified/lib/brand-matcher-demographics-backtest'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const options = {
  level: arg('level') === 'brand' ? ('brand' as const) : ('fascia' as const),
  holdout: Number(arg('holdout') ?? 0.2),
  negativesPerUnit: Number(arg('negatives') ?? 300),
  minTowns: Number(arg('min-towns') ?? 12),
}
const outPath = arg('out')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PAGE = 1000

// PostgREST caps a response at 1000 rows; page so nothing is silently cut.
async function selectAll<T>(build: () => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return rows
  }
}

const pct = (n: number, d: number) => `${((100 * n) / (d || 1)).toFixed(0)}%`

function bandLine(b: BandCounts): string {
  const n = b.good + b.partial + b.weak
  return `good ${pct(b.good, n)}, partial ${pct(b.partial, n)}, weak ${pct(b.weak, n)}`
}

async function main() {
  console.log('Loading presence, signals and names…')
  const [presence, signalRows, brands, fascias, located] = await Promise.all([
    selectAll<{ brand_id: string; fascia_id: string | null; bua_gsscode: string; store_count: number }>(() =>
      supabase.rpc('brand_bua_presence').order('brand_id').order('fascia_id').order('bua_gsscode')
    ),
    selectAll<{ bua_gsscode: string; signal_name: string; signal_category: string; value: number }>(() =>
      supabase
        .from('brand_matcher_bua_signals')
        .select('bua_gsscode, signal_name, signal_category, value')
        .order('bua_gsscode')
        .order('signal_name')
    ),
    selectAll<{ id: string; name: string }>(() => supabase.from('brands').select('id, name').order('id')),
    selectAll<{ id: string; name: string }>(() => supabase.from('fascias').select('id, name').order('id')),
    supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .not('brand_id', 'is', null)
      .not('location', 'is', null),
  ])
  if (located.error) throw located.error

  const result = runBacktest(
    presence.map((p) => ({
      brandId: p.brand_id,
      fasciaId: p.fascia_id,
      buaGsscode: p.bua_gsscode,
      storeCount: Number(p.store_count),
    })),
    signalRows.map((r) => ({
      buaGsscode: r.bua_gsscode,
      signalName: r.signal_name,
      signalCategory: r.signal_category,
      value: Number(r.value),
    })),
    options
  )

  // How much of the estate the method can see at all. Stores outside every town (retail parks
  // beyond a boundary) and in Scotland / Northern Ireland are invisible to it.
  console.log(
    `Located stores: ${located.count ?? '?'}; in a town with demographics: ${result.storesInScoredTowns}` +
      (located.count ? ` (${pct(result.storesInScoredTowns, located.count)})` : '')
  )
  console.log(`Towns with demographics: ${result.towns}`)
  console.log(
    `${options.level === 'fascia' ? 'Fascias' : 'Brands'} scored: ${result.units.length}; ` +
      `skipped (< ${options.minTowns} towns): ${result.skipped}\n`
  )

  // demographics: the fit score against towns of the same size. size: town size alone.
  const broad = result.units.filter((r) => r.broad).length
  for (const v of VARIANTS) {
    const values = result.units
      .map((r) => r.auc[v])
      .filter((a): a is number => a != null)
      .sort((a, z) => a - z)
    if (values.length === 0) {
      console.log(`${v.padEnd(13)} nothing scorable`)
      continue
    }
    const atLeast = (min: number) => pct(values.filter((a) => a >= min).length, values.length)
    console.log(
      `${v.padEnd(13)} AUC median ${percentileCont(values, 0.5).toFixed(3)}` +
        `  IQR ${percentileCont(values, 0.25).toFixed(3)}–${percentileCont(values, 0.75).toFixed(3)}` +
        `  ≥0.6: ${atLeast(0.6)}  ≥0.7: ${atLeast(0.7)}  (${values.length} scored)`
    )
  }
  console.log(`${broad} trade in towns that are typical for their size on every measure (good fit anywhere)`)

  // The figure anyone can read: how often each band goes to real towns vs other towns.
  const total = (pick: (r: UnitResult) => BandCounts) =>
    result.units.reduce<BandCounts>(
      (acc, r) => {
        const b = pick(r)
        return { good: acc.good + b.good, partial: acc.partial + b.partial, weak: acc.weak + b.weak }
      },
      { good: 0, partial: 0, weak: 0 }
    )
  console.log(`\nHeld-back towns they trade in:           ${bandLine(total((r) => r.bandsHeldOut))}`)
  console.log(`Same-size towns they do not trade in:    ${bandLine(total((r) => r.bandsOther))}`)

  const brandName = new Map(brands.map((b) => [b.id, b.name]))
  const fasciaName = new Map(fascias.map((f) => [f.id, f.name]))
  const name = (r: UnitResult) => {
    const brand = brandName.get(r.brandId) ?? r.brandId
    return r.fasciaId ? `${brand} — ${fasciaName.get(r.fasciaId) ?? r.fasciaId}` : brand
  }
  const ranked = result.units
    .filter((r) => r.auc.demographics != null)
    .sort((a, z) => (z.auc.demographics as number) - (a.auc.demographics as number))
  const line = (r: UnitResult) =>
    `  ${(r.auc.demographics as number).toFixed(3)}  size only ${r.auc.size?.toFixed(3) ?? '  —  '}  ` +
    `${name(r)} (${r.towns} towns) [${r.topSignals.join(', ')}]`
  console.log('\nBest separated:')
  ranked.slice(0, 15).forEach((r) => console.log(line(r)))
  console.log('\nWorst separated:')
  ranked.slice(-15).forEach((r) => console.log(line(r)))

  if (outPath) {
    writeFileSync(outPath, JSON.stringify({ options, ...result, units: result.units.map((r) => ({ ...r, name: name(r) })) }, null, 2))
    console.log(`\nWrote ${outPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
