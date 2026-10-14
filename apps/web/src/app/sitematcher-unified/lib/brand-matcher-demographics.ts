// Brand Matcher demographic fit: does the town a site is in look like the towns a brand already
// trades in? Pure — the route will score with it and the backtest script measures it.
//
// "Town" is the ONS built-up area (BUA). Every town's demographic signals are ranked against towns
// of a similar size (rebuild_bua_demographic_ranks, migration 20261023020000), so "affluent" means
// affluent for its size: compared with all towns, every brand's loudest trait was simply "bigger
// towns than usual". A brand's profile is the spread (p10..p90) of those ranks across its towns.
// The site's town is scored against the signals that set the brand apart; a brand whose towns are
// typical on every signal trades anywhere, so any town fits it.
//
// Town size is kept out of the score and reported on its own: it is easy to judge for yourself,
// and left in it would outweigh every demographic signal.
//
// Phase 1: shown as a pill only, never added to the match score, until the backtest shows it
// predicts where brands trade.

// Kept in step with brand_demographic_profiles_min_buas in the migration.
export const MIN_PROFILE_BUAS = 8
// Size bands, kept in step with rebuild_bua_demographic_ranks(): up to 200 towns, closing early
// once the next town is more than twice the smallest's population if the band has 50 already.
export interface SizeBandRules {
  bandSize: number
  minBand: number
  maxRatio: number
}
export const SIZE_BANDS: SizeBandRules = { bandSize: 200, minBand: 50, maxRatio: 2 }
// A signal counts as part of a brand's character when its towns' median rank is at least this far
// from the middle (0.3 = the median town sits in the top or bottom 35% for its size).
export const MIN_DISTINCTIVENESS = 0.3
// Read at most this many signals, one per category: affluence_high and affluence_low are the same
// fact twice, and counting both would double its weight.
export const MAX_FIT_SIGNALS = 4
export const GOOD_FIT = 0.75
export const PARTIAL_FIT = 0.5
export const SIZE_SIGNAL = 'population'

export interface DemographicSignalProfile {
  signalName: string
  category: string
  buaCount: number
  // Spread of the signal's value across the brand's towns (index score, or people), for wording.
  p10: number
  p25: number
  median: number
  p75: number
  p90: number
  // Spread of the towns' size-adjusted ranks (0..1), which the fit is scored on.
  rankP10: number
  rankP25: number
  medianRank: number
  rankP75: number
  rankP90: number
  distinctiveness: number
}

// The site's town: each signal's value and its size-adjusted rank, as brand_matcher_site_bua
// returns them.
export interface SiteTown {
  values: Record<string, number>
  ranks: Record<string, number>
}

export type DemographicFitBand = 'good' | 'partial' | 'weak'

// Where the site sits in the brand's spread.
export type SignalPosition = 'below' | 'low' | 'typical' | 'high' | 'above'

export interface DemographicSignalFit {
  signalName: string
  category: string
  siteValue: number
  siteRank: number
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
  // How the site's town size compares with the brand's towns. Not part of the score.
  size: DemographicSignalFit | null
}

interface Spread {
  p10: number
  p25: number
  p75: number
  p90: number
}

// 1 inside the middle half (p25..p75), easing to 0.5 at p10/p90, then to 0 by the same distance
// again beyond.
export function signalFit(value: number, p: Spread): { fit: number; position: SignalPosition } {
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

function rankSpread(p: DemographicSignalProfile): Spread {
  return { p10: p.rankP10, p25: p.rankP25, p75: p.rankP75, p90: p.rankP90 }
}

function scoreSignal(site: SiteTown, p: DemographicSignalProfile): DemographicSignalFit {
  const siteRank = site.ranks[p.signalName]
  return {
    signalName: p.signalName,
    category: p.category,
    siteValue: site.values[p.signalName],
    siteRank,
    profile: p,
    ...signalFit(siteRank, rankSpread(p)),
  }
}

function bandFor(score: number): DemographicFitBand {
  return score >= GOOD_FIT ? 'good' : score >= PARTIAL_FIT ? 'partial' : 'weak'
}

// null when there is nothing to compare: no profile for the brand (too few towns with data) or no
// signals for the site (outside every town, or a town without census data). That is a gap in the
// data, not a poor fit, so no pill is shown.
export function demographicFit(site: SiteTown | null, profile: DemographicSignalProfile[]): DemographicFit | null {
  if (!site || profile.length === 0) return null
  const shared = profile.filter((p) => Number.isFinite(site.ranks[p.signalName]))
  const sizeProfile = shared.find((p) => p.signalName === SIZE_SIGNAL)
  const demographic = shared.filter((p) => p.signalName !== SIZE_SIGNAL)
  if (demographic.length === 0) return null
  const size = sizeProfile ? scoreSignal(site, sizeProfile) : null

  const bestPerCategory = new Map<string, DemographicSignalProfile>()
  for (const p of demographic) {
    const current = bestPerCategory.get(p.category)
    // Ties go to the alphabetically first name (byte order), as in brand_demographic_backtest().
    if (
      !current ||
      p.distinctiveness > current.distinctiveness ||
      (p.distinctiveness === current.distinctiveness && p.signalName < current.signalName)
    ) {
      bestPerCategory.set(p.category, p)
    }
  }
  const byName = (a: string, z: string) => (a < z ? -1 : a > z ? 1 : 0)
  const chosen = Array.from(bestPerCategory.values())
    .filter((p) => p.distinctiveness >= MIN_DISTINCTIVENESS)
    .sort((a, z) => z.distinctiveness - a.distinctiveness || byName(a.signalName, z.signalName))
    .slice(0, MAX_FIT_SIGNALS)

  if (chosen.length === 0) return { band: 'good', basis: 'broad', score: 1, signals: [], size }

  const signals = chosen.map((p) => scoreSignal(site, p))
  const weight = chosen.reduce((s, p) => s + p.distinctiveness, 0)
  const score = signals.reduce((s, x) => s + x.fit * x.profile.distinctiveness, 0) / weight
  return { band: bandFor(score), basis: 'profile', score, signals, size }
}

// ---------------------------------------------------------------------------
// Ranks and profiles — the backtest needs profiles built from a subset of a brand's towns, which
// the stored table cannot give it. Mirrors rebuild_bua_demographic_ranks() and
// rebuild_brand_demographic_profiles(); the unit tests pin both to the same fixture figures.
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
  const countBelow = (v: number, inclusive: boolean) => {
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (inclusive ? sorted[mid] <= v : sorted[mid] < v) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const ranks = new Map<K, number>()
  values.forEach((v, k) => {
    const below = countBelow(v, false)
    ranks.set(k, (below + (countBelow(v, true) - below) / 2) / n)
  })
  return ranks
}

// Mirrors rebuild_bua_demographic_ranks(): towns smallest first (code order, byte-wise, breaks
// ties), a new band when the current one is full or, once it has minBand towns, when the next town
// is more than maxRatio times the band's smallest. A last band under minBand joins the one below.
export function sizeBands(population: Map<string, number>, rules: SizeBandRules = SIZE_BANDS): Map<string, number> {
  const towns = Array.from(population.keys()).sort(
    (a, z) => (population.get(a) as number) - (population.get(z) as number) || (a < z ? -1 : a > z ? 1 : 0)
  )
  const bands = new Map<string, number>()
  let band = 1
  let count = 0
  let start: number | null = null
  for (const t of towns) {
    const pop = population.get(t) as number
    if (start == null) {
      start = pop
    } else if (count >= rules.bandSize || (count >= rules.minBand && pop > rules.maxRatio * start)) {
      band++
      count = 0
      start = pop
    }
    bands.set(t, band)
    count++
  }
  if (band > 1 && count < rules.minBand) bands.forEach((b, t) => b === band && bands.set(t, band - 1))
  return bands
}

export interface SignalTable {
  category: string
  // BUA code -> value.
  values: Map<string, number>
  // BUA code -> size-adjusted rank (across all towns for population).
  ranks: Map<string, number>
}

// Every signal's values per town in, size-adjusted ranks out. Needs the population signal.
export function buildSignalTables(
  signals: Map<string, { category: string; values: Map<string, number> }>,
  rules: SizeBandRules = SIZE_BANDS
): Map<string, SignalTable> {
  const population = signals.get(SIZE_SIGNAL)
  if (!population) throw new Error('the population signal is required to form size bands')
  const bands = sizeBands(population.values, rules)
  const tables = new Map<string, SignalTable>()
  signals.forEach(({ category, values }, name) => {
    const inTowns = new Map(Array.from(values).filter(([t]) => bands.has(t)))
    let ranks: Map<string, number>
    if (name === SIZE_SIGNAL) {
      ranks = midRanks(inTowns)
    } else {
      const byBand = new Map<number, Map<string, number>>()
      inTowns.forEach((v, t) => {
        const band = bands.get(t) as number
        const group = byBand.get(band) ?? new Map<string, number>()
        group.set(t, v)
        byBand.set(band, group)
      })
      ranks = new Map()
      byBand.forEach((group) => midRanks(group).forEach((r, t) => ranks.set(t, r)))
    }
    tables.set(name, { category, values: inTowns, ranks })
  })
  return tables
}

export function siteTown(town: string, tables: Map<string, SignalTable>): SiteTown | null {
  const values: Record<string, number> = {}
  const ranks: Record<string, number> = {}
  tables.forEach((table, name) => {
    const r = table.ranks.get(town)
    if (r == null) return
    ranks[name] = r
    values[name] = table.values.get(town) as number
  })
  return Object.keys(ranks).length ? { values, ranks } : null
}

export function buildProfile(buas: Iterable<string>, tables: Map<string, SignalTable>): DemographicSignalProfile[] {
  const towns = Array.from(new Set(buas))
  const out: DemographicSignalProfile[] = []
  tables.forEach((table, signalName) => {
    const present = towns.filter((b) => table.ranks.has(b))
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
      rankP10: percentileCont(ranks, 0.1),
      rankP25: percentileCont(ranks, 0.25),
      medianRank,
      rankP75: percentileCont(ranks, 0.75),
      rankP90: percentileCont(ranks, 0.9),
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
