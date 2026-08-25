import { fuseSiteLandUse } from '../land-use-fusion'
import type { EvidenceRelation, LandUseEvidence } from '../land-use-fusion'
import type { LandUseConfidence } from '../types'

function ev(
  landUseClass: string,
  confidence: LandUseConfidence,
  relation: EvidenceRelation,
  overlapFraction: number | null = null,
  source = 'osm',
): LandUseEvidence {
  return { landUseClass, confidence, relation, overlapFraction, source, name: null, sourceReference: null }
}

describe('fuseSiteLandUse — unknown stays unknown', () => {
  it('no evidence → null class + null confidence', () => {
    const r = fuseSiteLandUse([])
    expect(r.landUse).toBeNull()
    expect(r.confidence).toBeNull()
    expect(r.evidence).toEqual([])
  })

  it('only weak/far evidence below the floor stays unknown but retains the evidence', () => {
    // a single low-confidence nearby point: 0.3 * 0.15 = 0.045 < 0.12 floor
    const r = fuseSiteLandUse([ev('retail', 'low', 'nearby')])
    expect(r.landUse).toBeNull()
    expect(r.confidence).toBeNull()
    expect(r.evidence).toHaveLength(1)
  })
})

describe('fuseSiteLandUse — confident single-source classification', () => {
  it('a high-confidence landuse polygon covering the site → that class, high confidence', () => {
    const r = fuseSiteLandUse([ev('residential', 'high', 'covers', 0.9)])
    expect(r.landUse).toBe('residential')
    expect(r.confidence).toBe('high')
  })

  it('a store point inside the site → retail, medium (point-only, medium source)', () => {
    const r = fuseSiteLandUse([ev('retail', 'medium', 'point_inside', null, 'sitematcher_stores')])
    expect(r.landUse).toBe('retail')
    expect(r.confidence).toBe('medium')
  })

  it('a high-confidence point of use inside the site → high confidence', () => {
    const r = fuseSiteLandUse([ev('fuel', 'high', 'point_inside')])
    expect(r.landUse).toBe('fuel')
    expect(r.confidence).toBe('high')
  })

  it('a small sliver overlap of a high-confidence polygon is weighted down', () => {
    // 1.0 * 0.05 = 0.05 < floor → not enough on its own
    const r = fuseSiteLandUse([ev('industrial', 'high', 'overlaps', 0.05)])
    expect(r.landUse).toBeNull()
  })
})

describe('fuseSiteLandUse — multiple agreeing sources reinforce', () => {
  it('OSM retail landuse + a store point → retail, high', () => {
    const r = fuseSiteLandUse([
      ev('retail', 'high', 'covers', 0.7),
      ev('retail', 'medium', 'point_inside', null, 'sitematcher_stores'),
    ])
    expect(r.landUse).toBe('retail')
    expect(r.confidence).toBe('high')
    expect(r.evidence[0].weight).toBeGreaterThan(r.evidence[1].weight)
  })
})

describe('fuseSiteLandUse — conflicting strong evidence → mixed', () => {
  it('two comparably-weighted different classes → mixed, capped at medium', () => {
    const r = fuseSiteLandUse([
      ev('residential', 'high', 'covers', 0.5),
      ev('commercial', 'high', 'covers', 0.45),
    ])
    expect(r.landUse).toBe('mixed')
    expect(r.confidence).toBe('medium')
  })

  it('a clearly dominant class is NOT diluted to mixed by a minor second use', () => {
    const r = fuseSiteLandUse([
      ev('residential', 'high', 'covers', 0.85),
      ev('retail', 'high', 'overlaps', 0.1),
    ])
    expect(r.landUse).toBe('residential')
  })
})

describe('fuseSiteLandUse — evidence retention + ordering', () => {
  it('retains evidence sorted by weight, strongest first, capped at 12', () => {
    const many: LandUseEvidence[] = Array.from({ length: 20 }, (_, i) =>
      ev('natural', 'low', 'nearby', null, `src-${i}`),
    )
    many.unshift(ev('agricultural', 'high', 'covers', 0.95))
    const r = fuseSiteLandUse(many)
    expect(r.evidence).toHaveLength(12)
    expect(r.evidence[0].landUseClass).toBe('agricultural')
  })
})
