// Backtest for Brand Matcher demographic fit. Pure — scripts/backtest-brand-demographics.ts loads
// the rows and prints the result.
//
// For each fascia (or brand), hold back a share of its towns, build the profile from the rest, and
// score the held-back towns against retail towns it does not trade in. AUC is the chance a real
// town outscores one it is not in: 0.5 is a coin toss, 0.7+ is a useful signal.
//
// Three variants separate demographics from town size, which might be doing all the work:
//   all          — every signal, as the product will score
//   population   — town size alone
//   demographics — every signal except town size

import {
  MIN_PROFILE_BUAS,
  auc,
  buildProfile,
  buildSignalTable,
  demographicFit,
  type DemographicFitBand,
  type DemographicSignalProfile,
  type SignalTable,
  type SiteSignals,
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
}

export type Variant = 'all' | 'population' | 'demographics'
export const VARIANTS: Variant[] = ['all', 'population', 'demographics']

export type BandCounts = Record<DemographicFitBand, number>

export interface UnitResult {
  key: string
  brandId: string
  fasciaId: string | null
  towns: number
  // null when the variant could not be scored; see `broad`.
  auc: Record<Variant, number | null>
  // Nothing in the profile sets this unit's towns apart, so every town is a good fit.
  broad: Record<Variant, boolean>
  topSignals: string[]
  bandsHeldOut: BandCounts
  bandsOther: BandCounts
}

export interface BacktestResult {
  retailTowns: number
  storesInScoredTowns: number
  skipped: number
  units: UnitResult[]
}

// Deterministic 0..1 from a string, so a rerun splits the same way. FNV-1a, then the murmur3
// finaliser: FNV alone leaves the high bits nearly unchanged between codes that differ only in the
// last character (E00000001, E00000002…), which would put runs of towns on the same side.
export function hash01(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 0x100000000
}

function forVariant(profile: DemographicSignalProfile[], v: Variant): DemographicSignalProfile[] {
  if (v === 'population') return profile.filter((p) => p.category === 'population')
  if (v === 'demographics') return profile.filter((p) => p.category !== 'population')
  return profile
}

const emptyBands = (): BandCounts => ({ good: 0, partial: 0, weak: 0 })

export function runBacktest(
  presence: PresenceRow[],
  signalRows: SignalRow[],
  options: BacktestOptions
): BacktestResult {
  // Signals ranked over retail towns (any town with a store) — the rebuild's baseline.
  const retailTowns = new Set(presence.map((p) => p.buaGsscode))
  const raw = new Map<string, { category: string; values: Map<string, number> }>()
  const byTown = new Map<string, SiteSignals>()
  for (const r of signalRows) {
    const site = byTown.get(r.buaGsscode) ?? {}
    site[r.signalName] = r.value
    byTown.set(r.buaGsscode, site)
    if (!retailTowns.has(r.buaGsscode)) continue
    const entry = raw.get(r.signalName) ?? { category: r.signalCategory, values: new Map() }
    entry.values.set(r.buaGsscode, r.value)
    raw.set(r.signalName, entry)
  }
  const signals = new Map<string, SignalTable>()
  raw.forEach((e, name) => signals.set(name, buildSignalTable(e.category, e.values)))
  const scoredTowns = Array.from(retailTowns).filter((t) => byTown.has(t))

  const units = new Map<string, { brandId: string; fasciaId: string | null; towns: Set<string> }>()
  let storesInScoredTowns = 0
  for (const p of presence) {
    if (!byTown.has(p.buaGsscode)) continue
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
    const negatives = scoredTowns
      .filter((t) => !unit.towns.has(t))
      .map((t) => ({ t, h: hash01(`${key}|neg|${t}`) }))
      .sort((a, z) => a.h - z.h)
      .slice(0, options.negativesPerUnit)
      .map((x) => x.t)

    const profile = buildProfile(train, signals)
    const result: UnitResult = {
      key,
      brandId: unit.brandId,
      fasciaId: unit.fasciaId,
      towns: unit.towns.size,
      auc: { all: null, population: null, demographics: null },
      broad: { all: false, population: false, demographics: false },
      topSignals: [],
      bandsHeldOut: emptyBands(),
      bandsOther: emptyBands(),
    }
    for (const v of VARIANTS) {
      const p = forVariant(profile, v)
      const pos = test.map((t) => demographicFit(byTown.get(t) ?? null, p))
      const neg = negatives.map((t) => demographicFit(byTown.get(t) ?? null, p))
      if (pos.some((f) => f?.basis === 'broad')) {
        result.broad[v] = true
        continue
      }
      const a = auc(
        pos.flatMap((f) => (f ? [f.score] : [])),
        neg.flatMap((f) => (f ? [f.score] : []))
      )
      result.auc[v] = Number.isFinite(a) ? a : null
      if (v === 'all') {
        result.topSignals = pos.find((f) => f)?.signals.map((s) => s.signalName) ?? []
        pos.forEach((f) => f && result.bandsHeldOut[f.band]++)
        neg.forEach((f) => f && result.bandsOther[f.band]++)
      }
    }
    results.push(result)
  })

  return { retailTowns: scoredTowns.length, storesInScoredTowns, skipped, units: results }
}
