// Domain types for the deterministic occupier → candidate-site matching engine.
//
// Design notes:
// - The engine is PURE and geospatial-agnostic. It consumes already-normalised
//   `SiteFeaturesRaw` (produced by PostGIS enrichment + the search service) and
//   `OccupierRequirement.criteria`, and produces per-criterion results + a score.
//   No IO, no LLM, no PostGIS in this layer — so it is fully unit-testable.
// - Adding a new criterion later means registering one more evaluator (see
//   criteria.ts) — never rewriting the engine.
// - `unknown` is a first-class status, deliberately distinct from `fail`: missing
//   data must never silently eliminate a candidate.

/** The criteria supported by the MVP registry. String-typed in the DB JSONB so
 *  new keys can be added without a migration; the registry ignores unknown keys. */
export type CriterionKey =
  | 'site_area'
  | 'road_proximity'
  | 'traffic_aadf'
  | 'road_frontage'
  | 'junction_distance'
  | 'land_use'
  | 'planning_constraints'
  | 'same_brand_distance'
  | 'access'

/** How a criterion influences the outcome:
 *  - required: a `fail` makes the site ineligible (excluded from the shortlist,
 *    but still inspectable). A `pass` counts toward the match score.
 *  - preferred: never eliminates; contributes a weighted amount to the score.
 *  - warning: surfaced for human review; score-neutral by default. */
export type CriterionMode = 'required' | 'preferred' | 'warning'

export type CriterionStatus = 'pass' | 'fail' | 'unknown' | 'warning'

/** One entry of `occupier_requirements.criteria` (the JSONB authoritative config). */
export interface CriterionConfig {
  key: CriterionKey
  mode: CriterionMode
  /** Weight for `preferred`/`required` scoring. Defaults to 1 when omitted. */
  weight?: number
  /** Criterion-specific parameters (min/max, class lists, etc.). */
  params?: Record<string, unknown>
  /** Optional display label override. */
  label?: string
}

/** A nearby road, resolved from enrichment. One entry per relevant road class. */
export interface RoadFeature {
  roadClass: string // e.g. 'A Road', 'B Road', 'Motorway'
  roadNumber: string | null // e.g. 'A28'
  distanceM: number
  aadf: number | null
  aadfYear: number | null
  aadfSource: string | null
  /** DfT's own quality signal, e.g. 'Counted' | 'Estimated'. Not an invented bucket. */
  estimationMethod: string | null
}

/** Cheap geometric attributes preserved for inspection — NOT used in ranking (MVP). */
export interface ShapeDiagnostics {
  bboxWidthM: number | null
  bboxDepthM: number | null
  perimeterM: number | null
  /** Polsby–Popper-style compactness in [0,1]; 1 = circle. */
  compactness: number | null
  minRectWidthM: number | null
  minRectDepthM: number | null
}

export type LandUseConfidence = 'high' | 'medium' | 'low'

/** The per-search, normalised feature bundle the engine scores. Built by the
 *  service from stored `candidate_site_features` + the requirement's road classes
 *  + a live same-brand-distance calculation. `null` consistently means "unknown /
 *  not computed", never "zero". */
export interface SiteFeaturesRaw {
  siteId: string
  name: string | null
  areaAcres: number | null
  currentLandUse: string | null // normalised broad category, or null = unknown
  landUseConfidence: LandUseConfidence | null
  /** Nearby roads (nearest per relevant class). `null` = enrichment produced no
   *  road data (→ unknown); `[]` = computed, none nearby (→ can fail proximity). */
  roads: RoadFeature[] | null
  /** Approximate frontage (m) onto the relevant road. null = not computed. */
  frontageM: number | null
  nearestJunctionDistanceM: number | null
  junctionType: string | null
  /** Min distance (m) to an existing same-brand store. null = brand has no stores
   *  → treated as satisfied (no cannibalisation), NOT as unknown. */
  sameBrandDistanceM: number | null
  brandHasStores: boolean
  /** Constraint types intersecting the site, e.g. ['flood_zone_3','green_belt']. */
  constraints: string[]
  shape?: ShapeDiagnostics | null
}

export interface ConstraintDetail {
  constraint: string
  severity: 'exclusion' | 'warning' | 'preference'
}

/** The result of evaluating one criterion against one site. */
export interface CriterionResult {
  criterion: CriterionKey
  label: string
  status: CriterionStatus
  mode: CriterionMode
  weight: number
  /** Human-readable observed value, e.g. '0.52 acres', 'A28 – 12m', or null. */
  value: string | null
  /** Human-readable requirement, e.g. '0.3–0.7 acres', '≥15,000 AADF'. */
  requirement: string | null
  /** Extra context, e.g. 'Requires highways review'. */
  message?: string
  /** For planning_constraints: the per-constraint breakdown for the UI. */
  details?: ConstraintDetail[]
  /** How firm the evidence behind a `pass` is. 'approximate' = matched but on a soft
   *  signal (Estimated AADF, approximate frontage/junction, non-high-confidence land use)
   *  → the tiering layer counts it as a *partial* match. Absent ⇒ firm. */
  evidenceStrength?: 'firm' | 'approximate'
  /** site_area only: the registered title is LARGER than the requested maximum footprint.
   *  It is retained (not failed) and flagged so ranking penalises it and the UI labels it
   *  ("larger than requested footprint; may contain a suitable area"). */
  oversized?: boolean
}

export type MatchLabel = 'strong' | 'potential' | 'weak'

export interface SiteMatchResult {
  siteId: string
  name: string | null
  /** % criteria match (NOT % suitable). See scoring.ts for the exact definition. */
  score: number
  label: MatchLabel
  /** false when a required criterion failed. Kept for inspection, ranked last. */
  eligible: boolean
  criteria: CriterionResult[]
  warnings: string[]
  /** "Matches {matched} of {measurable} measurable criteria". */
  matched: number
  measurable: number
}

export interface OccupierRequirement {
  id: string
  brandId: string | null
  name: string
  profileType: string | null
  description: string | null
  criteria: CriterionConfig[]
}

/** One gate of the diagnostic filtering funnel. Distinguishes fail from
 *  not-evaluable so poor data coverage is never mistaken for tight criteria. */
export interface FunnelGate {
  criterion: CriterionKey
  label: string
  entering: number
  pass: number
  fail: number
  unknown: number
  /** Whether unknowns are carried into the next gate (true for the MVP). */
  retainedUnknown: boolean
  surviving: number
}

export interface CoverageStat {
  field: string
  present: number
  total: number
  /** present/total as a 0–100 percentage. */
  pct: number
}

export interface SearchDiagnostics {
  universe: number
  funnel: FunnelGate[]
  coverage: CoverageStat[]
  /** Sites remaining after all required gates. */
  survivors: number
}
