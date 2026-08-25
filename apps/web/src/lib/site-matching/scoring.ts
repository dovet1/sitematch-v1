// Transparent, inspectable scoring for the matching engine.
//
// The score is a "% criteria match" — how closely the KNOWN attributes of a
// candidate match the specified acquisition criteria. It is deliberately NOT a
// claim about development suitability, planning likelihood, highways feasibility,
// or acquisition probability.
//
// Rules (kept simple and auditable — no ML, no opaque weighting):
// - A `required` criterion that FAILS makes the site ineligible (dropped from the
//   ranked shortlist, but still returned for inspection and ranked last).
// - `pass`/`fail` criteria (required or preferred) contribute to the weighted %:
//     score = 100 * Σ(weight · pass) / Σ(weight) over pass|fail criteria.
// - `unknown` criteria are EXCLUDED from the % (neutral) — missing data neither
//   rewards nor penalises. They are reported so the uncertainty is visible.
// - `warning` criteria are surfaced but score-neutral by default.

import { evaluateCriterion } from './criteria'
import type {
  CriterionResult,
  MatchLabel,
  OccupierRequirement,
  SiteFeaturesRaw,
  SiteMatchResult,
} from './types'

export interface ScoringConfig {
  /** score ≥ this ⇒ 'strong'. */
  strongThreshold: number
  /** score ≥ this ⇒ 'potential'; below ⇒ 'weak'. */
  potentialThreshold: number
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  strongThreshold: 80,
  potentialThreshold: 55,
}

export function labelForScore(
  score: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): MatchLabel {
  if (score >= config.strongThreshold) return 'strong'
  if (score >= config.potentialThreshold) return 'potential'
  return 'weak'
}

function isScoreable(r: CriterionResult): boolean {
  return r.status === 'pass' || r.status === 'fail'
}

export function scoreSite(
  requirement: OccupierRequirement,
  features: SiteFeaturesRaw,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): SiteMatchResult {
  const criteria = requirement.criteria.map((c) => evaluateCriterion(c, features))

  const eligible = !criteria.some((r) => r.mode === 'required' && r.status === 'fail')

  const scoreable = criteria.filter(isScoreable)
  const weightSum = scoreable.reduce((s, r) => s + r.weight, 0)
  const passWeight = scoreable
    .filter((r) => r.status === 'pass')
    .reduce((s, r) => s + r.weight, 0)
  const score = weightSum > 0 ? Math.round((100 * passWeight) / weightSum) : 0

  const warnings = criteria
    .filter((r) => r.status === 'warning')
    .map((r) => r.message ?? `${r.label}: review`)

  return {
    siteId: features.siteId,
    name: features.name,
    score,
    label: labelForScore(score, config),
    eligible,
    criteria,
    warnings,
    matched: scoreable.filter((r) => r.status === 'pass').length,
    measurable: scoreable.length,
  }
}

/** Rank sites: eligible first, then by descending score, then by more measurable
 *  criteria (a site whose match rests on more evidence outranks a thinner one). */
export function rankSites(results: SiteMatchResult[]): SiteMatchResult[] {
  return [...results].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    if (b.score !== a.score) return b.score - a.score
    return b.measurable - a.measurable
  })
}

export function scoreAndRank(
  requirement: OccupierRequirement,
  sites: SiteFeaturesRaw[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): SiteMatchResult[] {
  return rankSites(sites.map((f) => scoreSite(requirement, f, config)))
}
