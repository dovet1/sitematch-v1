/**
 * The shape returned by the `epc_pipeline_health()` RPC
 * (supabase/migrations/20260913000000_epc_pipeline_health.sql).
 *
 * Hand-written rather than generated because the function returns jsonb, which generated
 * types render as `Json` and therefore as `any` at every use. These declarations are the
 * only description of that payload; if the migration changes, change them together.
 */

/**
 * A register and the snapshot its last load established.
 *
 * Every figure here is recorded on the load run, not counted live: on the real table a
 * count of epc_certificates runs 0.2s warm and over the 8s statement timeout cold, and
 * none of these numbers can change until the next load. Migration 20260914000000 carries
 * the timings. A load that failed has null counts.
 */
export interface RegisterHealth {
  source: string
  snapshot_ref: string | null
  status: string | null
  error: string | null
  load_started_at: string | null
  loaded_at: string | null
  days_since_load: number | null
  certificates: number | null
  /** Certificates carrying a coordinate. Spatial matching can never consider the rest. */
  with_geom: number | null
  newest_certificate: string | null
}

export interface MatchRun {
  id: string
  kind: 'incremental' | 'full' | 'backfill' | string
  matcher_version: string
  status: 'running' | 'complete' | 'failed' | string
  stores_considered: number
  matched_high: number
  matched_medium: number
  matched_low: number
  matched_none: number
  errored: number
  error: string | null
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
}

export interface QueueHealth {
  /** Stores with a postcode and no match row: never attempted. */
  never_attempted: number
  /** Errored, still under the attempt limit — the worker will pick these up again. */
  retryable: number
  /** Errored past the attempt limit. Nothing will retry these without a human. */
  dead_letters: number
  /** No postcode, so the matcher has nothing to look up. Not a failure, and not retried. */
  no_postcode: number
  max_attempts: number
}

export interface DeadLetter {
  store_id: string
  store_name: string | null
  town: string | null
  postcode: string | null
  match_attempts: number
  last_error: string
  computed_at: string
  will_retry: boolean
}

export interface CoverageByVersion {
  matcher_version: string
  rows_total: number
  high: number
  medium: number
  low: number
  none: number
  /** Demoted as implausible for the format — almost always a concession. */
  demoted: number
  first_computed_at: string | null
  last_computed_at: string | null
}

export interface CoverageHealth {
  estate: number
  /** The denominator that matters: a store with no postcode is not a matching failure. */
  estate_with_postcode: number
  rows_total: number
  high: number
  medium: number
  low: number
  none: number
  demoted: number
  by_matcher_version: CoverageByVersion[]
}

export interface CoordinateBucket {
  pqi: string | null
  has_place_id: boolean
  stores: number
}

/**
 * Eligibility, not coverage. Spatial fires on 9–25% of the stores it may consider
 * (plan §4.5), so these counts are an upper bound on what spatial could ever reach.
 */
export interface SpatialEligibility {
  /** Calibrated at 25m near / 25m margin, 93.8% agreement. */
  rooftop: number
  /** Google-confirmed to 10m. Needs its own 10m/35m calibration — 87.9% at Rooftop's. */
  google_validated: number
  /**
   * Outside both calibrations: graded something other than Rooftop and holding no place
   * id. Measured 60 on 2026-09-07 — 37 'Third Party', 23 'Building'. Not "ungraded": they
   * carry a grade the 25m radius was never calibrated for, which is the same outcome.
   */
  no_signal: number
}

export interface FloorAreaHealth {
  generated_at: string
  register: RegisterHealth[]
  matching: { recent: MatchRun[] }
  queue: QueueHealth
  dead_letters: DeadLetter[]
  coverage: CoverageHealth
  coordinates: { buckets: CoordinateBucket[]; spatial: SpatialEligibility }
}

/** What POST /api/admin/stores/floor-areas/run-match returns to the Run now button. */
export interface RunMatchResponse {
  success: boolean
  considered?: number
  high?: number
  medium?: number
  low?: number
  none?: number
  errored?: number
  message?: string
  error?: string
}

/* --------------------------------------------------------------- brand tab */

/**
 * One row of `brand_floor_area_profiles`, in the shape and units the public route
 * serves. Converted with the same `sqFtFromM2`, so the admin screen and the product
 * cannot disagree about a number. `fasciaId === null` is the brand-level profile.
 */
export interface AdminFloorAreaProfile {
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
  /** A marker, not a claim: rows behind one profile can come from several matchers. */
  matcherVersion: string | null
  generatedAt: string | null
}

/**
 * One shop, as the brand tab draws it. Only the fields the screen renders: the evidence
 * view (§6.2) is one click away and holds everything else, so sending confidence,
 * matcher version and computed-at for thousands of shops was a megabyte nobody read.
 */
export interface ProfileStore {
  id: string
  name: string | null
  town: string | null
  fasciaId: string | null
  sqFt: number | null
  m2: number | null
}

/** Shops the aggregate left out, grouped by why. The count is the scale, the sample is
 *  enough to recognise a pattern — a cluster in one fascia is a concession defect. */
export interface ExcludedGroup {
  headline: string
  count: number
  sample: ProfileStore[]
}

export interface BrandFloorAreas {
  profiles: AdminFloorAreaProfile[]
  /** Measured shops only — the ones behind the published numbers. */
  stores: ProfileStore[]
  excluded: ExcludedGroup[]
  estate: { stores: number; measured: number; truncated: boolean }
  brandPublication: { published: boolean; detail: string }
}
