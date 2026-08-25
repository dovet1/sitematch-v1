// M7 existing-estate (same-brand distance) screening — PURE interpretation.
//
// Unlike the enrichment layers (M3 roads, M4 traffic, M5 land use, M6 geometry),
// same-brand distance is NOT baked into the occupier-agnostic candidate dataset: it
// depends on WHICH brand is searching, so it is computed at SEARCH TIME, per brand,
// against the live `stores` estate (the PostGIS RPC nearest_same_brand_store(); see
// 20260732000000_same_brand_distance.sql). THIS module is the pure, unit-tested layer
// that turns the raw nearest-store distance into a normalised screening signal and into
// the engine's SiteFeaturesRaw fields, protecting two project invariants:
//
//   1. `no estate` is satisfied, never `unknown`. If the brand has NO stores anywhere,
//      there is nothing to cannibalise → the criterion is trivially SATISFIED, not
//      unknown (a store's location is precisely known; absence of an estate is a real
//      answer). Existing-estate distance is one of the few criteria with NO unknown
//      state — we either have the brand's stores or the brand has none.
//   2. "Same brand" means the PARENT-GROUP estate. Distance is measured to the nearest
//      store of ANY fascia the brand operates (the RPC keys on brand_id, with an
//      optional fascia filter). The cannibalisation unit is the group, not one fascia.
//
// Nothing here is a suitability claim: a large same-brand distance means "clear of the
// existing estate", never "a good site". Thresholds are eyeball-tunable parameters
// (their defaults are broad screening bands, not asserted truths); a real occupier
// catchment (a drive-thru vs a supermarket) would set its own via the requirement.

/** Qualitative distance-to-existing-estate band. `no_estate` = the brand has no stores
 *  (satisfied trivially); the rest grade how close the nearest same-brand store is —
 *  `at`/`near` flag likely cannibalisation, `clear` is well away from the estate. */
export type BrandDistanceBand = 'no_estate' | 'at' | 'near' | 'moderate' | 'clear'

export interface BrandDistanceThresholds {
  /** At/below this many metres → `at` (effectively on top of an existing store). */
  atMaxM: number
  /** At/below this → `near`. */
  nearMaxM: number
  /** At/below this → `moderate`; above → `clear`. */
  moderateMaxM: number
}

/** Broad screening defaults (metres). ~0.25 mi / 1 mi / 3 mi — chosen to be inspected
 *  on the M7 debug map, not asserted. A real search overrides these from the
 *  requirement (the engine's `same_brand_distance` criterion uses its own `minMiles`). */
export const DEFAULT_BRAND_DISTANCE_THRESHOLDS: BrandDistanceThresholds = {
  atMaxM: 400, // ~0.25 mi
  nearMaxM: 1609.344, // 1 mi
  moderateMaxM: 4828.032, // 3 mi
}

export const METRES_PER_MILE = 1609.344

/** Raw same-brand-estate measurement for one site, as returned by the search-time RPC
 *  nearest_same_brand_store(). `null` distance = no same-brand store was found (either
 *  the brand has no estate, or none within the optional search cap). */
export interface BrandEstateRaw {
  /** True nearest distance (m) from the site to any SAME-BRAND (parent-group) store —
   *  computed uncapped by default, so a real distance is available whenever the brand
   *  has an estate. `null` = no same-brand store found. */
  nearestDistanceM: number | null
  /** Count of same-brand stores in the estate (nationally, after any fascia filter).
   *  0 = the brand has no stores anywhere → nothing to cannibalise. */
  brandStoreCount: number
}

export interface BrandDistanceScreening {
  band: BrandDistanceBand
  /** Nearest same-brand store distance (m), or null when the brand has no estate (or
   *  none within the search cap). Never a fabricated zero. */
  nearestDistanceM: number | null
  /** Whether the brand has ANY store in the estate — the flag the engine reads to
   *  decide "no estate to cannibalise → satisfied" vs a real distance test. */
  brandHasStores: boolean
}

/** Classify a raw same-brand-estate measurement into a screening band. `no_estate`
 *  (brand has no stores) is kept distinct from a measured distance; there is no
 *  `unknown` band by design. */
export function classifyBrandDistance(
  raw: BrandEstateRaw,
  thresholds: BrandDistanceThresholds = DEFAULT_BRAND_DISTANCE_THRESHOLDS,
): BrandDistanceScreening {
  // No estate anywhere → nothing to cannibalise. Satisfied, not unknown.
  if (raw.brandStoreCount <= 0) {
    return { band: 'no_estate', nearestDistanceM: null, brandHasStores: false }
  }
  // Brand HAS an estate. With an uncapped search a distance is always available; a null
  // here can only mean "no store within the optional search cap" → clear of the estate.
  if (raw.nearestDistanceM == null) {
    return { band: 'clear', nearestDistanceM: null, brandHasStores: true }
  }
  const d = raw.nearestDistanceM
  const band: BrandDistanceBand =
    d <= thresholds.atMaxM
      ? 'at'
      : d <= thresholds.nearMaxM
        ? 'near'
        : d <= thresholds.moderateMaxM
          ? 'moderate'
          : 'clear'
  return { band, nearestDistanceM: d, brandHasStores: true }
}

/** Map a raw same-brand-estate measurement to the engine's SiteFeaturesRaw fields
 *  (`sameBrandDistanceM` / `brandHasStores`). Encodes the load-bearing rule: a brand
 *  with NO estate yields `brandHasStores=false` + `null` distance, which the
 *  `same_brand_distance` criterion reads as SATISFIED (no cannibalisation), never
 *  unknown; a brand with an estate yields its real nearest distance for the ≥ N-mile
 *  test. `null` distance is never coerced to 0. */
export function toBrandDistanceFeatures(raw: BrandEstateRaw): {
  sameBrandDistanceM: number | null
  brandHasStores: boolean
} {
  if (raw.brandStoreCount <= 0) {
    return { sameBrandDistanceM: null, brandHasStores: false }
  }
  return { sameBrandDistanceM: raw.nearestDistanceM, brandHasStores: true }
}

function fmtMiles(m: number): string {
  return `${(m / METRES_PER_MILE).toFixed(2)} mi`
}

/** Hedged, human-readable screening note for one site — never a suitability claim. */
export function describeBrandDistance(s: BrandDistanceScreening): string {
  switch (s.band) {
    case 'no_estate':
      return 'No existing same-brand stores — nothing to cannibalise (satisfied).'
    case 'at':
      return `An existing same-brand store is ~${fmtMiles(s.nearestDistanceM as number)} away — likely overlaps the existing estate.`
    case 'near':
      return `Nearest existing same-brand store ~${fmtMiles(s.nearestDistanceM as number)} away — may cannibalise; review catchment.`
    case 'moderate':
      return `Nearest existing same-brand store ~${fmtMiles(s.nearestDistanceM as number)} away.`
    case 'clear':
      return s.nearestDistanceM == null
        ? 'No same-brand store within the search radius — clear of the existing estate.'
        : `Nearest existing same-brand store ~${fmtMiles(s.nearestDistanceM as number)} away — clear of the existing estate.`
  }
}
