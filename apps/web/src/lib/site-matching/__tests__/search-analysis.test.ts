import { knownSiteRecall, shortlistQuality, type KnownSite } from '../search-analysis'
import type { SiteMatchResult } from '../types'

function result(overrides: Partial<SiteMatchResult> = {}): SiteMatchResult {
  return {
    siteId: 'r',
    name: null,
    score: 50,
    label: 'potential',
    eligible: true,
    criteria: [],
    warnings: [],
    matched: 1,
    measurable: 2,
    ...overrides,
  }
}

// A ranked set already ordered (eligible first, then score) as rankSites would produce.
const ranked: SiteMatchResult[] = [
  result({ siteId: 'a', score: 90, label: 'strong', eligible: true }),
  result({ siteId: 'b', score: 70, label: 'potential', eligible: true }),
  result({ siteId: 'c', score: 60, label: 'potential', eligible: true }),
  result({ siteId: 'd', score: 40, label: 'weak', eligible: false }),
]

describe('knownSiteRecall', () => {
  it('resolves rank, eligibility and top-N membership for mapped parcels', () => {
    const known: KnownSite[] = [
      { label: 'Existing DT #1', siteId: 'b', contained: true, distanceM: 0 },
      { label: 'Existing DT #2', siteId: 'd', contained: false, distanceM: 8 },
    ]
    const r = knownSiteRecall(ranked, known, 2)
    expect(r.known).toBe(2)
    expect(r.mappedToParcel).toBe(2)
    expect(r.inUniverse).toBe(2)
    expect(r.eligible).toBe(1) // only 'b' is eligible
    expect(r.inTopN).toBe(1) // 'b' at rank 2 ≤ 2; 'd' at rank 4
    const b = r.outcomes.find((o) => o.siteId === 'b')!
    expect(b.rank).toBe(2)
    expect(b.inTopN).toBe(true)
    const d = r.outcomes.find((o) => o.siteId === 'd')!
    expect(d.rank).toBe(4)
    expect(d.eligible).toBe(false)
    expect(d.inTopN).toBe(false)
    expect(r.medianRank).toBe(3) // (2 + 4) / 2
  })

  it('a known site that maps to NO parcel is a universe miss, not a ranking miss', () => {
    const known: KnownSite[] = [{ label: 'Rural DT', siteId: null, contained: false, distanceM: null }]
    const r = knownSiteRecall(ranked, known, 2)
    expect(r.mappedToParcel).toBe(0)
    expect(r.inUniverse).toBe(0)
    expect(r.outcomes[0].rank).toBeNull()
    expect(r.medianRank).toBeNull()
  })

  it('a parcel mapped but absent from the ranked universe is not counted in-universe', () => {
    const known: KnownSite[] = [{ label: 'Filtered-out', siteId: 'zzz', contained: true, distanceM: 0 }]
    const r = knownSiteRecall(ranked, known, 2)
    expect(r.mappedToParcel).toBe(1)
    expect(r.inUniverse).toBe(0)
    expect(r.outcomes[0].inUniverse).toBe(false)
  })
})

describe('shortlistQuality', () => {
  it('summarises label mix, eligibility and the shortlist score span', () => {
    const q = shortlistQuality(ranked, 2)
    expect(q.universe).toBe(4)
    expect(q.eligible).toBe(3)
    expect(q.ineligible).toBe(1)
    expect(q.labels).toEqual({ strong: 1, potential: 2, weak: 1 })
    expect(q.topN).toBe(2)
    expect(q.topNLabels).toEqual({ strong: 1, potential: 1, weak: 0 })
    expect(q.topScore).toBe(90)
    expect(q.cutScore).toBe(70) // 2nd eligible
  })

  it('handles an all-ineligible set (empty shortlist)', () => {
    const q = shortlistQuality([result({ siteId: 'x', eligible: false, label: 'weak', score: 10 })], 5)
    expect(q.eligible).toBe(0)
    expect(q.topScore).toBeNull()
    expect(q.cutScore).toBeNull()
  })
})
