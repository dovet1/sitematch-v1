// Brand Matcher scoring and presentation rules. Pure — shared by the API route (which
// assembles and ranks) and the UI (pills, sort, export), and unit-tested on its own.
//
// Ranking must stay explainable (handoff): every point of a score comes from a row shown on
// the card. Published turnover counts towards the score, and a brand with none scores nothing for it,
// unless it is a franchise: then turnover is left out of the score.

import type {
  AcquisitiveSignal,
  BrandMatch,
  BrandMatcherCentre,
  BrandMatcherContact,
  BrandMatcherContacts,
  BrandMatcherQuery,
  BrandMatcherSite,
  BrandMatcherSort,
  FranchiseSignal,
  NearestStoreSignal,
  NewsEvidence,
  NewsKind,
  RequirementEvidence,
  ScorePart,
  SizeFitSignal,
  SizeFitState,
  TownMatch,
  TownMatchBand,
  TradingFacts,
} from '../types/brand-matcher'

export const METERS_PER_MILE = 1609.344
// Radius for "already trades in your type of location" (handoff: "within 30 miles").
export const LOCATION_TYPE_RADIUS_MILES = 30
// A requirement target within this distance counts as covering the site.
export const REQUIREMENT_REACH_MILES = 25
// A store closer than this is a likely blocker (handoff: red NEAREST pill).
export const BLOCKER_MILES = 1
// Size tolerance outside a stated/observed range before a brand stops being a match.
export const SIZE_TOLERANCE = 0.25
export const WIDE_SIZE_TOLERANCE = 0.5

export const CONTACT_CORRECTIONS_EMAIL = 'rob@sitematcher.co.uk'

// ---------------------------------------------------------------------------
// Input normalisation
// ---------------------------------------------------------------------------

// ONSPD stores postcodes as 'OUT IN' with a single space. Returns null for anything that
// cannot be a UK postcode, so the route never queries on junk.
export function normalisePostcode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(compact)) return null
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

// GeoDS names read "Kirkstall Retail Park; Leeds (Yorkshire and The Humber; England)".
export function shortCentreName(name: string): string {
  return name.split(';')[0].trim()
}

const FORM_PLURAL: Record<BrandMatcherCentre['form'], string> = {
  retail_park: 'retail parks',
  high_street: 'high streets',
  shopping_centre: 'shopping centres',
}

export function formPlural(form: BrandMatcherCentre['form']): string {
  return FORM_PLURAL[form]
}

export function formLabel(form: BrandMatcherCentre['form'], count: number): string {
  return count === 1 ? FORM_PLURAL[form].replace(/s$/, '') : FORM_PLURAL[form]
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatSqft(n: number): string {
  return Math.round(n).toLocaleString('en-GB')
}

// 8000 -> "8k", 12500 -> "12.5k", 800 -> "800".
export function formatSqftShort(n: number): string {
  if (n < 1000) return String(Math.round(n))
  const k = n / 1000
  return `${Number.isInteger(k) ? k : Number(k.toFixed(1))}k`
}

export function formatSqftRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${formatSqftShort(min)}–${formatSqftShort(max)} sq ft`
  if (min != null) return `${formatSqftShort(min)}+ sq ft`
  if (max != null) return `up to ${formatSqftShort(max)} sq ft`
  return null
}

export function formatMiles(miles: number): string {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`
}

export function formatMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}£${(abs / 1e9).toFixed(1)}bn`
  if (abs >= 1e6) return `${sign}£${Math.round(abs / 1e6)}m`
  if (abs >= 1e3) return `${sign}£${Math.round(abs / 1e3)}k`
  return `${sign}£${Math.round(abs)}`
}

export function classLabel(code: string): string {
  if (code === 'All') return 'All use classes'
  return code === 'Sui Generis' ? 'Sui Generis' : `Class ${code}`
}

// ---------------------------------------------------------------------------
// Signal 1 — site-size fit
// ---------------------------------------------------------------------------

export interface SizeRange {
  min: number | null
  max: number | null
  // ISO date a requirement was listed with us.
  postedAt?: string | null
}

export interface EstateRange {
  p25: number
  p75: number
  min: number
  max: number
  // The fascia this range describes; null for the brand-level range.
  fasciaId?: string | null
}

const SIZE_RANK: Record<SizeFitState, number> = {
  fits: 3,
  lower_end: 2,
  upper_end: 2,
  larger: 1,
  smaller: 1,
}

// Best verdict across a brand's size ranges. A stated requirement is what the brand says it
// wants now, so when any requirement states a size only those ranges are read — an outlier
// store in the estate must not make a 14,000 sq ft unit "fit" a brand asking for 2,000.
// The measured estate is the fallback for brands with no stated size.
// Returns null when no range comes within tolerance (the brand is not a match).
export function sizeFit(
  sqft: number,
  requirementRanges: SizeRange[],
  estateRanges: EstateRange[],
  widen = false
): SizeFitSignal | null {
  const tol = widen ? WIDE_SIZE_TOLERANCE : SIZE_TOLERANCE
  let best: SizeFitSignal | null = null
  const consider = (candidate: SizeFitSignal) => {
    if (!best || SIZE_RANK[candidate.state] > SIZE_RANK[best.state]) best = candidate
  }

  for (const r of requirementRanges) {
    if (r.min == null && r.max == null) continue
    const lo = r.min ?? 0
    const hi = r.max ?? Infinity
    const base = { basis: 'requirement' as const, rangeMin: r.min, rangeMax: r.max, postedAt: r.postedAt ?? null }
    if (sqft >= lo && sqft <= hi) consider({ state: 'fits', ...base })
    else if (sqft > hi && sqft <= hi * (1 + tol)) consider({ state: 'larger', ...base })
    else if (sqft < lo && sqft >= lo * (1 - tol)) consider({ state: 'smaller', ...base })
  }

  const stated = requirementRanges.some((r) => r.min != null || r.max != null)
  for (const e of stated ? [] : estateRanges) {
    const base = { basis: 'estate' as const, rangeMin: e.p25, rangeMax: e.p75 }
    if (sqft >= e.p25 && sqft <= e.p75) consider({ state: 'fits', ...base })
    else if (sqft >= e.min && sqft < e.p25) consider({ state: 'lower_end', ...base })
    else if (sqft > e.p75 && sqft <= e.max) consider({ state: 'upper_end', ...base })
    else if (sqft > e.max && sqft <= e.max * (1 + tol)) consider({ state: 'larger', ...base })
    else if (sqft < e.min && sqft >= e.min * (1 - tol)) consider({ state: 'smaller', ...base })
  }

  return best
}

// ---------------------------------------------------------------------------
// Regions — contacts' free-text areas and requirement place names vs the site's region
// ---------------------------------------------------------------------------

// No bare "the north"/"the south": "the North West" must not cover a North East site.
const NORTH = ['north of england', 'north england', 'northern england']
const SOUTH = ['southern england', 'south of england']

// Keyed by GeoDS region_name (England) or country name.
const REGION_PHRASES: Record<string, string[]> = {
  London: ['london', 'm25'],
  'South East': ['south east', 'home counties', ...SOUTH],
  'East of England': ['east of england', 'east anglia', 'home counties'],
  'South West': ['south west', ...SOUTH],
  'West Midlands': ['west midlands', 'midlands'],
  'East Midlands': ['east midlands', 'midlands'],
  'Yorkshire and The Humber': ['yorkshire', 'humber', ...NORTH],
  'North West': ['north west', ...NORTH],
  'North East': ['north east', ...NORTH],
  Wales: ['wales'],
  Scotland: ['scotland'],
  'Northern Ireland': ['northern ireland'],
}

const NATIONAL_AREA = /\b(national|nationwide|uk[- ]wide|all (uk|regions)|united kingdom|great britain|gb)\b|^uk\b/

function normaliseArea(area: string): string {
  return (
    area
      .toLowerCase()
      .replace(/-/g, ' ')
      // "West & East Midlands" -> "west midlands, east midlands"
      .replace(
        /\b(north|south|east|west)\s*(?:&|and|\/)\s*(north|south|east|west)\s+(midlands)\b/g,
        '$1 $3, $2 $3'
      )
      .replace(/\s+/g, ' ')
  )
}

function hasPhrase(text: string, phrase: string): boolean {
  if (phrase === 'midlands') {
    // A bare "Midlands" covers both; "East Midlands" must not match a West Midlands site.
    return /(^|[^a-z])(?<!(east|west) )midlands\b/.test(text)
  }
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(text)
}

export function regionKey(region: string | null, country: string | null): string | null {
  if (country && country !== 'England' && REGION_PHRASES[country]) return country
  if (region && REGION_PHRASES[region]) return region
  return null
}

// Does a free-text area ("Wales & South West, North West & Yorkshire") cover the region?
export function areaCoversRegion(area: string | null, key: string | null): boolean {
  if (!area || !key) return false
  const text = normaliseArea(area)
  return REGION_PHRASES[key].some((p) => hasPhrase(text, p))
}

export function isNationalArea(area: string | null): boolean {
  return !!area && NATIONAL_AREA.test(normaliseArea(area).trim())
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const SENIOR_TITLE = /\b(head|director|national|group|chief|vp|vice president)\b/i

function contactKey(c: BrandMatcherContact): string {
  return (c.email?.toLowerCase().trim() || c.name?.toLowerCase().trim() || c.id)
}

function contactQuality(c: BrandMatcherContact): number {
  return (c.isPrimary ? 4 : 0) + (c.email ? 2 : 0) + (c.phone ? 1 : 0)
}

function isNationalContact(c: BrandMatcherContact): boolean {
  if (isNationalArea(c.area)) return true
  if (c.area) return false
  return c.isPrimary || SENIOR_TITLE.test(c.title ?? '')
}

// Primary = the contact whose area covers the site's region; failing that the national
// contact (badge dropped); failing that the best-reachable contact. Others follow national
// -> named -> generic (a team inbox is a valid row).
export function rankContacts(
  contacts: BrandMatcherContact[],
  regionKeyForSite: string | null
): BrandMatcherContacts {
  const seen = new Set<string>()
  const unique: BrandMatcherContact[] = []
  for (const c of contacts) {
    if (!c.email && !c.phone) continue
    const k = contactKey(c)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(c)
  }
  if (unique.length === 0) return { primary: null, coversRegion: false, others: [], total: 0 }

  const byQuality = (a: BrandMatcherContact, b: BrandMatcherContact) =>
    contactQuality(b) - contactQuality(a)

  const regional = unique.filter((c) => areaCoversRegion(c.area, regionKeyForSite)).sort(byQuality)
  const national = unique.filter(isNationalContact).sort(byQuality)

  let primary: BrandMatcherContact
  let coversRegion = false
  if (regional.length > 0) {
    primary = regional[0]
    coversRegion = true
  } else if (national.length > 0) {
    primary = national[0]
  } else {
    primary = [...unique].sort(byQuality)[0]
  }

  const tier = (c: BrandMatcherContact) => (isNationalContact(c) ? 0 : c.name ? 1 : 2)
  const others = unique
    .filter((c) => c !== primary)
    .sort((a, b) => tier(a) - tier(b) || byQuality(a, b))

  return { primary, coversRegion, others, total: unique.length }
}

// ---------------------------------------------------------------------------
// Signal 2 — acquisitive
// ---------------------------------------------------------------------------

// News on its own is medium only when, on balance, it says the brand is opening; otherwise low.
export function acquisitiveSignal(
  requirements: RequirementEvidence | null,
  news: NewsEvidence | null,
  planningCount: number
): AcquisitiveSignal | null {
  const planning = planningCount > 0 ? { count: planningCount } : null
  if (!requirements && !news && !planning) return null
  const coversSite = !!requirements && (requirements.nationwide || requirements.nearbyPlaces.length > 0)
  const level = coversSite ? 'high' : requirements || planning || (news?.score ?? 0) > 0 ? 'medium' : 'low'
  return { level, requirements, news, planning }
}

// ---------------------------------------------------------------------------
// News score — every article is rated -5 (closing every store) to +5 (needs many stores soon)
// when it is added (brand_activity.signal_rating). A brand's score is the sum of its ratings,
// each weighted by age so that it halves every NEWS_HALF_LIFE_DAYS, rounded and capped to
// -5..+5. No articles is 0: neutral, not a penalty.
// ---------------------------------------------------------------------------

export const NEWS_HALF_LIFE_DAYS = 182
// Older articles weigh under a sixteenth of a fresh one, so they are not loaded.
export const NEWS_WINDOW_DAYS = 730
export const NEWS_SCORE_MAX = 5
// A news score this high is evidence the brand is acquiring on its own (sortMatches 'best').
export const NEWS_ACQUIRING_SCORE = 3

export function newsWeight(item: { date: string; upcoming: boolean }, today: Date): number {
  if (item.upcoming) return 1
  const ageDays = (today.getTime() - Date.parse(item.date)) / 86_400_000
  return ageDays <= 0 ? 1 : 0.5 ** (ageDays / NEWS_HALF_LIFE_DAYS)
}

export function newsScore(items: { rating: number; date: string; upcoming: boolean }[], today: Date): number {
  const sum = items.reduce((s, n) => s + n.rating * newsWeight(n, today), 0)
  // Rounded half away from zero so +2.5 and -2.5 are treated alike; never -0.
  const rounded = Math.sign(sum) * Math.round(Math.abs(sum)) || 0
  return Math.max(-NEWS_SCORE_MAX, Math.min(NEWS_SCORE_MAX, rounded))
}

export function formatNewsScore(score: number): string {
  return score > 0 ? `+${score}` : score < 0 ? `−${-score}` : '0'
}

// ---------------------------------------------------------------------------
// Signals — one status and a short value per scored signal, for the collapsed row, the
// breakdown and the CSV. Status is read from shape as well as colour (handoff 3d).
// ---------------------------------------------------------------------------

export type SignalKey = 'size' | 'useClass' | 'acquisitive' | 'demographics' | 'nearest'
export type SignalStatus = 'good' | 'caution' | 'poor' | 'none'

export const SIGNAL_KEYS: SignalKey[] = ['size', 'useClass', 'acquisitive', 'demographics', 'nearest']

export const SIGNAL_LABEL: Record<SignalKey, string> = {
  size: 'Size fit',
  useClass: 'Use class',
  acquisitive: 'Acquisitive',
  demographics: 'Demographics',
  nearest: 'Nearest store',
}

// A store closer than this is a caution; closer than BLOCKER_MILES a likely blocker.
export const CAUTION_MILES = 3

// Distance only counts as a gap inside the area a brand trades in. A brand's spacing is how far
// apart its stores usually are (the 90th percentile gap to each store's next nearest one, migration
// 20261103000000), never less than SPACING_FLOOR_MILES. Of 3,679 dated openings since 2021, 90%
// opened within 1.2 spacings of an existing store and 99% within 3.4. Up to SWEET_SPOT_SPACINGS
// the site is in the brand's area; from there the points taper to nothing at REACH_SPACINGS,
// beyond which it is outside it. So a brand that only trades in Northern Ireland or London no
// longer scores a "gap" everywhere else.
export const SPACING_FLOOR_MILES = 5
export const SWEET_SPOT_SPACINGS = 2
export const REACH_SPACINGS = 5

export type TradingArea = 'in' | 'edge' | 'outside'

export function tradingArea(n: NearestStoreSignal): TradingArea {
  if (n.spacingMiles == null || n.wantedHere || n.miles <= SWEET_SPOT_SPACINGS * n.spacingMiles) return 'in'
  return n.miles < REACH_SPACINGS * n.spacingMiles ? 'edge' : 'outside'
}

// The sentence under the Nearest store panel and in the report, for a store at least
// CAUTION_MILES away: whether the site is inside the area the brand trades in.
export function tradingAreaLine(name: string, n: NearestStoreSignal): string {
  const area = tradingArea(n)
  const usual = n.spacingMiles != null ? `${name}'s stores are usually within ${formatMiles(n.spacingMiles)} of each other` : ''
  if (area === 'outside')
    return `${usual}, so at ${formatMiles(n.miles)} from the nearest one this site is outside the area ${name} trades in today.`
  if (area === 'edge')
    return `${usual}, so at ${formatMiles(n.miles)} from the nearest one this site is at the edge of the area ${name} trades in today.`
  if (n.wantedHere && n.spacingMiles != null && n.miles > SWEET_SPOT_SPACINGS * n.spacingMiles)
    return `The nearest ${name} store is ${formatMiles(n.miles)} away, but ${name}'s requirement names this area.`
  return `Far enough from existing ${name} stores to avoid cannibalising them.`
}

// Points for the Nearest store signal. Close stores cost points (cannibalisation); further away
// earns more, up to the edge of the brand's area, then tapers to nothing outside it.
export function nearestPoints(n: NearestStoreSignal): number {
  const mi = n.miles
  const points = mi >= 10 ? 15 : mi >= CAUTION_MILES ? 10 : mi >= BLOCKER_MILES ? 5 : 0
  const area = tradingArea(n)
  if (area === 'in') return points
  if (area === 'outside') return 0
  const s = n.spacingMiles as number
  const full = SWEET_SPOT_SPACINGS * s
  const none = REACH_SPACINGS * s
  return Math.min(points, Math.round((SCORE_MAX.nearest * (none - mi)) / (none - full)))
}

export interface SignalSummary {
  key: SignalKey
  status: SignalStatus
  // Short value for the row and breakdown, e.g. "Fits", "Class E", "3.1 mi".
  value: string
}

const SIZE_SUMMARY: Record<SizeFitState, { value: string; status: SignalStatus }> = {
  fits: { value: 'Fits', status: 'good' },
  lower_end: { value: 'Lower end', status: 'caution' },
  upper_end: { value: 'Upper end', status: 'caution' },
  larger: { value: 'Above range', status: 'caution' },
  smaller: { value: 'Below range', status: 'caution' },
}

// A store's town is a close match for the site's town when its population is within this ratio
// of the site town's and its affluence within this many index points. Kept in step with
// brand_matcher_town_gap() (migration 20261029000000).
export const TOWN_MATCH_POPULATION_RATIO = 1.5
export const TOWN_MATCH_AFFLUENCE_POINTS = 10

// A site or store outside every town takes the most populous town within this distance. Kept in
// step with rebuild_store_buas() and the match functions (migration 20261101000000).
export const TOWN_REACH_M = 1500

// Gap in close-match units (brand_matcher_town_gap): up to 1 is close, up to 2 partial.
export function townBand(gap: number | null | undefined): TownMatchBand | null {
  if (gap == null || !Number.isFinite(gap)) return null
  return gap <= 1 ? 'close' : gap <= 2 ? 'partial' : 'none'
}

// Best match first; stores in no town we hold figures for last. Ties go to the store nearest the
// site.
export function sortStoreTowns<T extends { gap: number | null; miles: number }>(stores: T[]): T[] {
  return [...stores].sort((a, z) => {
    if (a.gap == null || z.gap == null) {
      if (a.gap != null) return -1
      if (z.gap != null) return 1
    } else if (a.gap !== z.gap) return a.gap - z.gap
    return a.miles - z.miles
  })
}

// How many of a brand's stores the Demographics panel lists.
export const TOP_STORE_TOWNS = 10

const TOWN_SUMMARY: Record<TownMatchBand, { value: string; status: SignalStatus }> = {
  close: { value: 'Close match', status: 'good' },
  partial: { value: 'Partial', status: 'caution' },
  none: { value: 'No close match', status: 'poor' },
}

type Summarisable = Pick<BrandMatch, 'size' | 'useClass' | 'acquisitive' | 'townMatch' | 'nearest'>

export function signalSummary(m: Summarisable, key: SignalKey, query: Pick<BrandMatcherQuery, 'useClass'>): SignalSummary {
  const none: SignalSummary = { key, status: 'none', value: 'No data' }
  switch (key) {
    case 'size':
      return { key, ...SIZE_SUMMARY[m.size.state] }
    case 'useClass':
      if (!m.useClass) return none
      return m.useClass.matches
        ? { key, status: 'good', value: query.useClass === 'All' ? m.useClass.codes.map(classLabel).join(', ') : classLabel(query.useClass) }
        : { key, status: 'poor', value: m.useClass.codes.map(classLabel).join(', ') }
    case 'acquisitive':
      if (!m.acquisitive) return none
      return m.acquisitive.level === 'high'
        ? { key, status: 'good', value: 'High' }
        : m.acquisitive.level === 'medium'
          ? { key, status: 'caution', value: 'Medium' }
          : { key, status: 'poor', value: 'Low' }
    case 'demographics':
      return m.townMatch ? { key, ...TOWN_SUMMARY[m.townMatch.band] } : none
    case 'nearest': {
      if (!m.nearest) return none
      const mi = m.nearest.miles
      const area = tradingArea(m.nearest)
      return {
        key,
        status:
          mi < BLOCKER_MILES || area === 'outside' ? 'poor' : mi < CAUTION_MILES || area === 'edge' ? 'caution' : 'good',
        value: formatMiles(mi),
      }
    }
  }
}

export function signalSummaries(m: Summarisable, query: Pick<BrandMatcherQuery, 'useClass'>): SignalSummary[] {
  return SIGNAL_KEYS.map((k) => signalSummary(m, k, query))
}

// ---------------------------------------------------------------------------
// Score — attributable part by part to the signals on the card
// ---------------------------------------------------------------------------

export const SCORE_MAX: Record<ScorePart['component'], number> = {
  size: 30,
  acquisitive: 30,
  demographics: 15,
  nearest: 15,
  useClass: 10,
  turnover: 15,
}

// Turnover bands, in pounds.
export const TURNOVER_LARGE = 100e6
export const TURNOVER_MEDIUM = 10e6

// Points for the latest published turnover. No Companies House record, a figure not published or
// one not read yet all score nothing: the absence counts against the brand.
export function turnoverPoints(facts: TradingFacts | null | undefined): number {
  const t = facts?.turnover
  if (!t || (t.status !== 'filed' && t.status !== 'extracted')) return 0
  return t.value >= TURNOVER_LARGE ? 15 : t.value >= TURNOVER_MEDIUM ? 10 : 5
}

type Scorable = Pick<BrandMatch, 'size' | 'useClass' | 'acquisitive' | 'townMatch' | 'nearest'> &
  Partial<Pick<BrandMatch, 'tradingFacts' | 'franchise'>>

// Acquisitive points, out of 30. A live requirement listed with us is the biggest contributor;
// approved planning adds a little; the news score moves the total up or down, a brand with no
// articles scoring 0 for news. So +5 news alone earns 7, and a requirement covering the site with
// -5 news earns 13.
export const ACQUISITIVE_REQUIREMENT_COVERS_POINTS = 20
export const ACQUISITIVE_REQUIREMENT_ELSEWHERE_POINTS = 12
export const ACQUISITIVE_PLANNING_POINTS = 3
// Points at a news score of ±NEWS_SCORE_MAX; scaled in between.
export const ACQUISITIVE_NEWS_POINTS = 7

export function acquisitivePoints(a: AcquisitiveSignal | null): number {
  if (!a) return 0
  const requirement = !a.requirements
    ? 0
    : a.level === 'high'
      ? ACQUISITIVE_REQUIREMENT_COVERS_POINTS
      : ACQUISITIVE_REQUIREMENT_ELSEWHERE_POINTS
  const planning = a.planning ? ACQUISITIVE_PLANNING_POINTS : 0
  const news = Math.round((ACQUISITIVE_NEWS_POINTS * (a.news?.score ?? 0)) / NEWS_SCORE_MAX)
  return Math.max(0, Math.min(SCORE_MAX.acquisitive, requirement + planning + news))
}

// A signal we hold no data for is left out of the score rather than counted against it: the
// score is the points earned out of the points available from the signals we do hold, scaled to
// 100 (handoff: "Based on n of 5 signals"). Turnover and Acquisitive are the exceptions: they
// are always counted, so a brand with no published turnover, or with no requirement, planning or
// positive news, is pushed down. A franchise is the exception to that: its sites are let to
// franchisees, so no one company's turnover speaks for it, and turnover is left out. Demographics scores whether the brand trades in a town like the
// site's: a close match anywhere in its estate earns the full 15.
export function scoreMatch(m: Scorable): { score: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  const add = (component: ScorePart['component'], points: number) =>
    parts.push({ component, points, max: SCORE_MAX[component] })

  add('size', m.size.state === 'fits' ? 30 : m.size.state === 'lower_end' || m.size.state === 'upper_end' ? 20 : 10)
  if (m.useClass) add('useClass', m.useClass.matches ? 10 : 0)
  add('acquisitive', acquisitivePoints(m.acquisitive))
  if (m.townMatch) add('demographics', m.townMatch.band === 'close' ? 15 : m.townMatch.band === 'partial' ? 8 : 0)
  if (m.nearest) add('nearest', nearestPoints(m.nearest))
  if (!m.franchise) add('turnover', turnoverPoints(m.tradingFacts))
  const earned = parts.reduce((s, p) => s + p.points, 0)
  const available = parts.reduce((s, p) => s + p.max, 0)
  return { score: available > 0 ? Math.round((100 * earned) / available) : 0, parts }
}

// News is the brand's only acquisitive evidence.
function isNewsOnly(a: AcquisitiveSignal): a is AcquisitiveSignal & { news: NewsEvidence } {
  return !a.requirements && !a.planning && !!a.news
}

// No requirement or planning evidence, and news that falls short of saying the brand is acquiring.
export function isSparse(m: Pick<BrandMatch, 'acquisitive'>): boolean {
  const a = m.acquisitive
  return !a || (isNewsOnly(a) && a.news.score < NEWS_ACQUIRING_SCORE)
}

export const FRANCHISE_LABEL = 'Franchise'

// The turnover column: "Franchise" stands in for the financials of a franchised brand.
export function turnoverCell(m: { tradingFacts: TradingFacts | null; franchise?: FranchiseSignal | null }): string | null {
  if (m.franchise) return FRANCHISE_LABEL
  return m.tradingFacts ? turnoverValue(m.tradingFacts) : null
}

// null when there is nothing verifiable to show (figures not read yet).
export function turnoverValue(facts: TradingFacts): string | null {
  if (facts.turnover.status === 'filed' || facts.turnover.status === 'extracted') return formatMoney(facts.turnover.value)
  if (facts.turnover.status === 'not_published') return 'Not disclosed'
  return null
}

// ---------------------------------------------------------------------------
// Sector filter
// ---------------------------------------------------------------------------

// Filter id for brands with no category, so they stay reachable once a sector is picked.
export const NO_SECTOR = '__none__'

// A brand's sector is its top-level category: the parent of "Parent · Child", else the category.
export function brandSector(m: Pick<BrandMatch, 'category'>): string | null {
  const c = m.category?.trim()
  if (!c) return null
  return c.split(' · ')[0]
}

export interface SectorOption {
  id: string
  name: string
  count: number
}

// Sectors present in the matches, A–Z with "No sector listed" last.
export function sectorOptions(matches: Pick<BrandMatch, 'category'>[]): SectorOption[] {
  const counts = new Map<string, number>()
  let none = 0
  for (const m of matches) {
    const s = brandSector(m)
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1)
    else none++
  }
  const options = [...counts]
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (none > 0) options.push({ id: NO_SECTOR, name: 'No sector listed', count: none })
  return options
}

// No sectors selected means no filter.
export function filterBySector<T extends Pick<BrandMatch, 'category'>>(matches: T[], sectors: string[]): T[] {
  if (sectors.length === 0) return matches
  const want = new Set(sectors)
  return matches.filter((m) => want.has(brandSector(m) ?? NO_SECTOR))
}

// ---------------------------------------------------------------------------
// Sort + export
// ---------------------------------------------------------------------------

const byName = (a: BrandMatch, b: BrandMatch) => a.name.localeCompare(b.name)

export function sortMatches(matches: BrandMatch[], sort: BrandMatcherSort): BrandMatch[] {
  const list = [...matches]
  switch (sort) {
    case 'name':
      return list.sort(byName)
    case 'acquisitive': {
      // A brand whose news says it is not acquiring goes below one we know nothing about.
      const rank = (m: BrandMatch) => {
        const level = m.acquisitive?.level
        return level === 'high' ? 3 : level === 'medium' ? 2 : level === 'low' ? 0 : 1
      }
      const news = (m: BrandMatch) => m.acquisitive?.news?.score ?? 0
      return list.sort((a, b) => rank(b) - rank(a) || news(b) - news(a) || b.score - a.score || byName(a, b))
    }
    case 'gap': {
      // Furthest nearest-store first; brands with no located store go last.
      const d = (m: BrandMatch) => m.nearest?.miles ?? -1
      return list.sort((a, b) => d(b) - d(a) || b.score - a.score || byName(a, b))
    }
    case 'best':
    default:
      // Brands with evidence they are acquiring come first: a score scaled over fewer signals
      // must not lift a brand we know little about above one that is actively looking.
      return list.sort((a, b) => Number(isSparse(a)) - Number(isSparse(b)) || b.score - a.score || byName(a, b))
  }
}

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  // Neutralise spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function matchesToCsv(matches: BrandMatch[], query: BrandMatcherQuery): string {
  const header = [
    'Rank', 'Brand', 'Category', 'Match score', 'Size fit', 'Use class', 'Acquisitive',
    'News score', 'Open requirements', 'Town match', 'Nearest store (mi)', 'Nearest store',
    'Primary contact', 'Role', 'Email', 'Phone',
  ]
  const rows = matches.map((m, i) => {
    const signals = signalSummaries(m, query)
    const value = (k: SignalKey) => {
      const sig = signals.find((x) => x.key === k)
      return sig && sig.status !== 'none' ? sig.value : ''
    }
    const c = m.contacts.primary
    return [
      i + 1, m.name, m.category, `${m.score}/100`, value('size'), value('useClass'), value('acquisitive'),
      formatNewsScore(m.acquisitive?.news?.score ?? 0), m.acquisitive?.requirements?.count ?? '', value('demographics'),
      m.nearest ? m.nearest.miles.toFixed(1) : '', m.nearest?.storeName ?? '',
      c?.name ?? '', c?.title ?? '', c?.email ?? '', c?.phone ?? '',
    ].map(csvCell).join(',')
  })
  return [header.map(csvCell).join(','), ...rows].join('\n')
}

// ---------------------------------------------------------------------------
// Assembly (server) — raw rows in, ranked matches out
// ---------------------------------------------------------------------------

export interface RawBrand {
  id: string
  name: string
  logoUrl: string | null
  domain: string | null
  category: string | null
  storeCount: number
}

export interface RawRequirement {
  brandId: string
  sizeMin: number | null
  sizeMax: number | null
  useClasses: string[]
  locations: { name: string; lat: number | null; lon: number | null }[]
  contacts: BrandMatcherContact[]
  // ISO date the requirement was listed with us.
  createdAt?: string | null
}

export interface RawNewsItem {
  brandId: string
  kind: NewsKind
  headline: string
  url: string | null
  date: string
  upcoming: boolean
  rating: number
}

export interface RawBrandGeo {
  storeCount: number
  nearestMeters: number
  nearestName: string | null
  nearestTown: string | null
  sameFormCount: number | null
  sameFormNames: string[]
  sameFormNearestMeters: number | null
  // The three nearest stores, nearest first; empty when the RPC predates them.
  nearestStores?: { name: string | null; town: string | null; meters: number }[]
  // The brand's usual store spacing (brand_store_spacing.p90_gap_m); null for a one-store brand,
  // absent when we hold no spacing for it.
  spacingMeters?: number | null
}

export interface AssembleInput {
  query: BrandMatcherQuery
  site: BrandMatcherSite
  brands: RawBrand[]
  estateRanges: Map<string, EstateRange[]>
  requirements: RawRequirement[]
  brandContacts: Map<string, BrandMatcherContact[]>
  news: RawNewsItem[]
  planningCounts: Map<string, number>
  geo: Map<string, RawBrandGeo>
  tradingFacts?: Map<string, TradingFacts>
  // Brands we are highly confident are franchised.
  franchises?: Map<string, FranchiseSignal>
  // Per brand, how its stores' towns compare with the site's town. Absent when demographics were
  // not loaded; a brand missing from the map has no stores in towns we hold figures for.
  townMatches?: Map<string, TownMatch>
  // For the news score's age weighting; defaults to now.
  today?: Date
}

// Most evidence lines (requirements, news) carried per brand.
export const MAX_EVIDENCE_ITEMS = 20

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return (2 * 6371008.8 * Math.asin(Math.sqrt(a))) / METERS_PER_MILE
}

function shortPlace(name: string): string {
  return name.split(',')[0].trim()
}

function requirementEvidence(
  reqs: RawRequirement[],
  site: BrandMatcherSite,
  key: string | null
): RequirementEvidence | null {
  if (reqs.length === 0) return null
  const mins = reqs.map((r) => r.sizeMin).filter((n): n is number => n != null)
  const maxs = reqs.map((r) => r.sizeMax).filter((n): n is number => n != null)
  const useClasses = Array.from(new Set(reqs.flatMap((r) => r.useClasses)))
  const nationwide = reqs.some((r) => r.locations.length === 0)
  const nearby = new Set<string>()
  const other = new Set<string>()
  for (const r of reqs) {
    for (const l of r.locations) {
      const near =
        (l.lat != null && l.lon != null &&
          milesBetween(site.lat, site.lon, l.lat, l.lon) <= REQUIREMENT_REACH_MILES) ||
        areaCoversRegion(l.name, key)
      ;(near ? nearby : other).add(shortPlace(l.name))
    }
  }
  for (const n of Array.from(nearby)) other.delete(n)
  const otherList = Array.from(other)
  const items = [...reqs]
    .sort((a, z) => (z.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((r) => ({
      sizeMin: r.sizeMin,
      sizeMax: r.sizeMax,
      useClasses: r.useClasses,
      places: Array.from(new Set(r.locations.map((l) => shortPlace(l.name)))),
      postedAt: r.createdAt ? r.createdAt.slice(0, 10) : null,
    }))
  return {
    count: reqs.length,
    sizeMin: mins.length ? Math.min(...mins) : null,
    sizeMax: maxs.length ? Math.max(...maxs) : null,
    useClasses,
    nationwide,
    nearbyPlaces: Array.from(nearby).slice(0, 4),
    otherPlaces: otherList.slice(0, 3),
    otherPlaceCount: otherList.length,
    items,
  }
}

export function assembleMatches(input: AssembleInput): { matches: BrandMatch[]; considered: number } {
  const { query, site } = input
  const key = regionKey(site.region, site.country)
  const today = input.today ?? new Date()

  const reqsByBrand = new Map<string, RawRequirement[]>()
  for (const r of input.requirements) {
    const list = reqsByBrand.get(r.brandId)
    if (list) list.push(r)
    else reqsByBrand.set(r.brandId, [r])
  }
  const newsByBrand = new Map<string, RawNewsItem[]>()
  for (const n of input.news) {
    const list = newsByBrand.get(n.brandId)
    if (list) list.push(n)
    else newsByBrand.set(n.brandId, [n])
  }

  let considered = 0
  const matches: BrandMatch[] = []
  for (const b of input.brands) {
    const reqs = reqsByBrand.get(b.id) ?? []
    const estate = input.estateRanges.get(b.id) ?? []
    if (reqs.length === 0 && estate.length === 0) continue
    considered++

    const size = sizeFit(
      query.sqft,
      reqs.map((r) => ({ min: r.sizeMin, max: r.sizeMax, postedAt: r.createdAt ? r.createdAt.slice(0, 10) : null })),
      estate,
      query.widen
    )
    if (!size) continue

    const codes = Array.from(new Set(reqs.flatMap((r) => r.useClasses)))
    const useClass = codes.length > 0 ? { codes, matches: query.useClass === 'All' || codes.includes(query.useClass) } : null
    if (useClass && !useClass.matches && !query.widen) continue

    const newsItems = (newsByBrand.get(b.id) ?? []).sort((a, z) => z.date.localeCompare(a.date))
    const news: NewsEvidence | null = newsItems.length
      ? {
          count: newsItems.length,
          score: newsScore(newsItems, today),
          items: newsItems.slice(0, MAX_EVIDENCE_ITEMS).map(({ brandId: _b, ...n }) => n),
        }
      : null
    const reqEvidence = requirementEvidence(reqs, site, key)
    const acquisitive = acquisitiveSignal(
      reqEvidence,
      news,
      input.planningCounts.get(b.id) ?? 0
    )

    const g = input.geo.get(b.id)
    const locationType =
      site.centre && g && g.sameFormCount != null
        ? {
            form: site.centre.form,
            count: g.sameFormCount,
            names: g.sameFormNames.map(shortCentreName),
            nearestMiles: g.sameFormNearestMeters != null ? g.sameFormNearestMeters / METERS_PER_MILE : null,
          }
        : null
    const nearest = g
      ? {
          miles: g.nearestMeters / METERS_PER_MILE,
          storeName: g.nearestName,
          town: g.nearestTown,
          ...(g.nearestStores?.length
            ? { stores: g.nearestStores.map((x) => ({ name: x.name, town: x.town, miles: x.meters / METERS_PER_MILE })) }
            : {}),
          ...(g.spacingMeters !== undefined
            ? { spacingMiles: Math.max((g.spacingMeters ?? 0) / METERS_PER_MILE, SPACING_FLOOR_MILES) }
            : {}),
          ...((reqEvidence?.nearbyPlaces.length ?? 0) > 0 ? { wantedHere: true } : {}),
        }
      : null

    // Typical unit for the band copy: the fascia range nearest the site's size.
    const typical = estate.length
      ? [...estate].sort(
          (a, z) =>
            Math.abs((a.p25 + a.p75) / 2 - query.sqft) - Math.abs((z.p25 + z.p75) / 2 - query.sqft)
        )[0]
      : null

    const townMatch = input.townMatches ? input.townMatches.get(b.id) ?? null : undefined
    const contacts = rankContacts(
      [...(input.brandContacts.get(b.id) ?? []), ...reqs.flatMap((r) => r.contacts)],
      key
    )

    const partial = { size, useClass, acquisitive, locationType, nearest }
    const tradingFacts = input.tradingFacts?.get(b.id) ?? null
    const franchise = input.franchises?.get(b.id) ?? null
    const { score, parts } = scoreMatch({ ...partial, townMatch, tradingFacts, franchise })
    matches.push({
      brandId: b.id,
      name: b.name,
      logoUrl: b.logoUrl,
      domain: b.domain,
      category: b.category,
      storeCount: g?.storeCount ?? b.storeCount,
      ...partial,
      tradingFacts,
      franchise,
      typicalRange: typical ? { min: typical.p25, max: typical.p75 } : null,
      contacts,
      ...(townMatch !== undefined ? { townMatch } : {}),
      score,
      scoreParts: parts,
    })
  }

  return { matches: sortMatches(matches, 'best'), considered }
}
