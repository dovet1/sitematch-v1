// Brand Matcher demographic fit: does the town a site is in look like the towns a brand already
// trades in? Pure — the route will score with it and the backtest script measures it.
//
// "Town" is the ONS built-up area (BUA). A brand's profile is the spread (p10..p90) of each
// demographic signal across its towns, built by rebuild_brand_demographic_profiles()
// (migration 20261023000000). The site's town is scored against the signals that set the brand
// apart from a typical retail town; a brand whose towns are typical on every signal trades
// anywhere, so any town fits it.
//
// Phase 1: shown as a pill only, never added to the match score, until the backtest shows it
// predicts where brands trade.

// Kept in step with brand_demographic_profiles_min_buas in the migration.
export const MIN_PROFILE_BUAS = 8
// A signal counts as part of a brand's character when its towns' median rank is at least this far
// from the middle (0.3 = the median town sits in the top or bottom 35% of retail towns).
export const MIN_DISTINCTIVENESS = 0.3
// Read at most this many signals, one per category: affluence_high and affluence_low are the same
// fact twice, and counting both would double its weight.
export const MAX_FIT_SIGNALS = 4
export const GOOD_FIT = 0.75
export const PARTIAL_FIT = 0.5

export interface DemographicSignalProfile {
  signalName: string
  category: string
  buaCount: number
  p10: number
  p25: number
  median: number
  p75: number
  p90: number
  medianRank: number
  distinctiveness: number
}

// Signal name -> value for the site's town (index score, or people for 'population').
export type SiteSignals = Record<string, number>

export type DemographicFitBand = 'good' | 'partial' | 'weak'

// Where the site's value sits in the brand's spread.
export type SignalPosition = 'below' | 'low' | 'typical' | 'high' | 'above'

export interface DemographicSignalFit {
  signalName: string
  category: string
  siteValue: number
  profile: DemographicSignalProfile
  position: SignalPosition
  fit: number
}

export interface DemographicFit {
  band: DemographicFitBand
  // 'broad': nothing sets the brand's towns apart, so the site fits by default.
  basis: 'profile' | 'broad'
  // 0..1, the distinctiveness-weighted mean of the signal fits.
  score: number
  // Signals read, most distinctive first. The first is the one the pill explains.
  signals: DemographicSignalFit[]
}

// 1 inside the brand's middle half (p25..p75), easing to 0.5 at p10/p90, then to 0 by the same
// distance again beyond.
export function signalFit(value: number, p: DemographicSignalProfile): { fit: number; position: SignalPosition } {
  if (value >= p.p25 && value <= p.p75) return { fit: 1, position: 'typical' }
  if (value < p.p25) {
    const width = p.p25 - p.p10
    if (value >= p.p10) return { fit: 0.5 + (0.5 * (value - p.p10)) / width, position: 'low' }
    return { fit: width > 0 ? Math.max(0, 0.5 * (1 - (p.p10 - value) / width)) : 0, position: 'below' }
  }
  const width = p.p90 - p.p75
  if (value <= p.p90) return { fit: 0.5 + (0.5 * (p.p90 - value)) / width, position: 'high' }
  return { fit: width > 0 ? Math.max(0, 0.5 * (1 - (value - p.p90) / width)) : 0, position: 'above' }
}

function bandFor(score: number): DemographicFitBand {
  return score >= GOOD_FIT ? 'good' : score >= PARTIAL_FIT ? 'partial' : 'weak'
}

// null when there is nothing to compare: no profile for the brand (too few towns with data) or no
// signals for the site (outside every town, or a town without census data). That is a gap in the
// data, not a poor fit, so no pill is shown.
export function demographicFit(
  site: SiteSignals | null,
  profile: DemographicSignalProfile[]
): DemographicFit | null {
  if (!site || profile.length === 0) return null
  const shared = profile.filter((p) => Number.isFinite(site[p.signalName]))
  if (shared.length === 0) return null

  const bestPerCategory = new Map<string, DemographicSignalProfile>()
  for (const p of shared) {
    const current = bestPerCategory.get(p.category)
    if (!current || p.distinctiveness > current.distinctiveness) bestPerCategory.set(p.category, p)
  }
  const chosen = Array.from(bestPerCategory.values())
    .filter((p) => p.distinctiveness >= MIN_DISTINCTIVENESS)
    .sort((a, z) => z.distinctiveness - a.distinctiveness || a.signalName.localeCompare(z.signalName))
    .slice(0, MAX_FIT_SIGNALS)

  if (chosen.length === 0) return { band: 'good', basis: 'broad', score: 1, signals: [] }

  const signals = chosen.map((p) => ({
    signalName: p.signalName,
    category: p.category,
    siteValue: site[p.signalName],
    profile: p,
    ...signalFit(site[p.signalName], p),
  }))
  const weight = chosen.reduce((s, p) => s + p.distinctiveness, 0)
  const score = signals.reduce((s, x) => s + x.fit * x.profile.distinctiveness, 0) / weight
  return { band: bandFor(score), basis: 'profile', score, signals }
}

// ---------------------------------------------------------------------------
// Profile building — the backtest needs profiles built from a subset of a brand's towns, which the
// stored table cannot give it. Mirrors rebuild_brand_demographic_profiles(); the unit tests pin
// both to the same fixture figures.
// ---------------------------------------------------------------------------

// Postgres percentile_cont: linear interpolation between the closest ranks. `sorted` ascending.
export function percentileCont(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const pos = p * (sorted.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// Mid-rank of each value in 0..1: the share of values below it plus half of those tied with it.
export function midRanks<K>(values: Map<K, number>): Map<K, number> {
  const sorted = Array.from(values.values()).sort((a, z) => a - z)
  const n = sorted.length
  const below = (v: number) => {
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] < v) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const atOrBelow = (v: number) => {
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] <= v) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const ranks = new Map<K, number>()
  values.forEach((v, k) => {
    const b = below(v)
    ranks.set(k, (b + (atOrBelow(v) - b) / 2) / n)
  })
  return ranks
}

export interface SignalTable {
  category: string
  // BUA code -> value, over every retail town with a value.
  values: Map<string, number>
  // BUA code -> mid-rank among those towns.
  ranks: Map<string, number>
}

export function buildSignalTable(category: string, values: Map<string, number>): SignalTable {
  return { category, values, ranks: midRanks(values) }
}

export function buildProfile(
  buas: Iterable<string>,
  signals: Map<string, SignalTable>
): DemographicSignalProfile[] {
  const towns = Array.from(new Set(buas))
  const out: DemographicSignalProfile[] = []
  signals.forEach((table, signalName) => {
    const present = towns.filter((b) => table.values.has(b))
    if (present.length < MIN_PROFILE_BUAS) return
    const vals = present.map((b) => table.values.get(b) as number).sort((a, z) => a - z)
    const ranks = present.map((b) => table.ranks.get(b) as number).sort((a, z) => a - z)
    const medianRank = percentileCont(ranks, 0.5)
    out.push({
      signalName,
      category: table.category,
      buaCount: present.length,
      p10: percentileCont(vals, 0.1),
      p25: percentileCont(vals, 0.25),
      median: percentileCont(vals, 0.5),
      p75: percentileCont(vals, 0.75),
      p90: percentileCont(vals, 0.9),
      medianRank,
      distinctiveness: Math.min(1, Math.abs(medianRank - 0.5) * 2),
    })
  })
  return out
}

// Probability that a random positive outscores a random negative (ties count half). 0.5 = the
// score tells the two apart no better than a coin.
export function auc(positives: number[], negatives: number[]): number {
  if (positives.length === 0 || negatives.length === 0) return NaN
  const neg = [...negatives].sort((a, z) => a - z)
  const count = (v: number, strict: boolean) => {
    let lo = 0
    let hi = neg.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (strict ? neg[mid] < v : neg[mid] <= v) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  let wins = 0
  for (const p of positives) {
    const below = count(p, true)
    wins += below + (count(p, false) - below) / 2
  }
  return wins / (positives.length * neg.length)
}
