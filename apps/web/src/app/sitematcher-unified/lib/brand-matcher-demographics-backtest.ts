// Backtest for Brand Matcher demographic fit. Pure — scripts/backtest-brand-demographics.ts loads
// the rows and prints the result. brand_demographic_backtest() (migration 20261023060000) runs the
// same backtest inside the database; the two agree unit for unit.
//
// Five-fold: each fascia's (or brand's) towns are dealt into five folds. For each fold, the profile
// is built from the other four and the fold's towns are scored against towns the unit is not in, so
// every town is tested exactly once. A single 20% hold-out tested only 15-20 towns, and the score
// swung with which towns happened to be held back (Safestore's one estate scored 0.33 one way and
// 0.69 the other); pooling all five folds steadies it. AUC is the chance a real town outscores one
// the unit is not in, over all pairs within the same fold: 0.5 is a coin toss, 0.7+ is useful.
//
// Two measurements:
//   demographics — the fit score, against towns drawn from the same size bands as the tested
//                  towns. Size cannot help here, so this is what demographics alone add.
//   size         — town size alone, against towns of any size: how much size by itself separates.

import { createHash } from 'crypto'
import {
  MIN_PROFILE_BUAS,
  SIZE_BANDS,
  SIZE_SIGNAL,
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
  folds: number
  negativesPerUnit: number
  minTowns: number
  sizeBands?: SizeBandRules
}

export const DEFAULT_FOLDS = 5

export type Variant = 'demographics' | 'size'
export const VARIANTS: Variant[] = ['demographics', 'size']

export type BandCounts = Record<DemographicFitBand, number>

export interface UnitResult {
  key: string
  brandId: string
  fasciaId: string | null
  towns: number
  // Towns scored across all folds (a fold with too few training towns is skipped).
  tested: number
  // null when the variant could not be scored (for demographics: see `broad`).
  auc: Record<Variant, number | null>
  // In no fold did anything set this unit's towns apart for their size.
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

// Wins (ties half) and pair count for positives against negatives.
function pairs(positives: number[], negatives: number[]): { wins: number; total: number } {
  let wins = 0
  for (const p of positives) for (const n of negatives) wins += n < p ? 1 : n === p ? 0.5 : 0
  return { wins, total: positives.length * negatives.length }
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
  bands.forEach((band, t) => {
    const list = townsInBand.get(band) ?? []
    list.push(t)
    townsInBand.set(band, list)
  })

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
    if (unit.towns.size < options.minTowns) {
      skipped++
      return
    }
    // Deal towns into folds; a fold is tested only when the other folds leave enough to profile.
    const fold = new Map<string, number>()
    unit.towns.forEach((t) => fold.set(t, Math.floor(hash01(`${key}|${t}`) * options.folds)))
    const folds = Array.from({ length: options.folds }, (_, k) => {
      const test = Array.from(unit.towns).filter((t) => fold.get(t) === k)
      const train = Array.from(unit.towns).filter((t) => fold.get(t) !== k)
      return { k, test, train }
    }).filter((f) => f.test.length >= 1 && f.train.length >= MIN_PROFILE_BUAS)
    if (folds.length === 0) {
      skipped++
      return
    }
    const tested = folds.reduce((s, f) => s + f.test.length, 0)
    const perTown = Math.ceil(options.negativesPerUnit / tested)
    const anySize = byHash(
      `${key}|any`,
      towns.filter((t) => !unit.towns.has(t))
    ).slice(0, options.negativesPerUnit)

    const result: UnitResult = {
      key,
      brandId: unit.brandId,
      fasciaId: unit.fasciaId,
      towns: unit.towns.size,
      tested,
      auc: { demographics: null, size: null },
      broad: true,
      topSignals: [],
      bandsHeldOut: emptyBands(),
      bandsOther: emptyBands(),
    }
    let demo = { wins: 0, total: 0 }
    let size = { wins: 0, total: 0 }
    for (const f of folds) {
      const profile = buildProfile(f.train, tables)
      const fit = (t: string) => demographicFit(site.get(t) ?? null, profile)

      const sizeFit = (t: string) => fit(t)?.size?.fit
      const s = pairs(
        f.test.flatMap((t) => sizeFit(t) ?? []),
        anySize.flatMap((t) => sizeFit(t) ?? [])
      )
      size = { wins: size.wins + s.wins, total: size.total + s.total }

      const pos = f.test.map(fit)
      if (pos.some((x) => x?.basis === 'broad')) continue
      if (result.broad) {
        result.broad = false
        result.topSignals = pos.find((x) => x)?.signals.map((x) => x.signalName) ?? []
      }
      // Size-matched: for each tested town, towns from its own size band the unit is not in.
      const matched = new Set<string>()
      for (const t of f.test) {
        const pool = (townsInBand.get(bands.get(t) as number) ?? []).filter((x) => !unit.towns.has(x))
        byHash(`${key}|neg|${t}`, pool)
          .slice(0, perTown)
          .forEach((x) => matched.add(x))
      }
      const neg = Array.from(matched).map(fit)
      const d = pairs(
        pos.flatMap((x) => (x ? [x.score] : [])),
        neg.flatMap((x) => (x ? [x.score] : []))
      )
      demo = { wins: demo.wins + d.wins, total: demo.total + d.total }
      pos.forEach((x) => x && result.bandsHeldOut[x.band]++)
      neg.forEach((x) => x && result.bandsOther[x.band]++)
    }
    result.auc.demographics = demo.total > 0 ? demo.wins / demo.total : null
    result.auc.size = size.total > 0 ? size.wins / size.total : null
    results.push(result)
  })

  return { towns: towns.length, storesInScoredTowns, skipped, units: results }
}
