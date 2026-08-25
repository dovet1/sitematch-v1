// M8 constraints screening — PURE interpretation of the spatial constraint overlaps.
//
// The spatial maths (does a parcel intersect an EA Flood Zone or the Green Belt, and
// over how much of its area) is done once in PostGIS during enrichment (see
// 20260735000000_associate_candidate_constraints.sql) and stored on
// candidate_site_constraints. THIS module is the pure, unit-tested layer that turns
// those raw overlap fractions into normalised, hedged SCREENING signals and — crucially —
// into the `constraints: string[]` token list the engine's `planning_constraints`
// evaluator consumes (criteria.ts). Keeping it here (not in SQL) means the mapping is
// Jest-tested and the occupier's exclude/warn/prefer decision stays a SEARCH-time concern.
//
// Two project invariants this module protects:
//
//   1. Nothing here is a suitability / planning verdict. A flood-zone or green-belt
//      intersection is a documented SCREENING FLAG that a human (and a formal
//      flood-risk / planning assessment) must review — never "this site is undevelopable"
//      nor "this site is fine". Severity (exclusion vs warning vs preference) is decided
//      by the occupier requirement at search time, not asserted here.
//   2. Absence is reported honestly. These are authoritative national polygon layers
//      (EA Flood Map, national Green Belt), so a parcel with NO intersecting feature is a
//      real negative — "not within the mapped Flood Zone 2/3 / Green Belt" — but that is
//      NOT a claim of "no flood risk" or "no nearby designation". The hedge travels with
//      the result. (A layer that was never imported is a separate, upstream unknown — the
//      enrichment simply has no rows for it, and the inspect report states which layers
//      were loaded.)

/** Normalised constraint tokens. String-typed (not a closed union) so a new layer can be
 *  added by importing it — the engine's planning_constraints evaluator matches on the raw
 *  token against the occupier's exclusion/warning/preference lists. */
export type ConstraintType = 'flood_zone_2' | 'flood_zone_3' | 'green_belt' | (string & {})

/** Broad grouping of a constraint token, for reporting + debug colouring. */
export type ConstraintCategory = 'flood' | 'green_belt' | 'other'

/** Qualitative share-of-parcel band for a constraint overlap. `none` is a real measured
 *  ~zero (an edge/point touch below the epsilon), distinct from the constraint simply not
 *  being present (no row at all). */
export type OverlapBand = 'none' | 'marginal' | 'partial' | 'majority' | 'within'

export interface OverlapThresholds {
  /** Overlap fraction at/below this is treated as `none` (edge/point touch noise). */
  zeroEpsilon: number
  /** Below this → `marginal`. */
  marginalMax: number
  /** Below this → `partial`. */
  partialMax: number
  /** Below this → `majority`; at/above → `within` (essentially the whole parcel). */
  majorityMax: number
}

export const DEFAULT_OVERLAP_THRESHOLDS: OverlapThresholds = {
  zeroEpsilon: 0.01, // ≤1% of the parcel = a clip, not a real overlap
  marginalMax: 0.1, //  <10% → marginal
  partialMax: 0.5, //   <50% → partial
  majorityMax: 0.95, // <95% → majority; ≥95% → within
}

/** One aggregated constraint intersection for a site, as stored on
 *  candidate_site_constraints (one row per (site, constraint_type)). */
export interface SiteConstraintRaw {
  constraintType: string
  category: string | null
  /** Fraction (0–1) of the SITE polygon covered by the union of this constraint type. */
  overlapFraction: number | null
  overlapAreaSqm: number | null
  featureCount: number | null
}

export interface ConstraintScreeningDetail {
  constraintType: string
  category: ConstraintCategory
  band: OverlapBand
  overlapFraction: number | null
  /** Hedged, human-readable note — always a screening flag, never a verdict. */
  note: string
}

export interface ConstraintScreening {
  /** The constraint tokens present (fed to the engine's planning_constraints evaluator). */
  constraints: string[]
  details: ConstraintScreeningDetail[]
  hasFloodZone2: boolean
  hasFloodZone3: boolean
  hasGreenBelt: boolean
  /** True when NO constraint of any loaded layer intersects the parcel. */
  clear: boolean
  /** Hedged screening notes for the whole site. */
  notes: string[]
}

const FLOOD_LABELS: Record<string, string> = {
  flood_zone_2: 'EA Flood Zone 2 (medium probability)',
  flood_zone_3: 'EA Flood Zone 3 (high probability)',
}

/** Map a raw source label / importer flag to a normalised constraint token. Kept pure +
 *  tested so the importer's classification is not silently wrong. Returns null when the
 *  input cannot be confidently mapped (the importer then skips it — unknown stays out). */
export function normaliseConstraintType(raw: string | null | undefined): ConstraintType | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (s === '') return null
  // Already a normalised token.
  if (s === 'flood_zone_2' || s === 'flood_zone_3' || s === 'green_belt') return s
  // EA Flood Map variants: "flood zone 3", "fz3", "zone_3", a bare "3"/"2".
  const flood = s.match(/(?:flood_?)?(?:zone_?)?(?:fz_?)?([23])\b/)
  if ((/flood|fz|zone/.test(s) || /^[23]$/.test(s)) && flood) {
    return flood[1] === '3' ? 'flood_zone_3' : 'flood_zone_2'
  }
  // Green Belt variants.
  if (/green_?belt|greenbelt|green_belt/.test(s)) return 'green_belt'
  return null
}

/** The broad category of a constraint token (for reporting + debug colouring). */
export function constraintCategory(type: string): ConstraintCategory {
  if (type === 'flood_zone_2' || type === 'flood_zone_3' || type.startsWith('flood')) return 'flood'
  if (type === 'green_belt') return 'green_belt'
  return 'other'
}

/** Classify a single overlap fraction into a share-of-parcel band. */
export function classifyOverlap(
  overlapFraction: number | null,
  thresholds: OverlapThresholds = DEFAULT_OVERLAP_THRESHOLDS,
): OverlapBand {
  if (overlapFraction == null || overlapFraction <= thresholds.zeroEpsilon) return 'none'
  if (overlapFraction < thresholds.marginalMax) return 'marginal'
  if (overlapFraction < thresholds.partialMax) return 'partial'
  if (overlapFraction < thresholds.majorityMax) return 'majority'
  return 'within'
}

function humanLabel(type: string): string {
  if (FLOOD_LABELS[type]) return FLOOD_LABELS[type]
  if (type === 'green_belt') return 'Green Belt'
  return type.replace(/_/g, ' ')
}

function pctOfParcel(fraction: number | null): string {
  if (fraction == null) return 'an unmeasured share'
  const p = Math.round(fraction * 100)
  return p <= 0 ? '<1%' : `~${p}%`
}

/** Reduce a site's raw constraint intersections to a hedged screening summary + the
 *  constraint-token list the engine consumes. Rows whose overlap is below the epsilon
 *  (edge/point touches) are dropped from the token list but kept as a `none`-band detail
 *  so the near-miss is still inspectable. */
export function screenSiteConstraints(
  rows: SiteConstraintRaw[],
  thresholds: OverlapThresholds = DEFAULT_OVERLAP_THRESHOLDS,
): ConstraintScreening {
  const details: ConstraintScreeningDetail[] = []
  const tokens: string[] = []

  // De-duplicate defensively (the association table is unique per (site,type), but a
  // caller may pass merged rows) — keep the largest overlap per type.
  const byType = new Map<string, SiteConstraintRaw>()
  for (const r of rows) {
    const prev = byType.get(r.constraintType)
    if (!prev || (r.overlapFraction ?? 0) > (prev.overlapFraction ?? 0)) byType.set(r.constraintType, r)
  }

  for (const r of Array.from(byType.values())) {
    const category = (r.category as ConstraintCategory) ?? constraintCategory(r.constraintType)
    const band = classifyOverlap(r.overlapFraction, thresholds)
    const label = humanLabel(r.constraintType)
    const note =
      band === 'none'
        ? `Parcel only clips ${label} (${pctOfParcel(r.overlapFraction)}) — a near-miss to review, not treated as an intersecting constraint.`
        : `Parcel intersects ${label} over ${pctOfParcel(r.overlapFraction)} of its area (${band}) — a screening flag requiring review, not a planning/flood-risk verdict.`
    details.push({ constraintType: r.constraintType, category, band, overlapFraction: r.overlapFraction, note })
    // Only a real (above-epsilon) overlap contributes a constraint token to the engine.
    if (band !== 'none') tokens.push(r.constraintType)
  }

  // Deterministic ordering: flood zone 3 first (most severe), then flood 2, then the rest.
  const order = (t: string): number =>
    t === 'flood_zone_3' ? 0 : t === 'flood_zone_2' ? 1 : t === 'green_belt' ? 2 : 3
  tokens.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
  details.sort((a, b) => order(a.constraintType) - order(b.constraintType) || a.constraintType.localeCompare(b.constraintType))

  const hasFloodZone3 = tokens.includes('flood_zone_3')
  const hasFloodZone2 = tokens.includes('flood_zone_2')
  const hasGreenBelt = tokens.includes('green_belt')
  const clear = tokens.length === 0

  const notes: string[] = []
  if (clear) {
    notes.push('No mapped Flood Zone 2/3 or Green Belt intersection — not a claim of "no flood risk" or "no nearby designation".')
  } else {
    for (const d of details) if (d.band !== 'none') notes.push(d.note)
    if (hasFloodZone3 && hasFloodZone2) {
      notes.push('Flood Zone 3 sits within Flood Zone 2 by definition; the Zone 3 flag is the higher-probability one.')
    }
  }
  notes.push('Constraint layers are authoritative national datasets, but presence is a screening flag for review — never a suitability, developability or planning-permission verdict.')

  return { constraints: tokens, details, hasFloodZone2, hasFloodZone3, hasGreenBelt, clear, notes }
}

/** Map a site's raw constraint rows to the engine's SiteFeaturesRaw.constraints field.
 *  This is the single source of truth for what token list the deterministic
 *  planning_constraints evaluator sees. */
export function toSiteConstraintFeatures(rows: SiteConstraintRaw[]): { constraints: string[] } {
  return { constraints: screenSiteConstraints(rows).constraints }
}
