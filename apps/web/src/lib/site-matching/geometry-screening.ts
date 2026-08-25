// M6 derived-geometry screening — PURE interpretation of the spatial measurements.
//
// The spatial maths (approximate frontage length, nearest junction/roundabout
// distance) is done once in PostGIS during enrichment (see
// 20260730000000_associate_candidate_geometry.sql) and stored on
// candidate_site_geometry. THIS module is the pure, unit-tested layer that turns
// those raw metres into normalised, hedged SCREENING signals — the part most prone
// to silent error, and the part that must protect two project invariants:
//
//   1. `unknown` is never `zero`. If a parcel had NO associated road at all (M3
//      found nothing within its search radius), its frontage is genuinely UNKNOWN —
//      not 0. Only a parcel that HAS a nearby road but presents no edge within the
//      frontage buffer has a real, measured frontage of ~0 ("set back / no abutting
//      edge"). Collapsing those two would fabricate a "no frontage" fail out of
//      missing data.
//   2. Nothing here is an access/suitability claim. Frontage and junction distance
//      are documented approximations from open centreline data — screening signals a
//      human reviews, never an engineering measurement or a highways verdict.
//
// Everything is a broad, eyeball-tunable band; thresholds are parameters (their
// defaults were chosen to be inspected on the M6 debug map, not asserted as truth).

/** Qualitative frontage band. `unknown` = no road was associated (missing data);
 *  `none` = a road is nearby but the parcel presents ~no edge within the buffer
 *  (a real measured zero); the rest grade a positive measured frontage. */
export type FrontageBand = 'unknown' | 'none' | 'narrow' | 'moderate' | 'wide'

/** Qualitative proximity band to the nearest significant node (junction/roundabout). */
export type JunctionBand = 'unknown' | 'at' | 'near' | 'moderate' | 'far'

export interface FrontageThresholds {
  /** Below this many metres of measured frontage → `narrow`. */
  narrowMaxM: number
  /** Below this many metres → `moderate`; at/above → `wide`. */
  moderateMaxM: number
  /** Measured frontage at/below this is treated as `none` (buffer noise, not an edge). */
  zeroEpsilonM: number
}

export interface JunctionThresholds {
  /** At/below this → `at` (effectively on the junction). */
  atMaxM: number
  /** Below this → `near`. */
  nearMaxM: number
  /** Below this → `moderate`; at/above → `far`. */
  moderateMaxM: number
}

export const DEFAULT_FRONTAGE_THRESHOLDS: FrontageThresholds = {
  narrowMaxM: 10,
  moderateMaxM: 40,
  zeroEpsilonM: 1,
}

export const DEFAULT_JUNCTION_THRESHOLDS: JunctionThresholds = {
  atMaxM: 25,
  nearMaxM: 100,
  moderateMaxM: 300,
}

/** Raw M6 measurements for one site, as stored on candidate_site_geometry. `null`
 *  consistently means "not computed / unknown", never zero. */
export interface SiteGeometryRaw {
  /** Approx frontage (m) onto the site's nearest-overall associated road. */
  frontageM: number | null
  /** Approx frontage (m) onto the nearest A/B/Motorway associated road, if any. */
  primaryFrontageM: number | null
  /** Did M3 associate ANY road within its search radius? Distinguishes a measured
   *  zero frontage from an unknown one. */
  hasAssociatedRoad: boolean
  /** Distance (m) to the nearest significant node (junction OR roundabout). */
  nearestJunctionM: number | null
  /** OS formOfRoadNode of that nearest significant node, e.g. 'junction'. */
  nearestJunctionForm: string | null
  /** Distance (m) to the nearest roundabout node specifically, if any within radius. */
  nearestRoundaboutM: number | null
}

export interface FrontageScreening {
  band: FrontageBand
  /** The measured metres, or null when unknown. */
  frontageM: number | null
  /** True only when a frontage was actually measured (a road was associated). */
  measured: boolean
}

export interface JunctionScreening {
  band: JunctionBand
  nearestM: number | null
  /** 'junction' | 'roundabout' | null — the kind of the nearest significant node. */
  nearestKind: 'junction' | 'roundabout' | null
  roundaboutM: number | null
}

export interface GeometryScreening {
  frontage: FrontageScreening
  /** Frontage onto the nearest classified (A/B/Motorway) road, when one is associated. */
  primaryFrontage: FrontageScreening
  junction: JunctionScreening
  /** Hedged, human-readable screening notes — never a suitability/access claim. */
  notes: string[]
}

function roundM(m: number): number {
  return Math.round(m)
}

/** Classify a single frontage measurement into a band, preserving unknown≠zero. */
export function classifyFrontage(
  frontageM: number | null,
  hasAssociatedRoad: boolean,
  thresholds: FrontageThresholds = DEFAULT_FRONTAGE_THRESHOLDS,
): FrontageScreening {
  // No road associated at all → genuinely unknown, not zero.
  if (!hasAssociatedRoad || frontageM == null) {
    return { band: 'unknown', frontageM: null, measured: false }
  }
  if (frontageM <= thresholds.zeroEpsilonM) {
    // A road is nearby but the parcel presents ~no edge within the buffer.
    return { band: 'none', frontageM, measured: true }
  }
  const band: FrontageBand =
    frontageM < thresholds.narrowMaxM ? 'narrow' : frontageM < thresholds.moderateMaxM ? 'moderate' : 'wide'
  return { band, frontageM, measured: true }
}

/** Classify nearest-junction / nearest-roundabout distances into a proximity band. */
export function classifyJunction(
  nearestJunctionM: number | null,
  nearestRoundaboutM: number | null,
  nearestJunctionForm: string | null = null,
  thresholds: JunctionThresholds = DEFAULT_JUNCTION_THRESHOLDS,
): JunctionScreening {
  if (nearestJunctionM == null) {
    return { band: 'unknown', nearestM: null, nearestKind: null, roundaboutM: nearestRoundaboutM }
  }
  const band: JunctionBand =
    nearestJunctionM <= thresholds.atMaxM
      ? 'at'
      : nearestJunctionM < thresholds.nearMaxM
        ? 'near'
        : nearestJunctionM < thresholds.moderateMaxM
          ? 'moderate'
          : 'far'
  // Prefer the explicit form; else infer roundabout when the nearest significant node
  // coincides with the nearest roundabout distance.
  const kind: 'junction' | 'roundabout' | null =
    nearestJunctionForm === 'roundabout' ||
    (nearestRoundaboutM != null && nearestRoundaboutM === nearestJunctionM)
      ? 'roundabout'
      : 'junction'
  return { band, nearestM: nearestJunctionM, nearestKind: kind, roundaboutM: nearestRoundaboutM }
}

/** Reduce a site's raw derived geometry to a hedged screening summary. */
export function screenSiteGeometry(
  raw: SiteGeometryRaw,
  opts: { frontage?: FrontageThresholds; junction?: JunctionThresholds } = {},
): GeometryScreening {
  const frontage = classifyFrontage(raw.frontageM, raw.hasAssociatedRoad, opts.frontage)
  const primaryFrontage = classifyFrontage(raw.primaryFrontageM, raw.hasAssociatedRoad, opts.frontage)
  const junction = classifyJunction(
    raw.nearestJunctionM,
    raw.nearestRoundaboutM,
    raw.nearestJunctionForm,
    opts.junction,
  )

  const notes: string[] = []
  switch (frontage.band) {
    case 'unknown':
      notes.push('Frontage unknown — no mapped road was associated with this parcel.')
      break
    case 'none':
      notes.push('Approx. no road-facing edge within the frontage buffer (parcel appears set back).')
      break
    default:
      notes.push(
        `Approx. ${roundM(frontage.frontageM as number)} m of road-facing boundary (${frontage.band}) — a screening estimate, not a surveyed frontage.`,
      )
  }
  if (primaryFrontage.measured && (primaryFrontage.frontageM as number) > (frontage.frontageM ?? 0)) {
    notes.push(`Approx. ${roundM(primaryFrontage.frontageM as number)} m facing a classified (A/B/Motorway) road.`)
  }
  switch (junction.band) {
    case 'unknown':
      notes.push('No significant junction/roundabout mapped nearby.')
      break
    default:
      notes.push(
        `Nearest ${junction.nearestKind ?? 'junction'} ~${roundM(junction.nearestM as number)} m away (${junction.band}).`,
      )
  }
  notes.push('Derived from open centreline data — a screening signal for review, not a highways/access assessment.')

  return { frontage, primaryFrontage, junction, notes }
}

/** Map a raw geometry row to the engine's SiteFeaturesRaw geometry fields. The engine
 *  reasons about frontage onto the nearest-overall road by default; a search that
 *  restricts to classified roads can prefer `primaryFrontageM` instead. `null` frontage
 *  (no associated road) flows through as unknown, never zero. */
export function toSiteGeometryFeatures(raw: SiteGeometryRaw): {
  frontageM: number | null
  nearestJunctionDistanceM: number | null
  junctionType: string | null
} {
  return {
    frontageM: raw.hasAssociatedRoad ? raw.frontageM : null,
    nearestJunctionDistanceM: raw.nearestJunctionM,
    junctionType: raw.nearestJunctionForm,
  }
}
