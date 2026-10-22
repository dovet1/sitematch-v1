// Brand Matcher demographic fit: does the area around a site look like the areas around a brand's
// stores? Pure. No longer on the card or in the score (21 Oct 2026: the card now matches the
// site's town against the towns of the brand's stores on population and affluence, migration
// 20261029000000); kept for the backtest scripts and formatPeople.
//
// Each store, and the site, is measured by its local catchment: the census neighbourhoods (LSOAs)
// within 1km, or 3km / 5km where fewer than 5,000 people live within 1km (migration
// 20261027000000). Every catchment's signals are ranked against catchments of a similar density,
// so "affluent" means affluent for an area that busy. A brand's profile is the spread (p10..p90)
// of those ranks across its stores' areas. The site is scored against the signals that set the
// brand apart; a brand whose areas are typical on every signal trades anywhere.
//
// Estates that mix denser and less dense sites (a city-centre chain with motorway services) are
// profiled in two parts, and a site is judged only against the part that matches its own density:
// one spread across both described neither (Leon: 0.57 as one estate, 0.80 for its denser sites).
//
// Local population (people within 1km) is kept out of the score and reported on its own: it is
// easy to judge for yourself, and left in it would outweigh every demographic signal.
//
// Earlier versions measured whole built-up areas ("towns"); the town functions below still back
// the old town backtest script.

// Kept in step with brand_demographic_profiles_min_buas (the town version).
export const MIN_PROFILE_BUAS = 8
// The fewest store areas a catchment profile is built from. Kept in step with
// brand_catchment_profiles_min_sites; the backtest needs 6 to score one.
export const MIN_PROFILE_SITES = 5
// An area is "dense" when at least this many people live within 1km. Kept in step with
// rebuild_lsoa_catchments().
export const DENSE_POPULATION_1KM = 5000

export type SiteType = 'dense' | 'sparse'
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

// The site's area: each signal's value and its density-adjusted rank, as
// brand_matcher_site_catchment returns them, and whether the area is dense.
export interface SiteTown {
  values: Record<string, number>
  ranks: Record<string, number>
  siteType?: SiteType
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
// The card — which profile to use, whether it has earned a pill, and the words on it
// ---------------------------------------------------------------------------

// A profile's fit is shown only where the backtest found it picks out the brand's real areas at
// least this often against areas of the same density it is not in (0.5 = a coin toss); below it
// the pill would mislead as often as help.
export const MIN_VALIDATED_AUC = 0.65

// With few stores a profile can clear 0.65 by luck: tested on 6 areas, a profile with no real
// signal does so about one time in ten. So small profiles must clear the bar a coin toss would
// clear only one time in twenty (one-sided 5%, using the AUC's standard error with many
// negatives, sqrt(1 / 12n)). From about 12 tested areas this is just 0.65.
export function validatedAucBar(heldOut: number | null | undefined): number {
  if (!heldOut || heldOut <= 0) return MIN_VALIDATED_AUC
  return Math.max(MIN_VALIDATED_AUC, 0.5 + 1.645 * Math.sqrt(1 / (12 * heldOut)))
}

// One row of brand_catchment_backtest_results.
export interface BacktestScore {
  broad: boolean
  aucDemographics: number | null
  // Store areas tested. Omitted: judged against MIN_VALIDATED_AUC alone.
  heldOut?: number | null
}

export interface DemographicReason {
  signalName: string
  // Which way the brand's towns lean for their size.
  direction: 'higher' | 'lower'
  sitePosition: SignalPosition
}

// One measure on which the brand's towns differ from towns of their size, for the percentile
// strip. Ranks are 0..100 against towns of a similar size.
export interface DemographicMeasure {
  signalName: string
  direction: 'higher' | 'lower'
  p10: number
  p25: number
  p75: number
  p90: number
  siteRank: number
  sitePosition: SignalPosition
}

export interface DemographicMatch {
  // 'any': the brand's areas are typical for their density on every measure.
  band: DemographicFitBand | 'any'
  // Whose stores: the fascia's own, or the whole brand's when the fascia has too few.
  basis: 'fascia' | 'brand'
  // Set when the estate was split by density: the site was compared only with the brand's stores
  // in areas like its own (dense or sparse).
  siteType?: SiteType | null
  // Where the site is: its built-up area, else its local authority.
  townName: string
  // The most distinctive measures, most distinctive first (at most two).
  reasons: DemographicReason[]
  // Every measure the fit was read on (up to MAX_FIT_SIGNALS), most distinctive first.
  measures?: DemographicMeasure[]
  size: { position: SignalPosition; sitePopulation: number; typicalMin: number; typicalMax: number } | null
}

export interface DemographicMatchInput {
  site: (SiteTown & { townName: string }) | null
  // The fascia nearest the site's size, when it has a profile of its own.
  fasciaProfile: DemographicSignalProfile[] | null
  fasciaScore: BacktestScore | null
  brandProfile: DemographicSignalProfile[] | null
  brandScore: BacktestScore | null
  // Whether each profile is the part of a split estate matching the site's density.
  fasciaSplit?: boolean
  brandSplit?: boolean
}

// null means show nothing: no town or profile to compare, or a profile the backtest did not back.
export function demographicMatch(input: DemographicMatchInput): DemographicMatch | null {
  const { site } = input
  if (!site) return null
  const useFascia = !!input.fasciaProfile && input.fasciaProfile.length > 0
  const profile = useFascia ? input.fasciaProfile : input.brandProfile
  const score = useFascia ? input.fasciaScore : input.brandScore
  if (!profile || profile.length === 0) return null

  const fit = demographicFit(site, profile)
  if (!fit) return null

  const size = fit.size
    ? {
        position: fit.size.position,
        sitePopulation: fit.size.siteValue,
        typicalMin: fit.size.profile.p25,
        typicalMax: fit.size.profile.p75,
      }
    : null
  const split = useFascia ? input.fasciaSplit : input.brandSplit
  const base = {
    basis: useFascia ? ('fascia' as const) : ('brand' as const),
    siteType: split && site.siteType ? site.siteType : null,
    townName: site.townName,
    size,
  }

  // "Trades in all kinds of towns" is a description of the estate, not a prediction, so it needs
  // no backtest behind it.
  if (fit.basis === 'broad') return { band: 'any', reasons: [], measures: [], ...base }

  if (!score || score.broad || score.aucDemographics == null || score.aucDemographics < validatedAucBar(score.heldOut)) {
    return null
  }
  return {
    band: fit.band,
    reasons: fit.signals.slice(0, 2).map((s) => ({
      signalName: s.signalName,
      direction: s.profile.medianRank > 0.5 ? 'higher' : 'lower',
      sitePosition: s.position,
    })),
    measures: fit.signals.map((s) => ({
      signalName: s.signalName,
      direction: s.profile.medianRank > 0.5 ? ('higher' as const) : ('lower' as const),
      p10: s.profile.rankP10 * 100,
      p25: s.profile.rankP25 * 100,
      p75: s.profile.rankP75 * 100,
      p90: s.profile.rankP90 * 100,
      siteRank: s.siteRank * 100,
      sitePosition: s.position,
    })),
    ...base,
  }
}

// How each measure reads. Within affluence, professional jobs, walkability, stability and student
// presence the signals hold the same number (they differ only in GapFinder's tag thresholds), so
// they share their words.
const WORDS: Record<string, { topic: string; higher: string; lower: string }> = {
  affluence: { topic: 'affluence', higher: 'more affluent', lower: 'less affluent' },
  professional_economy: { topic: 'professional jobs', higher: 'more professional jobs', lower: 'fewer professional jobs' },
  car_dependency: { topic: 'walkability', higher: 'more walkable', lower: 'more car-dependent' },
  stability: { topic: 'how settled it is', higher: 'more settled', lower: 'more transient' },
  student_presence: { topic: 'students', higher: 'more students', lower: 'fewer students' },
  student_market: { topic: 'students', higher: 'more students', lower: 'fewer students' },
  young_professionals: { topic: 'young professionals', higher: 'more young professionals', lower: 'fewer young professionals' },
  family_market: { topic: 'families', higher: 'more families', lower: 'fewer families' },
  empty_nesters: { topic: 'empty nesters', higher: 'more empty nesters', lower: 'fewer empty nesters' },
  retirement_market: { topic: 'retirees', higher: 'more retirees', lower: 'fewer retirees' },
  urbanity_urban_core: { topic: 'how urban it is', higher: 'more urban', lower: 'less urban' },
  urbanity_dense_urban: { topic: 'how urban it is', higher: 'more urban', lower: 'less urban' },
  urbanity_suburban: { topic: 'how suburban it is', higher: 'more suburban', lower: 'less suburban' },
  urbanity_rural: { topic: 'how rural it is', higher: 'more rural', lower: 'less rural' },
}

function words(signalName: string) {
  return (
    WORDS[signalName] ??
    WORDS[signalName.replace(/_(high|medium|low|stable|mixed|transient|walkable|car_dependent|minimal|moderate|strong)$/, '')] ?? {
      topic: signalName.replace(/_/g, ' '),
      higher: `more ${signalName.replace(/_/g, ' ')}`,
      lower: `less ${signalName.replace(/_/g, ' ')}`,
    }
  )
}

// Panel wording for one measure: its name, the strip's two ends, and whether its phrases read
// as adjectives ("more affluent": "is"/"are") or nouns ("more families": "has"/"have").
const MEASURE: Record<string, { label: string; noun: boolean }> = {
  affluence: { label: 'Affluence', noun: false },
  professional_economy: { label: 'Professional jobs', noun: true },
  car_dependency: { label: 'Walkability', noun: false },
  stability: { label: 'How settled it is', noun: false },
  student_presence: { label: 'Students', noun: true },
  student_market: { label: 'Students', noun: true },
  young_professionals: { label: 'Young professionals', noun: true },
  family_market: { label: 'Families', noun: true },
  empty_nesters: { label: 'Empty nesters', noun: true },
  retirement_market: { label: 'Retirees', noun: true },
  urbanity_urban_core: { label: 'How urban it is', noun: false },
  urbanity_dense_urban: { label: 'How urban it is', noun: false },
  urbanity_suburban: { label: 'How suburban it is', noun: false },
  urbanity_rural: { label: 'How rural it is', noun: false },
}

const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function measureWords(signalName: string): {
  label: string
  lowLabel: string
  highLabel: string
  higher: string
  lower: string
  noun: boolean
} {
  const w = words(signalName)
  const m =
    MEASURE[signalName] ??
    MEASURE[signalName.replace(/_(high|medium|low|stable|mixed|transient|walkable|car_dependent|minimal|moderate|strong)$/, '')] ??
    { label: capitalise(w.topic), noun: false }
  return { label: m.label, lowLabel: capitalise(w.lower), highLabel: capitalise(w.higher), higher: w.higher, lower: w.lower, noun: m.noun }
}

function joinAnd(parts: string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const inLine = (p: SignalPosition) => p === 'typical' || p === 'low' || p === 'high'

export function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

// Whose stores the site is compared with, for sentences: "Leon's stores", "Leon's stores in
// denser areas", "Greggs's stores (across the whole brand)".
export function comparedStores(d: Pick<DemographicMatch, 'basis' | 'siteType'>, brandName: string): string {
  const kind = d.siteType === 'dense' ? ' in denser areas' : d.siteType === 'sparse' ? ' in less dense areas' : ''
  return `${brandName}'s stores${kind}${d.basis === 'brand' ? ' (across the whole brand)' : ''}`
}

// Plain-English lines for the pill's tooltip.
export function describeDemographic(d: DemographicMatch, brandName: string): string[] {
  const lines: string[] = []
  const whose = `the areas around ${comparedStores(d, brandName)}`
  if (d.band === 'any') {
    lines.push(`${capitalise(whose)} are typical for their density on every measure, so this site fits as well as most.`)
  } else {
    lines.push(`Compared with areas of a similar density, ${whose} are ${joinAnd(d.reasons.map((r) => words(r.signalName)[r.direction]))}.`)
    const matched = d.reasons.filter((r) => inLine(r.sitePosition)).map((r) => words(r.signalName).topic)
    const missed = d.reasons.filter((r) => !inLine(r.sitePosition)).map((r) => words(r.signalName).topic)
    const here = `The area around the site in ${d.townName}`
    if (missed.length === 0) lines.push(`${here} is in line with them on ${joinAnd(matched)}.`)
    else if (matched.length === 0) lines.push(`${here} is not in line with them on ${joinAnd(missed)}.`)
    else lines.push(`${here} is in line with them on ${joinAnd(matched)}, but not on ${joinAnd(missed)}.`)
  }
  if (d.size) {
    const range = `${formatPeople(d.size.typicalMin)}–${formatPeople(d.size.typicalMax)}`
    const verdict =
      d.size.position === 'below'
        ? 'fewer than around most of their stores'
        : d.size.position === 'above'
          ? 'more than around most of their stores'
          : 'typical for them'
    lines.push(
      `Local population: ${formatPeople(d.size.sitePopulation)} people live within 1km of the site, ${verdict}; their stores usually have ${range}.`
    )
  }
  return lines
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
  // Same arithmetic as the SQL (cume_dist() - ties / 2n), so equal values come out bit-for-bit
  // equal in both and ties between towns are never broken by rounding.
  const ranks = new Map<K, number>()
  values.forEach((v, k) => {
    const atOrBelow = countBelow(v, true)
    ranks.set(k, atOrBelow / n - (atOrBelow - countBelow(v, false)) / (2 * n))
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
