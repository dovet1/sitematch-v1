// Backtest for Brand Matcher demographic fit. Pure — scripts/backtest-brand-demographics.ts loads
// the rows and prints the result. brand_demographic_backtest() (migration 20261023040000) runs the
// same backtest inside the database; the two agree unit for unit.
//
// For each fascia (or brand), hold back a share of its towns, build the profile from the rest, and
// score the held-back towns against towns it does not trade in. AUC is the chance a real town
// outscores one it is not in: 0.5 is a coin toss, 0.7+ is a useful signal.
//
// Two measurements:
//   demographics — the fit score, against towns drawn from the same size bands as the held-back
//                  towns. Size cannot help here, so this is what demographics alone add.
//   size         — town size alone, against towns of any size: how much size by itself separates.

import { createHash } from 'crypto'
import {
  MIN_PROFILE_BUAS,
  SIZE_BANDS,
  SIZE_SIGNAL,
  auc,
  buildProfile,
  buildSignalTables,
  demographicFit,
  siteTown,
  sizeBands,
  type DemographicFitBand,
  type SiteTown,
  type SizeBandRules,
} from './brand-matcher-demographics'

export interface PresenceRow {
  brandId: string
  fasciaId: string | null
  buaGsscode: string
  storeCount: number
}

export interface SignalRow {
  buaGsscode: string
  signalName: string
  signalCategory: string
  value: number
}

export interface BacktestOptions {
  level: 'fascia' | 'brand'
  holdout: number
  negativesPerUnit: number
  minTowns: number
  sizeBands?: SizeBandRules
}

export type Variant = 'demographics' | 'size'
export const VARIANTS: Variant[] = ['demographics', 'size']

export type BandCounts = Record<DemographicFitBand, number>

export interface UnitResult {
  key: string
  brandId: string
  fasciaId: string | null
  towns: number
  // null when the variant could not be scored (for demographics: see `broad`).
  auc: Record<Variant, number | null>
  // Nothing sets this unit's towns apart for their size, so every town is a good fit.
  broad: boolean
  topSignals: string[]
  bandsHeldOut: BandCounts
  bandsOther: BandCounts
}

export interface BacktestResult {
  towns: number
  storesInScoredTowns: number
  skipped: number
  units: UnitResult[]
}

// Deterministic 0..1 from a string, so a rerun splits the same way: the first 32 bits of its md5.
// brand_matcher_hash01() in SQL computes the same value, so the database backtest and this one
// split towns identically.
export function hash01(s: string): number {
  return parseInt(createHash('md5').update(s, 'utf8').digest('hex').slice(0, 8), 16) / 0x100000000
}

const emptyBands = (): BandCounts => ({ good: 0, partial: 0, weak: 0 })

function byHash(key: string, towns: string[]): string[] {
  return towns
    .map((t) => ({ t, h: hash01(`${key}|${t}`) }))
    .sort((a, z) => a.h - z.h)
    .map((x) => x.t)
}

export function runBacktest(
  presence: PresenceRow[],
  signalRows: SignalRow[],
  options: BacktestOptions
): BacktestResult {
  const rules = options.sizeBands ?? SIZE_BANDS
  const raw = new Map<string, { category: string; values: Map<string, number> }>()
  for (const r of signalRows) {
    const entry = raw.get(r.signalName) ?? { category: r.signalCategory, values: new Map() }
    entry.values.set(r.buaGsscode, r.value)
    raw.set(r.signalName, entry)
  }
  const tables = buildSignalTables(raw, rules)
  const bands = sizeBands(tables.get(SIZE_SIGNAL)!.values, rules)
  const towns = Array.from(bands.keys())
  const site = new Map<string, SiteTown>()
  for (const t of towns) {
    const s = siteTown(t, tables)
    if (s) site.set(t, s)
  }
  const townsInBand = new Map<number, string[]>()
  bands.forEach((band, t) => townsInBand.set(band, [...(townsInBand.get(band) ?? []), t]))

  const units = new Map<string, { brandId: string; fasciaId: string | null; towns: Set<string> }>()
  let storesInScoredTowns = 0
  for (const p of presence) {
    if (!bands.has(p.buaGsscode)) continue
    storesInScoredTowns += p.storeCount
    if (options.level === 'fascia' && !p.fasciaId) continue
    const fasciaId = options.level === 'fascia' ? p.fasciaId : null
    const key = fasciaId ? `${p.brandId}/${fasciaId}` : p.brandId
    const unit = units.get(key) ?? { brandId: p.brandId, fasciaId, towns: new Set<string>() }
    unit.towns.add(p.buaGsscode)
    units.set(key, unit)
  }

  const results: UnitResult[] = []
  let skipped = 0
  units.forEach((unit, key) => {
    const train: string[] = []
    const test: string[] = []
    unit.towns.forEach((t) => (hash01(`${key}|${t}`) < options.holdout ? test : train).push(t))
    if (unit.towns.size < options.minTowns || train.length < MIN_PROFILE_BUAS || test.length < 2) {
      skipped++
      return
    }

    // Size-matched: for each held-back town, towns from its own size band the unit is not in.
    const perTown = Math.ceil(options.negativesPerUnit / test.length)
    const matched = new Set<string>()
    for (const t of test) {
      const pool = (townsInBand.get(bands.get(t) as number) ?? []).filter((x) => !unit.towns.has(x))
      byHash(`${key}|neg|${t}`, pool)
        .slice(0, perTown)
        .forEach((x) => matched.add(x))
    }
    const anySize = byHash(
      `${key}|any`,
      towns.filter((t) => !unit.towns.has(t))
    ).slice(0, options.negativesPerUnit)

    const profile = buildProfile(train, tables)
    const fit = (t: string) => demographicFit(site.get(t) ?? null, profile)
    const pos = test.map(fit)
    const neg = Array.from(matched).map(fit)

    const result: UnitResult = {
      key,
      brandId: unit.brandId,
      fasciaId: unit.fasciaId,
      towns: unit.towns.size,
      auc: { demographics: null, size: null },
      broad: pos.some((f) => f?.basis === 'broad'),
      topSignals: pos.find((f) => f)?.signals.map((s) => s.signalName) ?? [],
      bandsHeldOut: emptyBands(),
      bandsOther: emptyBands(),
    }
    if (!result.broad) {
      const a = auc(
        pos.flatMap((f) => (f ? [f.score] : [])),
        neg.flatMap((f) => (f ? [f.score] : []))
      )
      result.auc.demographics = Number.isFinite(a) ? a : null
      pos.forEach((f) => f && result.bandsHeldOut[f.band]++)
      neg.forEach((f) => f && result.bandsOther[f.band]++)
    }
    const sizeFit = (t: string) => fit(t)?.size?.fit
    const s = auc(
      test.flatMap((t) => sizeFit(t) ?? []),
      anySize.flatMap((t) => sizeFit(t) ?? [])
    )
    result.auc.size = Number.isFinite(s) ? s : null
    results.push(result)
  })

  return { towns: towns.length, storesInScoredTowns, skipped, units: results }
}
