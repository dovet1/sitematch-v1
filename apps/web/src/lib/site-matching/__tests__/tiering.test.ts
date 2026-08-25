import { evidenceBucket, rankTiered, tierResult, TIER_LABELS } from '../tiering'
import type { CriterionKey, CriterionResult, SiteMatchResult } from '../types'

function crit(
  criterion: CriterionKey,
  status: CriterionResult['status'],
  extra: Partial<CriterionResult> = {}
): CriterionResult {
  return {
    criterion,
    label: criterion,
    status,
    mode: 'preferred',
    weight: 1,
    value: null,
    requirement: null,
    ...extra,
  }
}

function siteResult(criteria: CriterionResult[], eligible = true): SiteMatchResult {
  const scoreable = criteria.filter((c) => c.status === 'pass' || c.status === 'fail')
  return {
    siteId: 's',
    name: null,
    score: 0,
    label: 'weak',
    eligible,
    criteria,
    warnings: [],
    matched: scoreable.filter((c) => c.status === 'pass').length,
    measurable: scoreable.length,
  }
}

describe('evidenceBucket', () => {
  it('firm pass → passed; approximate pass → partial', () => {
    expect(evidenceBucket(crit('road_proximity', 'pass'))).toBe('passed')
    expect(evidenceBucket(crit('traffic_aadf', 'pass', { evidenceStrength: 'approximate' }))).toBe('partial')
  })
  it('warning (oversized or constraint flag) → partial; fail → failed; unknown → unknown', () => {
    expect(evidenceBucket(crit('site_area', 'warning', { oversized: true }))).toBe('partial')
    expect(evidenceBucket(crit('planning_constraints', 'warning'))).toBe('partial')
    expect(evidenceBucket(crit('land_use', 'fail'))).toBe('failed')
    expect(evidenceBucket(crit('access', 'unknown'))).toBe('unknown')
  })
})

describe('tierResult — tiers spread instead of saturating', () => {
  it('ineligible → unlikely, still returned', () => {
    const r = tierResult(siteResult([crit('site_area', 'fail', { mode: 'required' })], false))
    expect(r.tier).toBe('unlikely')
    expect(r.tierLabel).toBe(TIER_LABELS.unlikely)
  })

  it('firm passes on the important criteria with good completeness → strong', () => {
    const r = tierResult(
      siteResult([
        crit('site_area', 'pass'),
        crit('road_proximity', 'pass'),
        crit('land_use', 'pass'),
        crit('same_brand_distance', 'pass'),
        crit('access', 'unknown'),
      ])
    )
    expect(r.tier).toBe('strong')
    expect(r.evidence.passed.map((c) => c.criterion)).toEqual(
      expect.arrayContaining(['site_area', 'road_proximity', 'land_use'])
    )
    expect(r.evidence.unknown.map((c) => c.criterion)).toEqual(['access'])
  })

  it('an oversized title can never be strong — capped at potential (or lower)', () => {
    const r = tierResult(
      siteResult([
        crit('site_area', 'warning', { oversized: true }),
        crit('road_proximity', 'pass'),
        crit('land_use', 'pass'),
        crit('same_brand_distance', 'pass'),
      ])
    )
    expect(r.oversized).toBe(true)
    expect(r.tier).not.toBe('strong')
    expect(['potential', 'review']).toContain(r.tier)
    expect(r.evidence.partial.some((c) => c.criterion === 'site_area')).toBe(true)
  })

  it('a constraint review-flag can never be strong', () => {
    const r = tierResult(
      siteResult([
        crit('site_area', 'pass'),
        crit('road_proximity', 'pass'),
        crit('land_use', 'pass'),
        crit('planning_constraints', 'warning'), // e.g. Flood Zone 2
      ])
    )
    expect(r.tier).not.toBe('strong')
  })

  it('mostly failed/partial preferred criteria → review; soft passes count half', () => {
    const r = tierResult(
      siteResult([
        crit('site_area', 'pass'),
        crit('road_proximity', 'fail'),
        crit('traffic_aadf', 'pass', { evidenceStrength: 'approximate' }),
        crit('land_use', 'fail'),
      ])
    )
    // credit = area(3) + traffic(0.5*2) = 4 ; den = 3+3+2+3 = 11 → signal ≈ 0.36 → review
    expect(r.tier).toBe('review')
    expect(r.signal).toBeCloseTo(0.36, 2)
  })

  it('unknown criteria are excluded from signal but lower completeness', () => {
    const allKnown = tierResult(
      siteResult([crit('site_area', 'pass'), crit('road_proximity', 'pass'), crit('land_use', 'pass')])
    )
    const halfUnknown = tierResult(
      siteResult([
        crit('site_area', 'pass'),
        crit('road_proximity', 'pass'),
        crit('land_use', 'pass'),
        crit('traffic_aadf', 'unknown'),
        crit('road_frontage', 'unknown'),
        crit('junction_distance', 'unknown'),
      ])
    )
    expect(allKnown.signal).toBe(1)
    expect(halfUnknown.signal).toBe(1) // unknowns don't dent the signal
    expect(halfUnknown.completeness).toBeLessThan(allKnown.completeness)
  })
})

describe('rankTiered', () => {
  it('orders by tier, then signal, then completeness', () => {
    const strong = { ...siteResult([crit('site_area', 'pass'), crit('road_proximity', 'pass'), crit('land_use', 'pass')]), siteId: 'strong' }
    const potential = { ...siteResult([crit('site_area', 'warning', { oversized: true }), crit('road_proximity', 'pass'), crit('land_use', 'pass')]), siteId: 'potential' }
    const unlikely = { ...siteResult([crit('site_area', 'fail', { mode: 'required' })], false), siteId: 'unlikely' }
    const ranked = rankTiered([unlikely, potential, strong])
    expect(ranked.map((r) => r.siteId)).toEqual(['strong', 'potential', 'unlikely'])
  })
})
