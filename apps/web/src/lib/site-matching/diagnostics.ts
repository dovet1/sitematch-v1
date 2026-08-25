// Diagnostic filtering funnel + data-coverage — the experimental instrumentation.
//
// This is (initially) developer/debug output, but it is almost as valuable as the
// shortlist during MVP validation. Its whole purpose is to let us tell apart:
//   "there aren't many matching sites"   (criteria genuinely restrictive)
// from:
//   "we can't assess many sites"         (poor dataset coverage)
// so every required gate reports pass / fail / UNKNOWN separately, and unknowns
// are RETAINED into the next gate (missing data never eliminates a candidate here).

import { evaluateCriterion } from './criteria'
import type {
  CoverageStat,
  CriterionConfig,
  FunnelGate,
  OccupierRequirement,
  SearchDiagnostics,
  SiteFeaturesRaw,
} from './types'

function labelFor(config: CriterionConfig): string {
  return config.label ?? config.key
}

function coverage(field: string, present: number, total: number): CoverageStat {
  return { field, present, total, pct: total > 0 ? Math.round((100 * present) / total) : 0 }
}

/**
 * Build the funnel by applying each REQUIRED criterion as an ordered gate over the
 * surviving universe. Preferred/warning criteria affect ranking, not the funnel.
 */
export function buildFunnel(
  universe: SiteFeaturesRaw[],
  requirement: OccupierRequirement
): SearchDiagnostics {
  const requiredCriteria = requirement.criteria.filter((c) => c.mode === 'required')

  let surviving = universe
  const funnel: FunnelGate[] = []

  for (const config of requiredCriteria) {
    const entering = surviving.length
    let pass = 0
    let fail = 0
    let unknown = 0
    const next: SiteFeaturesRaw[] = []
    for (const site of surviving) {
      const result = evaluateCriterion(config, site)
      if (result.status === 'fail') {
        fail++
      } else if (result.status === 'unknown') {
        unknown++
        next.push(site) // unknowns are retained — missing data is not elimination
      } else {
        // pass or warning both survive; count non-fail-non-unknown as pass here
        pass++
        next.push(site)
      }
    }
    funnel.push({
      criterion: config.key,
      label: labelFor(config),
      entering,
      pass,
      fail,
      unknown,
      retainedUnknown: true,
      surviving: next.length,
    })
    surviving = next
  }

  const total = universe.length
  const coverageStats: CoverageStat[] = [
    coverage('traffic', universe.filter((s) => hasTraffic(s)).length, total),
    coverage('land_use', universe.filter((s) => s.currentLandUse != null).length, total),
    coverage('frontage', universe.filter((s) => s.frontageM != null).length, total),
    coverage('road', universe.filter((s) => s.roads != null && s.roads.length > 0).length, total),
    coverage('junction', universe.filter((s) => s.nearestJunctionDistanceM != null).length, total),
  ]

  return {
    universe: total,
    funnel,
    coverage: coverageStats,
    survivors: surviving.length,
  }
}

function hasTraffic(site: SiteFeaturesRaw): boolean {
  return !!site.roads && site.roads.some((r) => r.aadf != null)
}
