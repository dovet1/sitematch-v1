// Land-use EVIDENCE FUSION for "Find Sites" M5.
//
// The spatial association step (PostGIS) attaches every land-use SOURCE feature that
// relates to a candidate site — an OSM landuse polygon covering it, a shop point inside
// it, a store nearby, a brownfield polygon overlapping it — each with a source class,
// a source-level confidence, and HOW it relates (covers / overlaps / point_inside /
// nearby). This pure module fuses those pieces of evidence into a single normalised
// class + a fused confidence + the RETAINED evidence list.
//
// Load-bearing product rules (kept in one testable place):
// - `unknown` stays `unknown`. No evidence → `landUse: null`. Fusion NEVER fabricates a
//   class, and confidence is `null` exactly when the class is.
// - Weak evidence never becomes a hard classification: a class is only asserted once its
//   summed weight clears a floor; below it the site stays unknown.
// - Conflicting STRONG evidence yields `mixed` (never silently picks a winner), and
//   `mixed` is capped at `medium` confidence — an honest "we see more than one use here".
// - Fusion CLASSIFIES; it never excludes. Whether a class is acceptable for an occupier
//   is a search-time decision (see criteria.ts `land_use`), not made here.

import type { LandUseConfidence } from './types'

export type EvidenceRelation = 'covers' | 'overlaps' | 'point_inside' | 'nearby'

/** One retained piece of land-use evidence for a site (a candidate_site_land_use row). */
export interface LandUseEvidence {
  landUseClass: string
  confidence: LandUseConfidence
  relation: EvidenceRelation
  /** Fraction of the SITE area covered (0–1) for polygon evidence; null for points. */
  overlapFraction: number | null
  source: string
  sourceReference?: string | null
  name?: string | null
}

export interface FusionResult {
  landUse: string | null
  confidence: LandUseConfidence | null
  /** Retained evidence, strongest first (capped). Always mirrors what drove the class. */
  evidence: RetainedEvidence[]
}

export interface RetainedEvidence {
  landUseClass: string
  confidence: LandUseConfidence
  relation: EvidenceRelation
  overlapFraction: number | null
  source: string
  sourceReference: string | null
  name: string | null
  weight: number
}

/** How firmly the SOURCE tags imply the class (source-level confidence → weight). */
const CONFIDENCE_WEIGHT: Record<LandUseConfidence, number> = { high: 1, medium: 0.6, low: 0.3 }

/** How spatially relevant a relation is to the site (points get fixed weights; polygon
 *  covers/overlaps use their actual fraction of the site so a sliver overlap counts little). */
const POINT_INSIDE_RELEVANCE = 0.8
const NEARBY_RELEVANCE = 0.15

/** A class must accumulate at least this much fused weight to be asserted at all;
 *  below it the site remains `unknown` (weak evidence never forces a classification). */
const MIN_DOMINANT_WEIGHT = 0.12

/** The runner-up class must reach this share of the dominant weight to make it `mixed`. */
const MIXED_RATIO = 0.6

/** Cap on retained evidence entries (strongest first) written back per site. */
const MAX_RETAINED = 12

function relevanceWeight(e: LandUseEvidence): number {
  if (e.relation === 'point_inside') return POINT_INSIDE_RELEVANCE
  if (e.relation === 'nearby') return NEARBY_RELEVANCE
  // covers / overlaps: the fraction of the site the polygon actually covers.
  const f = e.overlapFraction == null ? 0 : Math.max(0, Math.min(1, e.overlapFraction))
  return f
}

function rowWeight(e: LandUseEvidence): number {
  return CONFIDENCE_WEIGHT[e.confidence] * relevanceWeight(e)
}

/** Fused confidence for the chosen class from the rows that support it. */
function classConfidence(rows: LandUseEvidence[]): LandUseConfidence {
  const strong = rows.some(
    (r) =>
      r.confidence === 'high' &&
      (r.relation === 'covers' || r.relation === 'point_inside' || (r.overlapFraction ?? 0) >= 0.5),
  )
  if (strong) return 'high'
  const medium = rows.some(
    (r) =>
      r.confidence === 'high' ||
      (r.confidence === 'medium' &&
        (r.relation === 'covers' || r.relation === 'point_inside' || (r.overlapFraction ?? 0) >= 0.5)),
  )
  if (medium) return 'medium'
  return 'low'
}

/** Fuse all land-use evidence for ONE site into a class + confidence + retained list. */
export function fuseSiteLandUse(evidence: LandUseEvidence[]): FusionResult {
  const retained: RetainedEvidence[] = evidence
    .map((e) => ({
      landUseClass: e.landUseClass,
      confidence: e.confidence,
      relation: e.relation,
      overlapFraction: e.overlapFraction ?? null,
      source: e.source,
      sourceReference: e.sourceReference ?? null,
      name: e.name ?? null,
      weight: rowWeight(e),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_RETAINED)

  if (evidence.length === 0) {
    return { landUse: null, confidence: null, evidence: retained }
  }

  // Sum weights per class.
  const totals = new Map<string, number>()
  for (const e of evidence) {
    totals.set(e.landUseClass, (totals.get(e.landUseClass) ?? 0) + rowWeight(e))
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const [dominantClass, dominantWeight] = ranked[0]

  // Too weak to assert a class → stays unknown, but the (weak) evidence is retained.
  if (dominantWeight < MIN_DOMINANT_WEIGHT) {
    return { landUse: null, confidence: null, evidence: retained }
  }

  const dominantRows = evidence.filter((e) => e.landUseClass === dominantClass)
  const confidence = classConfidence(dominantRows)

  // Conflicting strong evidence → mixed (never silently drop the second use).
  const runnerUp = ranked[1]
  if (runnerUp && runnerUp[1] >= MIXED_RATIO * dominantWeight) {
    return {
      landUse: 'mixed',
      // mixed is inherently less certain: never claim `high`.
      confidence: confidence === 'high' ? 'medium' : confidence,
      evidence: retained,
    }
  }

  return { landUse: dominantClass, confidence, evidence: retained }
}

// Exposed for the fusion unit tests + any future tuning UI.
export const FUSION_CONSTANTS = {
  CONFIDENCE_WEIGHT,
  POINT_INSIDE_RELEVANCE,
  NEARBY_RELEVANCE,
  MIN_DOMINANT_WEIGHT,
  MIXED_RATIO,
  MAX_RETAINED,
}
