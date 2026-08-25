// Deterministic criterion evaluators — the matching "registry".
//
// Each evaluator is a PURE function (config, features) => CriterionResult. It
// reads only what it needs from the site's normalised features and the criterion
// params. Adding a new acquisition criterion later = add one evaluator here and a
// key in CriterionKey; the scoring engine and funnel pick it up automatically.
//
// Product rules baked in:
// - `unknown` (missing data) is returned rather than `fail` whenever the datum we
//   need is absent, so poor coverage never silently eliminates a candidate.
// - Language is hedged; nothing here asserts development suitability.

import type {
  ConstraintDetail,
  CriterionConfig,
  CriterionKey,
  CriterionResult,
  RoadFeature,
  SiteFeaturesRaw,
} from './types'

const METRES_PER_MILE = 1609.344

function num(params: Record<string, unknown> | undefined, key: string): number | null {
  const v = params?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function strList(params: Record<string, unknown> | undefined, key: string): string[] {
  const v = params?.[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function fmtAcres(a: number): string {
  return `${a.toFixed(2)} acres`
}

function fmtMetres(m: number): string {
  return `${Math.round(m)}m`
}

function fmtAadf(n: number): string {
  return n.toLocaleString('en-GB')
}

function fmtMiles(m: number): string {
  return `${(m / METRES_PER_MILE).toFixed(1)} miles`
}

/** Nearest road among the requirement's accepted classes. Shared by the road and
 *  traffic evaluators so both reason about the SAME road (e.g. "the A28"). */
export function relevantRoad(
  features: SiteFeaturesRaw,
  acceptedClasses: string[]
): RoadFeature | null {
  if (!features.roads || features.roads.length === 0) return null
  const accepted = acceptedClasses.length > 0
    ? features.roads.filter((r) => acceptedClasses.includes(r.roadClass))
    : features.roads
  if (accepted.length === 0) return null
  return accepted.reduce((best, r) => (r.distanceM < best.distanceM ? r : best))
}

type Evaluator = (config: CriterionConfig, features: SiteFeaturesRaw) => CriterionResult

const base = (
  config: CriterionConfig,
  fallbackLabel: string
): Pick<CriterionResult, 'criterion' | 'label' | 'mode' | 'weight'> => ({
  criterion: config.key,
  label: config.label ?? fallbackLabel,
  mode: config.mode,
  weight: typeof config.weight === 'number' ? config.weight : 1,
})

const evaluators: Record<CriterionKey, Evaluator> = {
  site_area(config, f) {
    const min = num(config.params, 'minAcres')
    const max = num(config.params, 'maxAcres')
    const requirement =
      min != null && max != null
        ? `${min}–${max} acres`
        : min != null
          ? `≥ ${min} acres`
          : max != null
            ? `≤ ${max} acres`
            : 'any area'
    const b = base(config, 'Site area')
    if (f.areaAcres == null) {
      return { ...b, status: 'unknown', value: null, requirement, message: 'Area unknown' }
    }
    const value = fmtAcres(f.areaAcres)
    // Below the minimum → a genuine fail: a title too small cannot contain the requirement
    // without assembly (which we deliberately do not do).
    if (min != null && f.areaAcres < min) {
      return {
        ...b,
        status: 'fail',
        value,
        requirement,
        message: 'Below the minimum footprint — too small to contain the requirement without assembly.',
      }
    }
    // Above the maximum → NOT an automatic fail. A registered title is an enclosing freehold
    // extent, so an oversized title may still contain a suitable area. Retain it, flag it as
    // oversized (so ranking penalises it and the UI labels it), and preserve the real area.
    // `failOversized: true` restores the old hard-fail behaviour for a strict caller.
    if (max != null && f.areaAcres > max) {
      if (config.params?.failOversized === true) {
        return { ...b, status: 'fail', value, requirement, message: 'Larger than the maximum footprint.' }
      }
      return {
        ...b,
        status: 'warning',
        value,
        requirement,
        oversized: true,
        message: `Registered title ${value} — larger than requested footprint; may contain a suitable area. Exact plot and availability unknown.`,
      }
    }
    return { ...b, status: 'pass', value, requirement }
  },

  road_proximity(config, f) {
    const classes = strList(config.params, 'roadClasses')
    const maxDistanceM = num(config.params, 'maxDistanceM')
    const requirement = `${classes.length ? classes.join(' / ') : 'any road'}${
      maxDistanceM != null ? ` within ${Math.round(maxDistanceM)}m` : ''
    }`
    const b = base(config, 'Road proximity')
    if (f.roads == null) {
      return { ...b, status: 'unknown', value: null, requirement, message: 'No road data' }
    }
    const road = relevantRoad(f, classes)
    if (!road) {
      // Enrichment ran but no accepted-class road nearby → genuine fail.
      return { ...b, status: 'fail', value: 'No qualifying road nearby', requirement }
    }
    const label = road.roadNumber ? `${road.roadNumber} (${road.roadClass})` : road.roadClass
    const value = `${label} – ${fmtMetres(road.distanceM)}`
    const ok = maxDistanceM == null || road.distanceM <= maxDistanceM
    return { ...b, status: ok ? 'pass' : 'fail', value, requirement }
  },

  traffic_aadf(config, f) {
    const minAadf = num(config.params, 'minAadf')
    const classes = strList(config.params, 'roadClasses')
    const requirement = minAadf != null ? `≥ ${fmtAadf(minAadf)} AADF` : 'any traffic'
    const b = base(config, 'Passing traffic')
    const road = f.roads == null ? null : relevantRoad(f, classes)
    if (!road || road.aadf == null) {
      return {
        ...b,
        status: 'unknown',
        value: null,
        requirement,
        message: 'Traffic estimate unavailable for the relevant road',
      }
    }
    const method = road.estimationMethod ? ` (${road.estimationMethod})` : ''
    const yr = road.aadfYear ? `, ${road.aadfYear}` : ''
    const value = `~${fmtAadf(road.aadf)} vehicles/day${method}${yr}`
    const ok = minAadf == null || road.aadf >= minAadf
    // A DfT *Estimated* (modelled) AADF is a softer match than a *Counted* one.
    const evidenceStrength = road.estimationMethod === 'Estimated' ? 'approximate' : 'firm'
    return { ...b, status: ok ? 'pass' : 'fail', value, requirement, evidenceStrength }
  },

  road_frontage(config, f) {
    const minM = num(config.params, 'minM')
    const requirement = minM != null ? `≥ ${Math.round(minM)}m frontage` : 'any frontage'
    const b = base(config, 'Road frontage')
    if (f.frontageM == null) {
      return { ...b, status: 'unknown', value: null, requirement, message: 'Frontage not calculated' }
    }
    const value = `~${fmtMetres(f.frontageM)}`
    const ok = minM == null || f.frontageM >= minM
    // Frontage is a derived approximation from open centreline data, never a survey.
    return { ...b, status: ok ? 'pass' : 'fail', value, requirement, evidenceStrength: 'approximate' }
  },

  junction_distance(config, f) {
    const maxM = num(config.params, 'maxM')
    const requirement = maxM != null ? `within ${Math.round(maxM)}m of a junction` : 'any'
    const b = base(config, 'Junction proximity')
    if (f.nearestJunctionDistanceM == null) {
      return { ...b, status: 'unknown', value: null, requirement, message: 'No junction data' }
    }
    const kind = f.junctionType ? ` ${f.junctionType}` : ''
    const value = `${fmtMetres(f.nearestJunctionDistanceM)} to nearest${kind} junction`
    const ok = maxM == null || f.nearestJunctionDistanceM <= maxM
    // Nearest-junction distance is a derived screening approximation.
    return { ...b, status: ok ? 'pass' : 'fail', value, requirement, evidenceStrength: 'approximate' }
  },

  land_use(config, f) {
    const preferred = strList(config.params, 'preferred')
    const excluded = strList(config.params, 'excluded')
    const requirement =
      excluded.length && preferred.length
        ? `prefer ${preferred.join(', ')}; exclude ${excluded.join(', ')}`
        : preferred.length
          ? `prefer ${preferred.join(', ')}`
          : excluded.length
            ? `exclude ${excluded.join(', ')}`
            : 'any use'
    const b = base(config, 'Existing use')
    if (f.currentLandUse == null) {
      return { ...b, status: 'unknown', value: 'Unknown', requirement, message: 'Existing use unknown' }
    }
    const value = f.currentLandUse
    if (excluded.includes(f.currentLandUse)) {
      // Only HIGH-confidence exclusions eliminate; weaker signals only warn.
      const hardExclude = f.landUseConfidence == null || f.landUseConfidence === 'high'
      return {
        ...b,
        status: hardExclude ? 'fail' : 'warning',
        value,
        requirement,
        message: hardExclude
          ? 'Excluded existing use'
          : 'Possibly excluded use (low-confidence classification) — review',
      }
    }
    // A non-high-confidence classification is a softer match than a high-confidence one.
    const evidenceStrength = f.landUseConfidence === 'high' ? 'firm' : 'approximate'
    if (preferred.includes(f.currentLandUse)) {
      return { ...b, status: 'pass', value, requirement, message: 'Preferred existing use', evidenceStrength }
    }
    return { ...b, status: 'pass', value, requirement, message: 'Acceptable existing use', evidenceStrength }
  },

  planning_constraints(config, f) {
    const exclusions = strList(config.params, 'exclusions')
    const warnings = strList(config.params, 'warnings')
    const preferences = strList(config.params, 'preferences')
    const b = base(config, 'Planning constraints')
    const requirement = exclusions.length ? `exclude ${exclusions.join(', ')}` : 'reviewed'
    const details: ConstraintDetail[] = f.constraints.map((c) => ({
      constraint: c,
      severity: exclusions.includes(c)
        ? 'exclusion'
        : warnings.includes(c)
          ? 'warning'
          : preferences.includes(c)
            ? 'preference'
            : 'warning', // an unrecognised constraint is surfaced, not ignored
    }))
    const hasExclusion = details.some((d) => d.severity === 'exclusion')
    const hasWarning = details.some((d) => d.severity === 'warning')
    const value = f.constraints.length ? f.constraints.join(', ') : 'None detected'
    if (hasExclusion) {
      return { ...b, status: 'fail', value, requirement, details, message: 'Excluding constraint present' }
    }
    if (hasWarning) {
      return {
        ...b,
        status: 'warning',
        value,
        requirement,
        details,
        message: 'Planning constraints detected — review',
      }
    }
    return { ...b, status: 'pass', value, requirement, details }
  },

  same_brand_distance(config, f) {
    const minMiles = num(config.params, 'minMiles')
    const minM = minMiles != null ? minMiles * METRES_PER_MILE : null
    const requirement = minMiles != null ? `≥ ${minMiles} miles from existing store` : 'any'
    const b = base(config, 'Existing same-brand store')
    if (!f.brandHasStores || f.sameBrandDistanceM == null) {
      // No same-brand estate to cannibalise → satisfied, not unknown.
      return { ...b, status: 'pass', value: 'No existing stores nearby', requirement }
    }
    const value = `${fmtMiles(f.sameBrandDistanceM)} to nearest`
    const ok = minM == null || f.sameBrandDistanceM >= minM
    return { ...b, status: ok ? 'pass' : 'fail', value, requirement }
  },

  access(config, f) {
    // Highways access CANNOT be inferred at this stage — always unknown, never a
    // claim of "access suitable". This is a deliberate product guardrail.
    const b = base(config, 'Highways access')
    return {
      ...b,
      status: 'unknown',
      value: null,
      requirement: 'reviewed by a highways professional',
      message: 'Requires highways review',
    }
  },
}

/** Evaluate one criterion. Unknown keys yield an `unknown` result rather than
 *  throwing, so a forward-compatible DB config never breaks a search. */
export function evaluateCriterion(
  config: CriterionConfig,
  features: SiteFeaturesRaw
): CriterionResult {
  const evaluator = evaluators[config.key]
  if (!evaluator) {
    return {
      criterion: config.key,
      label: config.label ?? config.key,
      status: 'unknown',
      mode: config.mode,
      weight: typeof config.weight === 'number' ? config.weight : 1,
      value: null,
      requirement: null,
      message: `Unsupported criterion "${config.key}"`,
    }
  }
  return evaluator(config, features)
}

export function isCriterionSupported(key: string): key is CriterionKey {
  return key in evaluators
}
