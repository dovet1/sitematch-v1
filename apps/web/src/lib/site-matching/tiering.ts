// Transparent result tiering — the M9.1 replacement for a single surfaced "suitability %".
//
// M9 exposed score saturation: with lenient `preferred` thresholds and `unknown` excluded
// from the %, most eligible sites trivially reached 100%, so the score no longer
// discriminated. This layer replaces the surfaced number with **four transparent tiers**
// and a **passed / partial / failed / unknown** evidence summary, computed from an auditable,
// documented rubric (no ML, no opaque weighting). The numeric `signal` is kept only as an
// internal ordering key — it is deliberately NOT presented as a definitive suitability score.
//
// Rules (all visible here):
// - Ineligible (a required criterion failed) → `unlikely`, still returned, ranked last.
// - Each assessable criterion contributes its IMPORTANCE weight: a firm pass = full, a
//   *partial* match (soft-evidence pass, or an oversized title, or a constraint review-flag)
//   = half, a fail = zero. `unknown` criteria are EXCLUDED from the denominator (missing data
//   neither rewards nor penalises), but they lower `completeness`.
// - `signal` = credit / assessable-importance; `completeness` = assessable / all criteria.
// - Tier: strong needs a high signal AND enough of the brief assessable; an oversized title or
//   a constraint review-flag can never be `strong` (capped at `potential`).

import type { CriterionKey, CriterionResult, SiteMatchResult } from './types'

export type SiteTier = 'strong' | 'potential' | 'review' | 'unlikely'

export const TIER_LABELS: Record<SiteTier, string> = {
  strong: 'Strong parcel signal',
  potential: 'Potential',
  review: 'Worth reviewing',
  unlikely: 'Unlikely',
}

const TIER_RANK: Record<SiteTier, number> = { strong: 3, potential: 2, review: 1, unlikely: 0 }

/** Importance weights per criterion — the hard locational signals (road presence, apparent
 *  land use, plot size in range) outweigh the softer/approximate ones (frontage, junction,
 *  Estimated traffic). Documented + auditable; tweak here, nowhere else. */
export const CRITERION_IMPORTANCE: Partial<Record<CriterionKey, number>> = {
  road_proximity: 3,
  land_use: 3,
  site_area: 3,
  traffic_aadf: 2,
  road_frontage: 2,
  junction_distance: 1,
  same_brand_distance: 1,
  planning_constraints: 1,
  access: 0,
}

function importance(key: CriterionKey): number {
  return CRITERION_IMPORTANCE[key] ?? 1
}

export interface TierThresholds {
  /** signal ≥ this AND completeness ≥ minCompleteness ⇒ strong. */
  strongSignal: number
  minCompleteness: number
  /** signal ≥ this ⇒ potential (else review). */
  potentialSignal: number
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  strongSignal: 0.8,
  minCompleteness: 0.6,
  potentialSignal: 0.55,
}

export type EvidenceBucket = 'passed' | 'partial' | 'failed' | 'unknown'

export interface EvidenceSummary {
  passed: CriterionResult[]
  partial: CriterionResult[]
  failed: CriterionResult[]
  unknown: CriterionResult[]
}

export interface TieredResult extends SiteMatchResult {
  tier: SiteTier
  tierLabel: string
  evidence: EvidenceSummary
  /** Internal ordering key in [0,1]; NOT a surfaced suitability percentage. */
  signal: number
  /** Fraction of the brief that could be assessed (non-unknown criteria). */
  completeness: number
  /** True when the registered title is larger than the requested maximum footprint. */
  oversized: boolean
}

/** Which evidence bucket a single criterion result falls into. A `warning` is either an
 *  oversized-title flag or a constraint review-flag — both are "matched with caveats" =
 *  partial. A soft-evidence pass is also partial; a firm pass is passed. */
export function evidenceBucket(r: CriterionResult): EvidenceBucket {
  if (r.status === 'unknown') return 'unknown'
  if (r.status === 'fail') return 'failed'
  if (r.status === 'warning') return 'partial'
  return r.evidenceStrength === 'approximate' ? 'partial' : 'passed'
}

/** Reduce one scored site to a tier + evidence summary. Pure. */
export function tierResult(
  result: SiteMatchResult,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): TieredResult {
  const evidence: EvidenceSummary = { passed: [], partial: [], failed: [], unknown: [] }
  let credit = 0
  let assessableImportance = 0
  let oversized = false
  let hasReviewFlag = false

  for (const r of result.criteria) {
    const bucket = evidenceBucket(r)
    evidence[bucket].push(r)
    if (r.oversized) oversized = true
    if (r.status === 'warning' && !r.oversized) hasReviewFlag = true // e.g. a flood-zone flag
    if (bucket === 'unknown') continue // excluded from the signal denominator (missing data)
    const imp = importance(r.criterion)
    assessableImportance += imp
    if (bucket === 'passed') credit += imp
    else if (bucket === 'partial') credit += 0.5 * imp
    // failed → +0
  }

  const signal = assessableImportance > 0 ? credit / assessableImportance : 0
  const assessable = result.criteria.filter((r) => r.status !== 'unknown').length
  const completeness = result.criteria.length > 0 ? assessable / result.criteria.length : 0

  let tier: SiteTier
  if (!result.eligible) {
    tier = 'unlikely'
  } else if (signal >= thresholds.strongSignal && completeness >= thresholds.minCompleteness) {
    tier = 'strong'
  } else if (signal >= thresholds.potentialSignal) {
    tier = 'potential'
  } else {
    tier = 'review'
  }
  // Honesty caps: an oversized title or an unresolved constraint flag is never "strong".
  if (tier === 'strong' && (oversized || hasReviewFlag)) tier = 'potential'

  return {
    ...result,
    tier,
    tierLabel: TIER_LABELS[tier],
    evidence,
    signal: Math.round(signal * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    oversized,
  }
}

/** Rank tiered results: by tier, then signal, then completeness, then evidence breadth.
 *  Deliberately does NOT sort on the raw `score` (whose saturation this layer replaces). */
export function rankTiered(
  results: SiteMatchResult[],
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): TieredResult[] {
  return results
    .map((r) => tierResult(r, thresholds))
    .sort((a, b) => {
      if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[b.tier] - TIER_RANK[a.tier]
      if (b.signal !== a.signal) return b.signal - a.signal
      if (b.completeness !== a.completeness) return b.completeness - a.completeness
      return b.measurable - a.measurable
    })
}

/** Tier distribution over a result set — for the funnel/report and the M9.1 saturation check. */
export function tierDistribution(results: TieredResult[]): Record<SiteTier, number> {
  const dist: Record<SiteTier, number> = { strong: 0, potential: 0, review: 0, unlikely: 0 }
  for (const r of results) dist[r.tier]++
  return dist
}
