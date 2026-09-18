// Brand Matcher scoring and presentation rules. Pure — shared by the API route (which
// assembles and ranks) and the UI (pills, sort, export), and unit-tested on its own.
//
// Ranking must stay explainable (handoff): every point of a score comes from a pill shown on
// the card, and Companies House figures never contribute — SiteMatcher does not rate a
// company's financial standing.

import type {
  AcquisitiveSignal,
  BrandMatch,
  BrandMatcherCentre,
  BrandMatcherContact,
  BrandMatcherContacts,
  BrandMatcherQuery,
  BrandMatcherSite,
  BrandMatcherSort,
  NewsEvidence,
  RequirementEvidence,
  ScorePart,
  SignalTone,
  SizeFitSignal,
  SizeFitState,
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
  return code === 'Sui Generis' ? 'Sui Generis' : `Class ${code}`
}

// ---------------------------------------------------------------------------
// Signal 1 — site-size fit
// ---------------------------------------------------------------------------

export interface SizeRange {
  min: number | null
  max: number | null
}

export interface EstateRange {
  p25: number
  p75: number
  min: number
  max: number
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
    const base = { basis: 'requirement' as const, rangeMin: r.min, rangeMax: r.max }
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

export function acquisitiveSignal(
  requirements: RequirementEvidence | null,
  news: NewsEvidence | null,
  planningCount: number
): AcquisitiveSignal | null {
  const planning = planningCount > 0 ? { count: planningCount } : null
  if (!requirements && !news && !planning) return null
  const coversSite = !!requirements && (requirements.nationwide || requirements.nearbyPlaces.length > 0)
  return { level: coversSite ? 'high' : 'medium', requirements, news, planning }
}

// ---------------------------------------------------------------------------
// Score — attributable part by part to the pills on the card
// ---------------------------------------------------------------------------

export const SCORE_MAX: Record<ScorePart['component'], number> = {
  size: 30,
  acquisitive: 30,
  locationType: 15,
  nearest: 15,
  useClass: 10,
}

type Scorable = Pick<BrandMatch, 'size' | 'useClass' | 'acquisitive' | 'locationType' | 'nearest'>

export function scoreMatch(m: Scorable): { score: number; parts: ScorePart[] } {
  const parts: ScorePart[] = []
  const add = (component: ScorePart['component'], points: number) =>
    parts.push({ component, points, max: SCORE_MAX[component] })

  add('size', m.size.state === 'fits' ? 30 : m.size.state === 'lower_end' || m.size.state === 'upper_end' ? 20 : 10)
  if (m.useClass) add('useClass', m.useClass.matches ? 10 : 0)
  if (m.acquisitive) add('acquisitive', m.acquisitive.level === 'high' ? 30 : 15)
  if (m.locationType) add('locationType', m.locationType.count > 0 ? Math.min(15, 5 + m.locationType.count) : 0)
  if (m.nearest) {
    const mi = m.nearest.miles
    // Distance is a gap: the further the nearest branch, the stronger the reason to take it.
    add('nearest', mi >= 10 ? 15 : mi >= 3 ? 10 : mi >= BLOCKER_MILES ? 5 : 0)
  }
  // Trading facts are deliberately absent. Never score a company's finances.
  return { score: parts.reduce((s, p) => s + p.points, 0), parts }
}

export function isSparse(m: Pick<BrandMatch, 'acquisitive'>): boolean {
  return m.acquisitive == null
}

// ---------------------------------------------------------------------------
// Pills
// ---------------------------------------------------------------------------

export interface Pill {
  key: string
  label: string
  value: string
  tone: SignalTone
  mark?: '✓' | '△'
  title?: string
}

const SIZE_PILL: Record<SizeFitState, { value: string; tone: SignalTone; mark: '✓' | '△' }> = {
  fits: { value: 'Fits', tone: 'green', mark: '✓' },
  lower_end: { value: 'Lower end', tone: 'amber', mark: '△' },
  upper_end: { value: 'Upper end', tone: 'amber', mark: '△' },
  larger: { value: 'Larger', tone: 'amber', mark: '△' },
  smaller: { value: 'Smaller', tone: 'amber', mark: '△' },
}

export function turnoverValue(facts: TradingFacts): string {
  return facts.turnover == null ? 'Not disclosed' : formatMoney(facts.turnover)
}

export function buildPills(m: BrandMatch, query: Pick<BrandMatcherQuery, 'useClass'>): Pill[] {
  const pills: Pill[] = []
  const size = SIZE_PILL[m.size.state]
  const range = formatSqftRange(m.size.rangeMin, m.size.rangeMax)
  pills.push({
    key: 'size',
    label: 'Size fit',
    ...size,
    title: range
      ? `${m.size.basis === 'requirement' ? 'Stated requirement' : 'Typical store'}: ${range}`
      : undefined,
  })
  if (m.useClass) {
    pills.push({
      key: 'useClass',
      label: 'Use class',
      value: m.useClass.matches
        ? classLabel(query.useClass)
        : m.useClass.codes.map(classLabel).join(', '),
      tone: m.useClass.matches ? 'green' : 'amber',
      mark: m.useClass.matches ? '✓' : '△',
    })
  }
  if (m.acquisitive) {
    pills.push({
      key: 'acquisitive',
      label: 'Acquisitive',
      value: m.acquisitive.level === 'high' ? 'High' : 'Medium',
      tone: m.acquisitive.level === 'high' ? 'amber' : 'neutral',
    })
  }
  if (m.tradingFacts) {
    // Always neutral: a trading fact is never coloured green or red.
    pills.push({ key: 'turnover', label: 'Turnover', value: turnoverValue(m.tradingFacts), tone: 'neutral' })
  }
  if (m.locationType) {
    const n = m.locationType.count
    pills.push({
      key: 'locationType',
      label: formPlural(m.locationType.form),
      value: n > 0 ? `Trades in ${n}` : `None in ${LOCATION_TYPE_RADIUS_MILES} mi`,
      tone: n > 0 ? 'green' : 'neutral',
    })
  }
  if (m.nearest) {
    const blocker = m.nearest.miles < BLOCKER_MILES
    pills.push({
      key: 'nearest',
      label: 'Nearest',
      value: formatMiles(m.nearest.miles),
      tone: blocker ? 'red' : 'neutral',
      title: [m.nearest.storeName, blocker ? 'Existing store very close — likely blocker' : null]
        .filter(Boolean)
        .join(' · ') || undefined,
    })
  }
  return pills
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
      const rank = (m: BrandMatch) => (m.acquisitive?.level === 'high' ? 2 : m.acquisitive ? 1 : 0)
      return list.sort((a, b) => rank(b) - rank(a) || b.score - a.score || byName(a, b))
    }
    case 'gap': {
      // Furthest nearest-store first; brands with no located store go last.
      const d = (m: BrandMatch) => m.nearest?.miles ?? -1
      return list.sort((a, b) => d(b) - d(a) || b.score - a.score || byName(a, b))
    }
    case 'best':
    default:
      return list.sort((a, b) => b.score - a.score || byName(a, b))
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
    'Open requirements', 'Same location type', 'Nearest store (mi)', 'Nearest store',
    'Primary contact', 'Role', 'Email', 'Phone',
  ]
  const rows = matches.map((m, i) => {
    const pills = buildPills(m, query)
    const pill = (k: string) => pills.find((p) => p.key === k)?.value ?? ''
    const c = m.contacts.primary
    return [
      i + 1, m.name, m.category, `${m.score}%`, pill('size'), pill('useClass'), pill('acquisitive'),
      m.acquisitive?.requirements?.count ?? '', pill('locationType'),
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
}

export interface RawNewsItem {
  brandId: string
  headline: string
  url: string | null
  date: string
  upcoming: boolean
}

export interface RawBrandGeo {
  storeCount: number
  nearestMeters: number
  nearestName: string | null
  nearestTown: string | null
  sameFormCount: number | null
  sameFormNames: string[]
  sameFormNearestMeters: number | null
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
}

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
  return {
    count: reqs.length,
    sizeMin: mins.length ? Math.min(...mins) : null,
    sizeMax: maxs.length ? Math.max(...maxs) : null,
    useClasses,
    nationwide,
    nearbyPlaces: Array.from(nearby).slice(0, 4),
    otherPlaces: otherList.slice(0, 3),
    otherPlaceCount: otherList.length,
  }
}

export function assembleMatches(input: AssembleInput): { matches: BrandMatch[]; considered: number } {
  const { query, site } = input
  const key = regionKey(site.region, site.country)

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
      reqs.map((r) => ({ min: r.sizeMin, max: r.sizeMax })),
      estate,
      query.widen
    )
    if (!size) continue

    const codes = Array.from(new Set(reqs.flatMap((r) => r.useClasses)))
    const useClass = codes.length > 0 ? { codes, matches: codes.includes(query.useClass) } : null
    if (useClass && !useClass.matches && !query.widen) continue

    const newsItems = (newsByBrand.get(b.id) ?? []).sort((a, z) => z.date.localeCompare(a.date))
    const news: NewsEvidence | null = newsItems.length
      ? { count: newsItems.length, items: newsItems.slice(0, 3).map(({ brandId: _b, ...n }) => n) }
      : null
    const acquisitive = acquisitiveSignal(
      requirementEvidence(reqs, site, key),
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
      ? { miles: g.nearestMeters / METERS_PER_MILE, storeName: g.nearestName, town: g.nearestTown }
      : null

    // Typical unit for the band copy: the fascia range nearest the site's size.
    const typical = estate.length
      ? [...estate].sort(
          (a, z) =>
            Math.abs((a.p25 + a.p75) / 2 - query.sqft) - Math.abs((z.p25 + z.p75) / 2 - query.sqft)
        )[0]
      : null

    const contacts = rankContacts(
      [...(input.brandContacts.get(b.id) ?? []), ...reqs.flatMap((r) => r.contacts)],
      key
    )

    const partial = { size, useClass, acquisitive, locationType, nearest }
    const { score, parts } = scoreMatch(partial)
    matches.push({
      brandId: b.id,
      name: b.name,
      logoUrl: b.logoUrl,
      domain: b.domain,
      category: b.category,
      storeCount: g?.storeCount ?? b.storeCount,
      ...partial,
      tradingFacts: input.tradingFacts?.get(b.id) ?? null,
      typicalRange: typical ? { min: typical.p25, max: typical.p75 } : null,
      contacts,
      score,
      scoreParts: parts,
    })
  }

  return { matches: sortMatches(matches, 'best'), considered }
}
