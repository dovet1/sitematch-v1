// Size filtering for the Assess-Area brand lists.
//
// The job this serves: a user holding a vacant unit wants the shortlist of
// brands worth phoning about it. Two different claims answer that, and this
// module keeps them apart on purpose:
//
//   requirement  what the occupier SAYS IT WANTS. Current, authoritative,
//                curated. The stronger signal, so it leads and it wins the
//                matching when present.
//   observed     what its existing shops MEASURE, from the EPC registers via
//                brand_floor_area_profiles. Available for far more brands, but
//                historic, inferred, and gross internal area rather than the
//                sales area an agent has in mind.
//
// Never merge the two into one number. Everything below that returns a range
// says which of the two it came from.
//
// Two more rules are load-bearing:
//   - Size is a property of the FORMAT, not the brand. Tesco's brand-level
//     range (3,722–45,260 sq ft) is useless; split by fascia it is Express
//     ~3,950 and Extra ~105,000. `selectProfiles` enforces that.
//   - A filter demotes, it never deletes. "We don't know their size" and
//     "they don't fit" are different answers and get different groups, and a
//     near miss stays in the main list because that is where the deals are.

export const M2_TO_SQFT = 10.7639

// Every m2 -> sq ft conversion in the product goes through here. Stores get
// theirs from a generated column in the database; profiles have no such column,
// so this is the one place the factor is written in application code.
export function sqFtFromM2(m2: number): number {
  return Math.round(m2 * M2_TO_SQFT)
}

export type SizeBandId = 'u1' | '1-3' | '3-10' | '10-50' | '50+'

export interface SizeBand {
  id: SizeBandId
  // Full label, used in the popover.
  label: string
  // Short form, used on the active trigger and in group headers.
  short: string
  lo: number
  // Infinity for the open-ended top band.
  hi: number
}

export const SIZE_BANDS: SizeBand[] = [
  { id: 'u1', label: 'Under 1,000 sq ft', short: 'under 1,000', lo: 0, hi: 1000 },
  { id: '1-3', label: '1,000 – 3,000 sq ft', short: '1,000–3,000', lo: 1000, hi: 3000 },
  { id: '3-10', label: '3,000 – 10,000 sq ft', short: '3,000–10,000', lo: 3000, hi: 10000 },
  {
    id: '10-50',
    label: '10,000 – 50,000 sq ft',
    short: '10,000–50,000',
    lo: 10000,
    hi: 50000,
  },
  { id: '50+', label: '50,000 sq ft +', short: '50,000+', lo: 50000, hi: Infinity },
]

export function bandById(id: SizeBandId | null): SizeBand | null {
  if (!id) return null
  return SIZE_BANDS.find((b) => b.id === id) ?? null
}

// One row of brand_floor_area_profiles, converted to sq ft for display.
// `fasciaId === null` is the brand-level profile.
export interface FloorAreaProfile {
  brandId: string
  fasciaId: string | null
  fasciaName: string | null
  minSqFt: number
  p25SqFt: number
  medianSqFt: number
  p75SqFt: number
  maxSqFt: number
  sampleCount: number
  coefficientOfVariation: number | null
}

export type BrandProfileMap = Record<string, FloorAreaProfile[]>

// brand_floor_area_profiles refuses to summarise fewer than five shops, and it is
// right to: quartiles over three points are noise. But "no distribution" is not
// "nothing to say" — for those brands we hold the individual measurements, and
// showing them beats showing nothing.
//
// The evidence they carry varies enormously and the UI must not flatten that.
// Three of a three-shop estate is a census. Two of a thirty-shop estate is a
// corner of it, and could easily be the two atypical shops. Both are worth
// showing; neither is worth showing without its denominator. So every one of
// these carries "N of M shops measured", and none of them is ever drawn as a
// distribution — no IQR box, no median, no "typical size".
export interface MeasuredEstate {
  brandId: string
  // Shops the brand trades from, measured or not — the denominator that says
  // whether these figures describe the estate or just a corner of it.
  totalStores: number
  // High-confidence measurements only, ascending. Never empty.
  measuredSqFt: number[]
}

// Share of the estate these figures actually cover, 0–1. The number the reader
// needs in order to know how much weight the figures can bear.
export function measuredCoverage(m: MeasuredEstate): number {
  if (m.totalStores <= 0) return 0
  return Math.min(1, m.measuredSqFt.length / m.totalStores)
}

export type MeasuredEstateMap = Record<string, MeasuredEstate>

export function measuredRange(m: MeasuredEstate): SizeRange | null {
  if (m.measuredSqFt.length === 0) return null
  return [
    Math.min(...m.measuredSqFt),
    Math.max(...m.measuredSqFt),
  ]
}

// Rule 1 in one function. A brand with more than one fascia profile is read at
// fascia level and its brand-level row is dropped: a single median across
// Tesco Express and Tesco Extra describes neither. A brand with one fascia
// profile, or only a brand-level row, is read as a single distribution.
export function selectProfiles(rows: FloorAreaProfile[]): FloorAreaProfile[] {
  const fascias = rows.filter((r) => r.fasciaId !== null)
  if (fascias.length > 0) return fascias
  return rows.filter((r) => r.fasciaId === null)
}

// A closed or half-open sq ft range being matched against a band.
export type SizeRange = [number, number]

export type SizeFit = 'fit' | 'near' | 'outside' | 'unknown'

export function overlaps(lo: number, hi: number, band: SizeBand): boolean {
  return lo <= band.hi && hi >= band.lo
}

// Near misses are conversations, not exclusions: a brand wanting 2,000–3,000
// when the unit is 1,900 is still worth the call. 25% above / 25% below the
// band, and only when it does not already overlap.
export function near(lo: number, hi: number, band: SizeBand): boolean {
  if (overlaps(lo, hi, band)) return false
  if (lo > band.hi) return band.hi !== Infinity && lo <= band.hi * 1.25
  if (hi < band.lo) return hi >= band.lo * 0.75
  return false
}

// A stated requirement, in sq ft. Either bound may be open.
export interface RequirementSize {
  min: number | null
  max: number | null
}

export function requirementRange(req: RequirementSize | null): SizeRange | null {
  if (!req) return null
  if (req.min == null && req.max == null) return null
  return [req.min ?? 0, req.max ?? Infinity]
}

// What gets matched against the band. The requirement wins outright when there
// is one — it is the current, authoritative claim, and the observed estate must
// not water it down. Otherwise the IQR (p25–p75) of each retained profile: the
// middle half of the estate, not its extremes.
export function effectiveRanges(
  requirement: RequirementSize | null,
  profiles: FloorAreaProfile[],
  measured?: MeasuredEstate | null
): SizeRange[] | null {
  const req = requirementRange(requirement)
  if (req) return [req]
  if (profiles.length > 0) return profiles.map((p) => [p.p25SqFt, p.p75SqFt])
  // Small estates match on what was actually measured, min to max. There is no
  // IQR to take and pretending otherwise would invent a middle half that does
  // not exist.
  if (measured) return measuredRange(measured) ? [measuredRange(measured)!] : null
  return null
}

export function fitFor(ranges: SizeRange[] | null, band: SizeBand): SizeFit {
  if (!ranges || ranges.length === 0) return 'unknown'
  if (ranges.some(([lo, hi]) => overlaps(lo, hi, band))) return 'fit'
  if (ranges.some(([lo, hi]) => near(lo, hi, band))) return 'near'
  return 'outside'
}

// Which fascia profiles to show once a band is active: only the formats that
// actually answer the question. Falls back to all of them when none match, so a
// card never loses its size block entirely.
export function matchingProfiles(
  profiles: FloorAreaProfile[],
  band: SizeBand | null
): FloorAreaProfile[] {
  if (!band || profiles.length < 2) return profiles
  const matched = profiles.filter(
    (p) =>
      overlaps(p.p25SqFt, p.p75SqFt, band) || near(p.p25SqFt, p.p75SqFt, band)
  )
  return matched.length > 0 ? matched : profiles
}

// One brand (or one requirement) as the size filter sees it.
export interface SizeEntry {
  key: string
  hasRequirement: boolean
  requirement: RequirementSize | null
  profiles: FloorAreaProfile[]
  // Set only for a brand with no distribution profile — see MeasuredEstate.
  measured: MeasuredEstate | null
  // Ordering tiebreak and display footnote; the largest sample behind the brand.
  sampleCount: number
  // Last-resort tiebreak so the order is stable across renders.
  name: string
}

export function entrySampleCount(profiles: FloorAreaProfile[]): number {
  return profiles.reduce((max, p) => Math.max(max, p.sampleCount), 0)
}

export function classify(entry: SizeEntry, band: SizeBand): SizeFit {
  return fitFor(
    effectiveRanges(entry.requirement, entry.profiles, entry.measured),
    band
  )
}

export interface SizePartition<T> {
  // Fits and near misses, the brands worth calling about this unit.
  main: T[]
  // No size on record. Not the same answer as "doesn't fit", so it keeps its
  // own group and is never dropped.
  unknown: T[]
  // Known size, clearly outside the band. Demoted, never removed.
  outside: T[]
}

const FIT_RANK: Record<SizeFit, number> = { fit: 0, near: 1, outside: 2, unknown: 3 }

// Splits a list into the three groups and sorts the main list. Requirement-first
// order survives *within* each fit tier: fit beats near, then a stated
// requirement beats an inferred size, then the bigger sample leads.
export function partitionBySize<T>(
  items: T[],
  toEntry: (item: T) => SizeEntry,
  band: SizeBand
): SizePartition<T> {
  const main: { item: T; entry: SizeEntry; fit: SizeFit }[] = []
  const unknown: T[] = []
  const outside: T[] = []

  for (const item of items) {
    const entry = toEntry(item)
    const fit = classify(entry, band)
    if (fit === 'unknown') unknown.push(item)
    else if (fit === 'outside') outside.push(item)
    else main.push({ item, entry, fit })
  }

  main.sort(
    (a, b) =>
      FIT_RANK[a.fit] - FIT_RANK[b.fit] ||
      Number(b.entry.hasRequirement) - Number(a.entry.hasRequirement) ||
      b.entry.sampleCount - a.entry.sampleCount ||
      a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: 'base' })
  )

  return { main: main.map((m) => m.item), unknown, outside }
}

// Live "N brands fit" counts for the popover, over whatever the other filters
// have already left on screen. Counts fits only — a near miss is shown, but it
// is not a claim that the brand fits.
export function bandFitCounts(entries: SizeEntry[]): Record<SizeBandId, number> {
  const counts = {} as Record<SizeBandId, number>
  for (const band of SIZE_BANDS) {
    counts[band.id] = entries.filter((e) => classify(e, band) === 'fit').length
  }
  return counts
}

export function unknownCount(entries: SizeEntry[]): number {
  return entries.filter(
    (e) => effectiveRanges(e.requirement, e.profiles, e.measured) === null
  ).length
}

/* ---------- formatting ---------- */

// Round to the precision the data can carry, never further. These are
// distributions over dozens of shops; a figure like "3,271 sq ft" would claim a
// precision that does not exist.
export function formatSqFt(n: number): number {
  if (n < 1000) return Math.round(n / 10) * 10
  if (n < 10000) return Math.round(n / 50) * 50
  if (n < 100000) return Math.round(n / 500) * 500
  return Math.round(n / 1000) * 1000
}

export function formatSqFtValue(n: number): string {
  return formatSqFt(n).toLocaleString('en-GB')
}

export function formatSqFtRange(lo: number, hi: number): string {
  if (formatSqFt(lo) === formatSqFt(hi)) return formatSqFtValue(lo)
  return `${formatSqFtValue(lo)}–${formatSqFtValue(hi)}`
}

// The requirement line on a card. Open-ended bounds read as From/Up to rather
// than inventing a bound the occupier never stated.
export function formatRequirement(req: RequirementSize): string | null {
  if (req.min != null && req.max != null) return formatSqFtRange(req.min, req.max)
  if (req.min != null) return `From ${formatSqFtValue(req.min)}`
  if (req.max != null) return `Up to ${formatSqFtValue(req.max)}`
  return null
}

// Spread as a word, never as a number: a coefficient of variation printed as
// "0.41" gets quoted back without its caveat. Empty string when the spread is
// unremarkable, so nothing is said.
export function spreadWord(cov: number | null): string {
  if (cov == null) return ''
  if (cov >= 0.38) return 'wide spread'
  if (cov <= 0.2) return 'tight'
  return ''
}

export function sampleFootnote(profile: FloorAreaProfile): string {
  const stores = `${profile.sampleCount.toLocaleString('en-GB')} ${
    profile.sampleCount === 1 ? 'store' : 'stores'
  }`
  const spread = spreadWord(profile.coefficientOfVariation)
  return spread ? `${stores} · ${spread}` : stores
}

// Geometry for the min–max rail with its IQR box and median tick, as
// percentages of the full span. The bar is how spread is read; the box is
// clamped to a visible minimum so a very tight distribution still draws.
export function distributionGeometry(profile: FloorAreaProfile): {
  boxLeft: number
  boxWidth: number
  medianLeft: number
} {
  const span = profile.maxSqFt - profile.minSqFt || 1
  const pct = (v: number) => ((v - profile.minSqFt) / span) * 100
  const boxLeft = Math.min(97, Math.max(0, pct(profile.p25SqFt)))
  const boxWidth = Math.max(3, Math.min(100 - boxLeft, pct(profile.p75SqFt) - boxLeft))
  return {
    boxLeft: Math.round(boxLeft),
    boxWidth: Math.round(boxWidth),
    medianLeft: Math.round(Math.min(100, Math.max(0, pct(profile.medianSqFt)))),
  }
}

// A small estate reads as the shops themselves, not as a summary of them. Up to
// three are listed individually — three tight figures say "this is their format"
// far better than a range does — and beyond that the span, because a list stops
// being readable.
export function formatMeasuredShops(m: MeasuredEstate): string {
  const values = [...m.measuredSqFt].sort((a, b) => a - b)
  if (values.length === 0) return ''
  if (values.length <= 3) return values.map(formatSqFtValue).join(' · ')
  return formatSqFtRange(values[0], values[values.length - 1])
}

// The denominator is the whole point: "1 of 4 shops measured" is a different
// claim from "3 of 3", and the reader has to be able to tell them apart.
export function measuredFootnote(m: MeasuredEstate): string {
  const noun = m.totalStores === 1 ? 'shop' : 'shops'
  return `${m.measuredSqFt.length} of ${m.totalStores} ${noun} measured`
}
