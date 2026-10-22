import {
  acquisitiveSignal,
  areaCoversRegion,
  assembleMatches,
  filterBySector,
  NO_SECTOR,
  sectorOptions,
  formatSqftRange,
  isNationalArea,
  matchesToCsv,
  NEWS_HALF_LIFE_DAYS,
  acquisitivePoints,
  newsScore,
  nearestPoints,
  normalisePostcode,
  rankContacts,
  regionKey,
  scoreMatch,
  shortCentreName,
  signalSummaries,
  turnoverCell,
  turnoverLabel,
  signalSummary,
  sizeFit,
  sortMatches,
  sortStoreTowns,
  townBand,
  tradingArea,
  tradingAreaLine,
  type AssembleInput,
} from '../brand-matcher'
import type {
  BrandMatch,
  BrandMatcherContact,
  BrandMatcherSite,
  RequirementEvidence,
  TownMatch,
  TradingFacts,
} from '../../types/brand-matcher'

let seq = 0
const contact = (over: Partial<BrandMatcherContact>): BrandMatcherContact => {
  const id = over.id ?? `c${++seq}`
  return {
    id,
    name: 'Someone',
    title: null,
    area: null,
    email: `${id}@example.com`,
    phone: null,
    isPrimary: false,
    ...over,
  }
}

const site: BrandMatcherSite = {
  postcode: 'LS6 2AT',
  lat: 53.82,
  lon: -1.58,
  centre: { id: 'rc1', name: 'Kirkstall Retail Park', classification: 'Large Retail Park', form: 'retail_park' },
  region: 'Yorkshire and The Humber',
  country: 'England',
}

describe('normalisePostcode', () => {
  it('formats to the ONSPD single-space form', () => {
    expect(normalisePostcode('ls62at')).toBe('LS6 2AT')
    expect(normalisePostcode(' sw1a  1aa ')).toBe('SW1A 1AA')
    expect(normalisePostcode('M1 1AE')).toBe('M1 1AE')
  })
  it('rejects things that cannot be postcodes', () => {
    expect(normalisePostcode('Leeds')).toBeNull()
    expect(normalisePostcode('LS6')).toBeNull()
    expect(normalisePostcode("'; drop table")).toBeNull()
  })
})

describe('shortCentreName', () => {
  it('drops the GeoDS district/region suffix', () => {
    expect(shortCentreName('Riverside Retail Park; Norwich (East of England; England)')).toBe(
      'Riverside Retail Park'
    )
  })
})

describe('sizeFit', () => {
  const estate = { p25: 12000, p75: 16000, min: 9000, max: 20000 }

  it('fits inside a stated requirement and prefers it over the estate', () => {
    expect(sizeFit(14000, [{ min: 8000, max: 20000 }], [estate])).toMatchObject({
      state: 'fits',
      basis: 'requirement',
    })
  })
  it('reads the estate quartiles when there is no requirement', () => {
    expect(sizeFit(14000, [], [estate])?.state).toBe('fits')
    expect(sizeFit(10000, [], [estate])?.state).toBe('lower_end')
    expect(sizeFit(18000, [], [estate])?.state).toBe('upper_end')
  })
  it('allows a tolerance outside the range, flagged as larger/smaller', () => {
    expect(sizeFit(24000, [], [estate])?.state).toBe('larger')
    expect(sizeFit(7000, [], [estate])?.state).toBe('smaller')
    expect(sizeFit(3500, [{ min: null, max: 3000 }], [])?.state).toBe('larger')
  })
  it('excludes a brand beyond tolerance, and widen loosens it', () => {
    expect(sizeFit(28000, [], [estate])).toBeNull()
    expect(sizeFit(28000, [], [estate], true)?.state).toBe('larger')
  })
  it('treats an open-ended requirement as unbounded on that side', () => {
    expect(sizeFit(50000, [{ min: 10000, max: null }], [])?.state).toBe('fits')
  })
  it('ignores requirements with no size at all, falling back to the estate', () => {
    expect(sizeFit(14000, [{ min: null, max: null }], [])).toBeNull()
    expect(sizeFit(14000, [{ min: null, max: null }], [estate])?.basis).toBe('estate')
  })
  it('lets a stated requirement overrule an estate that would fit', () => {
    expect(sizeFit(14000, [{ min: 1500, max: 3000 }], [estate])).toBeNull()
  })
})

describe('regions', () => {
  const yorks = regionKey('Yorkshire and The Humber', 'England')
  const wm = regionKey('West Midlands', 'England')

  it('keys non-English sites on country', () => {
    expect(regionKey('Scotland', 'Scotland')).toBe('Scotland')
    expect(regionKey(null, null)).toBeNull()
  })
  it('matches multi-region free text', () => {
    expect(
      areaCoversRegion('Wales & South West, West & East Midlands, North West & Yorkshire', yorks)
    ).toBe(true)
    expect(areaCoversRegion('North & Yorkshire', yorks)).toBe(true)
    expect(areaCoversRegion('North England, North Wales, Midlands', yorks)).toBe(true)
  })
  it('does not let East Midlands cover a West Midlands site', () => {
    expect(areaCoversRegion('East Midlands', wm)).toBe(false)
    expect(areaCoversRegion('Midlands', wm)).toBe(true)
    expect(areaCoversRegion('West & East Midlands', wm)).toBe(true)
  })
  it('does not match unrelated regions', () => {
    expect(areaCoversRegion('South East & East Anglia', yorks)).toBe(false)
    expect(areaCoversRegion('London/M25 (east)', yorks)).toBe(false)
  })
  it('spots national areas', () => {
    expect(isNationalArea('UK')).toBe(true)
    expect(isNationalArea('National')).toBe(true)
    expect(isNationalArea('Scotland')).toBe(false)
  })
})

describe('rankContacts', () => {
  const key = regionKey('Yorkshire and The Humber', 'England')

  it('promotes the contact whose area covers the site, with the badge', () => {
    const r = rankContacts(
      [
        contact({ id: 'nat', name: 'Daniel Marsh', title: 'National Property Director', isPrimary: true }),
        contact({ id: 'reg', name: 'Rebecca Hale', area: 'North & Yorkshire', phone: '01827 711 812' }),
        contact({ id: 'inbox', name: null, email: 'property@aldi.co.uk' }),
      ],
      key
    )
    expect(r.primary?.id).toBe('reg')
    expect(r.coversRegion).toBe(true)
    expect(r.others.map((c) => c.id)).toEqual(['nat', 'inbox'])
    expect(r.total).toBe(3)
  })
  it('falls back to the national contact and drops the badge', () => {
    const r = rankContacts(
      [
        contact({ id: 'south', area: 'South East' }),
        contact({ id: 'nat', title: 'Head of Property' }),
      ],
      key
    )
    expect(r.primary?.id).toBe('nat')
    expect(r.coversRegion).toBe(false)
  })
  it('dedupes by email and drops unreachable contacts', () => {
    const r = rankContacts(
      [
        contact({ id: 'a', email: 'A@x.com' }),
        contact({ id: 'b', email: 'a@x.com' }),
        contact({ id: 'c', email: null, phone: null }),
      ],
      key
    )
    expect(r.total).toBe(1)
  })
  it('returns an empty panel when nothing is verified', () => {
    expect(rankContacts([], key)).toEqual({ primary: null, coversRegion: false, others: [], total: 0 })
  })
})

describe('acquisitiveSignal', () => {
  const req = (over: Partial<RequirementEvidence>): RequirementEvidence => ({
    count: 1,
    sizeMin: null,
    sizeMax: null,
    useClasses: [],
    nationwide: false,
    nearbyPlaces: [],
    otherPlaces: [],
    otherPlaceCount: 0,
    ...over,
  })
  it('is high when a requirement covers the site', () => {
    expect(acquisitiveSignal(req({ nationwide: true }), null, 0)?.level).toBe('high')
    expect(acquisitiveSignal(req({ nearbyPlaces: ['Leeds'] }), null, 0)?.level).toBe('high')
  })
  it('is medium on evidence elsewhere only', () => {
    expect(acquisitiveSignal(req({ otherPlaces: ['London'] }), null, 0)?.level).toBe('medium')
    expect(acquisitiveSignal(null, null, 2)?.level).toBe('medium')
  })
  it('is absent (no pill) when there is no evidence at all', () => {
    expect(acquisitiveSignal(null, null, 0)).toBeNull()
  })
})

const baseMatch = (over: Partial<BrandMatch>): BrandMatch => ({
  brandId: 'b',
  name: 'Brand',
  logoUrl: null,
  domain: null,
  category: null,
  storeCount: 10,
  size: { state: 'fits', basis: 'estate', rangeMin: 12000, rangeMax: 16000 },
  useClass: null,
  acquisitive: null,
  tradingFacts: null,
  locationType: null,
  nearest: null,
  typicalRange: null,
  contacts: { primary: null, coversRegion: false, others: [], total: 0 },
  score: 0,
  scoreParts: [],
  ...over,
})

const chFacts: TradingFacts = {
  companyNumber: '00000001',
  companyName: 'BRAND LIMITED',
  status: 'Active',
  accountsType: null,
  accountsMadeUpTo: null,
  accountsOverdue: false,
  registeredOffice: null,
  turnover: { status: 'unread' },
  netAssets: { status: 'unread' },
  fetchedAt: '2026-09-18T00:00:00.000Z',
}

describe('scoreMatch', () => {
  it('scales the points earned to 100 across the signals we hold', () => {
    const m = baseMatch({
      useClass: { codes: ['E'], matches: true },
      acquisitive: acquisitiveSignal(
        { count: 1, sizeMin: null, sizeMax: null, useClasses: ['E'], nationwide: true, nearbyPlaces: [], otherPlaces: [], otherPlaceCount: 0 },
        null,
        0
      ),
      nearest: { miles: 3.1, storeName: null, town: null },
    })
    const { score, parts } = scoreMatch(m)
    expect(parts.map((p) => p.component).sort()).toEqual(['acquisitive', 'nearest', 'size', 'turnover', 'useClass'])
    // 30 + 10 + 20 + 10 + 0 earned of 30 + 10 + 30 + 15 + 15 available; a requirement covering
    // the site with no planning or news is 20 of 30.
    expect(score).toBe(Math.round((100 * 70) / 100))
  })
  it('leaves a missing signal out rather than counting it against the brand', () => {
    const { score, parts } = scoreMatch(baseMatch({}))
    expect(parts.map((p) => p.component)).toEqual(['size', 'acquisitive', 'turnover'])
    // Size 30 of 30; no acquisitive evidence and no published turnover still count, 0 of 30 and
    // 0 of 15.
    expect(score).toBe(Math.round((100 * 30) / 75))
  })
  it('scores demographics on the town match, not location type', () => {
    const townMatch = { band: 'partial' as const, bestTown: 'Ashford', townStores: 40, closeStores: 0, towns: 30, closeTowns: 0 }
    const { parts } = scoreMatch(
      baseMatch({ townMatch, locationType: { form: 'retail_park', count: 10, names: [], nearestMiles: 3 } })
    )
    expect(parts.map((p) => p.component)).toEqual(['size', 'acquisitive', 'demographics', 'turnover'])
    expect(parts[2]).toMatchObject({ points: 8, max: 15 })
    expect(scoreMatch(baseMatch({ townMatch: { ...townMatch, band: 'close' } })).parts[2].points).toBe(15)
    expect(scoreMatch(baseMatch({ townMatch: { ...townMatch, band: 'none' } })).parts[2].points).toBe(0)
  })
  it('scores published turnover by size, and nothing when there is none', () => {
    const points = (tradingFacts: TradingFacts | null) =>
      scoreMatch(baseMatch({ tradingFacts })).parts.find((p) => p.component === 'turnover')?.points
    const withTurnover = (value: number) => ({ ...chFacts, turnover: { status: 'filed' as const, value } })
    expect(points(withTurnover(1e10))).toBe(15)
    expect(points(withTurnover(100e6))).toBe(15)
    expect(points(withTurnover(25e6))).toBe(10)
    expect(points(withTurnover(2e6))).toBe(5)
    expect(points({ ...chFacts, turnover: { status: 'extracted', value: 8_986_000, page: 11 } })).toBe(5)
    expect(points({ ...chFacts, turnover: { status: 'not_published' } })).toBe(0)
    expect(points(chFacts)).toBe(0)
    expect(points(null)).toBe(0)
  })
  it('ranks a brand with large published turnover above an otherwise equal one without', () => {
    const big = scoreMatch(baseMatch({ tradingFacts: { ...chFacts, turnover: { status: 'filed', value: 1e9 } } }))
    expect(big.score).toBe(Math.round((100 * 45) / 75))
    expect(big.score).toBeGreaterThan(scoreMatch(baseMatch({})).score)
  })
  it('leaves turnover out of the score for a franchise', () => {
    const franchise = { sourceUrl: null, checkedAt: '2026-10-16' }
    const { score, parts } = scoreMatch(baseMatch({ franchise }))
    expect(parts.map((p) => p.component)).toEqual(['size', 'acquisitive'])
    expect(score).toBe(Math.round((100 * 30) / 60))
    // Even when a company with published turnover is linked: the franchise stands in for it.
    const linked = scoreMatch(baseMatch({ franchise, tradingFacts: { ...chFacts, turnover: { status: 'filed', value: 1e9 } } }))
    expect(linked.parts.find((p) => p.component === 'turnover')).toBeUndefined()
  })
  it('shows "Franchise" in the turnover column for a franchise', () => {
    const franchise = { sourceUrl: null, checkedAt: '2026-10-16' }
    expect(turnoverCell({ tradingFacts: { ...chFacts, turnover: { status: 'filed', value: 1e9 } }, franchise })).toBe('Franchise')
    expect(turnoverCell({ tradingFacts: { ...chFacts, turnover: { status: 'filed', value: 1e9 } } })).toBe('£1.0bn')
    expect(turnoverCell({ tradingFacts: null, franchise: null })).toBeNull()
  })
  it('leaves a charity\'s income out of the score but keeps its figures', () => {
    const charity = { ...chFacts, isCharity: true, turnover: { status: 'filed' as const, value: 3e8 } }
    const { parts } = scoreMatch(baseMatch({ tradingFacts: charity }))
    expect(parts.find((p) => p.component === 'turnover')).toBeUndefined()
    expect(turnoverCell({ tradingFacts: charity })).toBe('£300m')
    expect(turnoverLabel(charity)).toBe('Income (charity)')
    expect(turnoverLabel(chFacts)).toBe('Latest turnover')
  })
  it('treats an overseas brand like a franchise, labelled "Overseas"', () => {
    const overseas = { kind: 'overseas' as const, sourceUrl: null, checkedAt: '2026-10-22' }
    const { parts } = scoreMatch(baseMatch({ franchise: overseas }))
    expect(parts.find((p) => p.component === 'turnover')).toBeUndefined()
    expect(turnoverCell({ tradingFacts: null, franchise: overseas })).toBe('Overseas')
    // Reports shared before overseas brands were recorded carry no kind: those are franchises.
    expect(turnoverCell({ tradingFacts: null, franchise: { sourceUrl: null, checkedAt: '2026-10-16' } })).toBe('Franchise')
  })
  it('does not score net assets', () => {
    const withAssets = { ...chFacts, netAssets: { status: 'filed' as const, value: 1e9 } }
    expect(scoreMatch(baseMatch({ tradingFacts: withAssets })).score).toBe(scoreMatch(baseMatch({})).score)
  })
  it('scores a store under a mile away as a blocker (no points)', () => {
    const { parts } = scoreMatch(baseMatch({ nearest: { miles: 0.6, storeName: null, town: null } }))
    expect(parts.find((p) => p.component === 'nearest')?.points).toBe(0)
  })
})

describe('trading area', () => {
  const near = (miles: number, extra: { spacingMiles?: number; wantedHere?: boolean } = {}) => ({
    miles,
    storeName: null,
    town: null,
    ...extra,
  })

  it('scores distance as before when we hold no spacing for the brand', () => {
    expect(nearestPoints(near(300))).toBe(15)
    expect(tradingArea(near(300))).toBe('in')
  })
  it('keeps full points up to two spacings, tapers to five, and gives none beyond', () => {
    // Spacing 5 mi: full to 10 mi, nothing from 25 mi.
    expect(nearestPoints(near(10, { spacingMiles: 5 }))).toBe(15)
    expect(nearestPoints(near(17.5, { spacingMiles: 5 }))).toBe(8)
    expect(nearestPoints(near(24, { spacingMiles: 5 }))).toBe(1)
    expect(nearestPoints(near(25, { spacingMiles: 5 }))).toBe(0)
    expect(tradingArea(near(17.5, { spacingMiles: 5 }))).toBe('edge')
    expect(tradingArea(near(300, { spacingMiles: 5 }))).toBe('outside')
  })
  it('never gives more on the taper than the distance bands allow', () => {
    // A 1.5-mi spacing tapers from 3 mi to 7.5 mi; 4 and 6 mi are in the 3-10 mi band (10 points).
    expect(nearestPoints(near(4, { spacingMiles: 1.5 }))).toBe(10)
    expect(nearestPoints(near(6, { spacingMiles: 1.5 }))).toBe(5)
  })
  it('keeps close stores a blocker or caution whatever the spacing', () => {
    expect(nearestPoints(near(0.6, { spacingMiles: 40 }))).toBe(0)
    expect(nearestPoints(near(2, { spacingMiles: 40 }))).toBe(5)
  })
  it('gives full points outside the area when a requirement names the site', () => {
    expect(nearestPoints(near(300, { spacingMiles: 5, wantedHere: true }))).toBe(15)
    expect(tradingAreaLine('Centra', near(300, { spacingMiles: 5, wantedHere: true }))).toBe(
      "The nearest Centra store is 300 mi away, but Centra's requirement names this area."
    )
  })
  it('says why a brand outside its area scores nothing for distance', () => {
    const m = baseMatch({ nearest: near(300, { spacingMiles: 5 }) })
    expect(scoreMatch(m).parts.find((p) => p.component === 'nearest')?.points).toBe(0)
    expect(signalSummary(m, 'nearest', { useClass: 'E' }).status).toBe('poor')
    expect(signalSummary(baseMatch({ nearest: near(17.5, { spacingMiles: 5 }) }), 'nearest', { useClass: 'E' }).status).toBe(
      'caution'
    )
    expect(tradingAreaLine('Centra', near(300, { spacingMiles: 5 }))).toBe(
      "Centra's stores are usually within 5.0 mi of each other, so at 300 mi from the nearest one this site is outside the area Centra trades in today."
    )
  })
})

describe('signalSummaries', () => {
  it('gives every signal a status and value, with No data where we hold nothing', () => {
    const signals = signalSummaries(
      baseMatch({ useClass: { codes: ['E'], matches: true }, nearest: { miles: 42, storeName: null, town: null } }),
      { useClass: 'E' }
    )
    expect(signals.map((s) => [s.key, s.status, s.value])).toEqual([
      ['size', 'good', 'Fits'],
      ['useClass', 'good', 'Class E'],
      ['acquisitive', 'none', 'No data'],
      ['demographics', 'none', 'No data'],
      ['nearest', 'good', '42 mi'],
    ])
  })
  it('marks a store under a mile away poor and one under three miles caution', () => {
    const at = (miles: number) =>
      signalSummary(baseMatch({ nearest: { miles, storeName: null, town: null } }), 'nearest', { useClass: 'E' }).status
    expect(at(0.6)).toBe('poor')
    expect(at(2)).toBe('caution')
    expect(at(3.1)).toBe('good')
  })
  it('reads a size outside the range as a caution, labelled by direction', () => {
    const s = signalSummary(
      baseMatch({ size: { state: 'larger', basis: 'requirement', rangeMin: 8000, rangeMax: 12000 } }),
      'size',
      { useClass: 'E' }
    )
    expect(s).toMatchObject({ status: 'caution', value: 'Above range' })
  })
})

describe('sortMatches', () => {
  const a = baseMatch({ brandId: 'a', name: 'Aldi', score: 90, nearest: { miles: 3, storeName: null, town: null } })
  const g = baseMatch({
    brandId: 'g', name: 'Greggs', score: 70, nearest: { miles: 20, storeName: null, town: null },
    acquisitive: { level: 'high', requirements: null, news: null, planning: null },
  })
  const f = baseMatch({ brandId: 'f', name: 'Fettle', score: 50 })
  it('orders by the chosen key', () => {
    // Best match puts brands with acquisitive evidence first, then orders by score.
    expect(sortMatches([f, g, a], 'best').map((m) => m.brandId)).toEqual(['g', 'a', 'f'])
    expect(sortMatches([f, g, a], 'acquisitive').map((m) => m.brandId)).toEqual(['g', 'a', 'f'])
    expect(sortMatches([f, g, a], 'gap').map((m) => m.brandId)).toEqual(['g', 'a', 'f'])
    expect(sortMatches([f, g, a], 'name').map((m) => m.brandId)).toEqual(['a', 'f', 'g'])
  })
})

describe('news score', () => {
  const today = new Date('2026-10-22T00:00:00Z')
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10)
  const item = (rating: number, age: number, upcoming = false) => ({ rating, date: daysAgo(age), upcoming })
  const news = (score: number) => ({ count: 1, score, items: [] })

  it('is 0 with no articles, and adds ratings weighted by age, capped at ±5', () => {
    expect(newsScore([], today)).toBe(0)
    expect(newsScore([item(2, 0)], today)).toBe(2)
    // One half-life halves an article's weight.
    expect(newsScore([item(4, NEWS_HALF_LIFE_DAYS)], today)).toBe(2)
    expect(newsScore([item(5, 0), item(3, 10)], today)).toBe(5)
    expect(newsScore([item(-5, 0), item(-5, 0)], today)).toBe(-5)
    // A closure today outweighs an opening a year ago.
    expect(newsScore([item(2, 365), item(-2, 0)], today)).toBe(-2)
    // Upcoming articles count in full whatever their date.
    expect(newsScore([item(3, 700, true)], today)).toBe(3)
    // Rounded half away from zero, so a balance never reads as -0.
    expect(newsScore([item(1, 0), item(-1, 0)], today)).toBe(0)
    expect(Object.is(newsScore([item(-1, 400)], today), 0)).toBe(true)
  })
  it('makes a live requirement the biggest part of the acquisitive score, moved by news', () => {
    const req = (nearby: string[]) =>
      ({ count: 1, sizeMin: null, sizeMax: null, useClasses: [], nationwide: false, nearbyPlaces: nearby, otherPlaces: [], otherPlaceCount: 0 })
    const points = (r: RequirementEvidence | null, score: number | null, planning = 0) =>
      acquisitivePoints(acquisitiveSignal(r, score == null ? null : news(score), planning))
    expect(acquisitivePoints(null)).toBe(0)
    expect(points(req(['Leeds']), null)).toBe(20)
    expect(points(req([]), null)).toBe(12)
    expect(points(req(['Leeds']), null, 2)).toBe(23)
    expect(points(req(['Leeds']), 5, 2)).toBe(30)
    expect(points(req(['Leeds']), -5)).toBe(13)
    expect(points(null, 5)).toBe(7)
    expect(points(null, 2)).toBe(3)
    // Never below zero.
    expect(points(null, -5)).toBe(0)
    expect(points(null, null, 1)).toBe(3)
  })
  it('makes news-only evidence medium when positive and low otherwise', () => {
    expect(acquisitiveSignal(null, news(2), 0)?.level).toBe('medium')
    expect(acquisitiveSignal(null, news(0), 0)?.level).toBe('low')
    expect(acquisitiveSignal(null, news(-4), 0)?.level).toBe('low')
    expect(signalSummary(baseMatch({ acquisitive: acquisitiveSignal(null, news(-4), 0) }), 'acquisitive', { useClass: 'E' }))
      .toEqual({ key: 'acquisitive', status: 'poor', value: 'Low' })
  })
  it('scores news-only evidence within Acquisitive', () => {
    const { parts } = scoreMatch(baseMatch({ acquisitive: acquisitiveSignal(null, news(4), 0) }))
    expect(parts.find((p) => p.component === 'acquisitive')).toEqual({ component: 'acquisitive', points: 6, max: 30 })
  })
  it('lets strong news lift a brand into the acquiring group, and sorts closures below no evidence', () => {
    const strong = baseMatch({ brandId: 's', name: 'Strong', score: 40, acquisitive: acquisitiveSignal(null, news(3), 0) })
    const mild = baseMatch({ brandId: 'm', name: 'Mild', score: 80, acquisitive: acquisitiveSignal(null, news(1), 0) })
    const none = baseMatch({ brandId: 'n', name: 'None', score: 60 })
    const closing = baseMatch({ brandId: 'c', name: 'Closing', score: 90, acquisitive: acquisitiveSignal(null, news(-3), 0) })
    expect(sortMatches([none, mild, closing, strong], 'best').map((m) => m.brandId)).toEqual(['s', 'c', 'm', 'n'])
    expect(sortMatches([none, mild, closing, strong], 'acquisitive').map((m) => m.brandId)).toEqual(['s', 'm', 'n', 'c'])
  })
})

describe('matchesToCsv', () => {
  it('quotes and neutralises formula-looking cells', () => {
    const csv = matchesToCsv(
      [baseMatch({ name: '=HYPERLINK("x")', category: 'Food, drink' })],
      { sqft: 14000, useClass: 'E', postcode: 'LS6 2AT' }
    )
    const row = csv.split('\n')[1]
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
    expect(row).toContain('"Food, drink"')
  })
})

describe('formatSqftRange', () => {
  it('renders open and closed ranges', () => {
    expect(formatSqftRange(8000, 20000)).toBe('8k–20k sq ft')
    expect(formatSqftRange(1500, null)).toBe('1.5k+ sq ft')
    expect(formatSqftRange(null, 800)).toBe('up to 800 sq ft')
    expect(formatSqftRange(null, null)).toBeNull()
  })
})

describe('assembleMatches', () => {
  const input = (over: Partial<AssembleInput> = {}): AssembleInput => ({
    query: { sqft: 14000, useClass: 'E', postcode: 'LS6 2AT' },
    site,
    brands: [
      { id: 'aldi', name: 'Aldi', logoUrl: null, domain: null, category: 'Grocery', storeCount: 990 },
      { id: 'fettle', name: 'Fettle Home', logoUrl: null, domain: null, category: 'Homeware', storeCount: 22 },
      { id: 'tiny', name: 'Tiny Café', logoUrl: null, domain: null, category: null, storeCount: 5 },
      { id: 'gym', name: 'Gym Co', logoUrl: null, domain: null, category: null, storeCount: 5 },
      { id: 'nodata', name: 'No Data', logoUrl: null, domain: null, category: null, storeCount: 5 },
    ],
    estateRanges: new Map([
      ['fettle', [{ p25: 12000, p75: 16000, min: 9000, max: 20000 }]],
      ['tiny', [{ p25: 800, p75: 1200, min: 500, max: 1500 }]],
    ]),
    requirements: [
      {
        brandId: 'aldi', sizeMin: 8000, sizeMax: 20000, useClasses: ['E'],
        locations: [{ name: 'Leeds, West Yorkshire', lat: 53.8, lon: -1.55 }],
        contacts: [contact({ id: 'rh', name: 'Rebecca Hale', area: 'North & Yorkshire' })],
      },
      { brandId: 'gym', sizeMin: 10000, sizeMax: 20000, useClasses: ['F'], locations: [], contacts: [] },
    ],
    brandContacts: new Map(),
    news: [],
    planningCounts: new Map(),
    geo: new Map([
      ['aldi', { storeCount: 990, nearestMeters: 5000, nearestName: 'Aldi Kirkstall', nearestTown: 'Leeds', sameFormCount: 10, sameFormNames: ['Owlcotes; Leeds (Y; E)'], sameFormNearestMeters: 6000 }],
      ['fettle', { storeCount: 22, nearestMeters: 67000, nearestName: null, nearestTown: null, sameFormCount: 1, sameFormNames: ['Owlcotes'], sameFormNearestMeters: 67000 }],
    ]),
    ...over,
  })

  it('returns size-fitting, use-class-compatible brands ranked by score', () => {
    const { matches, considered } = assembleMatches(input())
    expect(considered).toBe(4)
    expect(matches.map((m) => m.brandId)).toEqual(['aldi', 'fettle'])
    const aldi = matches[0]
    expect(aldi.acquisitive?.level).toBe('high')
    expect(aldi.acquisitive?.requirements?.nearbyPlaces).toEqual(['Leeds'])
    expect(aldi.contacts.primary?.id).toBe('rh')
    expect(aldi.contacts.coversRegion).toBe(true)
    expect(aldi.locationType?.names).toEqual(['Owlcotes'])
    const fettle = matches[1]
    expect(fettle.acquisitive).toBeNull()
    expect(fettle.typicalRange).toEqual({ min: 12000, max: 16000 })
  })
  it('widen keeps a use-class mismatch, flagged', () => {
    const { matches } = assembleMatches(input({ query: { sqft: 14000, useClass: 'E', postcode: 'LS6 2AT', widen: true } }))
    const gym = matches.find((m) => m.brandId === 'gym')
    expect(gym?.useClass).toEqual({ codes: ['F'], matches: false })
  })
  it('All use classes excludes no brand on use class, and counts every stated class as a match', () => {
    const { matches } = assembleMatches(input({ query: { sqft: 14000, useClass: 'All', postcode: 'LS6 2AT' } }))
    const gym = matches.find((m) => m.brandId === 'gym')
    expect(gym?.useClass).toEqual({ codes: ['F'], matches: true })
    expect(signalSummary(gym!, 'useClass', { useClass: 'All' })).toEqual({ key: 'useClass', status: 'good', value: 'Class F' })
  })
  it('rates each brand on its news, newest first', () => {
    const today = new Date('2026-10-22T00:00:00Z')
    const n = (kind: 'opening' | 'closure' | 'news', date: string, rating: number) => ({
      brandId: 'fettle', kind, headline: `${kind} ${date}`, url: null, date, upcoming: false, rating,
    })
    const { matches } = assembleMatches(
      input({ today, news: [n('opening', '2026-10-01', 2), n('news', '2026-10-20', 4)] })
    )
    const fettle = matches.find((m) => m.brandId === 'fettle')!
    expect(fettle.acquisitive?.news?.score).toBe(5)
    expect(fettle.acquisitive?.news?.items.map((i) => i.rating)).toEqual([4, 2])
    expect(fettle.acquisitive?.level).toBe('medium')
    expect(matches.find((m) => m.brandId === 'aldi')!.acquisitive?.news).toBeNull()
  })
  it("carries the brand's store spacing, floored, and whether a requirement names the site", () => {
    const geo = input().geo
    geo.set('aldi', { ...geo.get('aldi')!, spacingMeters: 16093.44 })
    geo.set('fettle', { ...geo.get('fettle')!, spacingMeters: null })
    const { matches } = assembleMatches(input({ geo }))
    const aldi = matches.find((m) => m.brandId === 'aldi')!
    expect(aldi.nearest?.spacingMiles).toBeCloseTo(10)
    expect(aldi.nearest?.wantedHere).toBe(true)
    const fettle = matches.find((m) => m.brandId === 'fettle')!
    // One store: no gap to measure, so the floor applies; 67 km is beyond 5 spacings.
    expect(fettle.nearest?.spacingMiles).toBe(5)
    expect(fettle.nearest?.wantedHere).toBeUndefined()
    expect(tradingArea(fettle.nearest!)).toBe('outside')
  })
  it('leaves the location-type signal out when the site is in no centre', () => {
    const { matches } = assembleMatches(input({ site: { ...site, centre: null } }))
    expect(matches.every((m) => m.locationType === null)).toBe(true)
  })

  describe('demographics', () => {
    const close: TownMatch = { band: 'close', bestTown: 'Harrogate', townStores: 22, closeStores: 3, towns: 18, closeTowns: 2 }
    const townMatches = new Map<string, TownMatch>([['fettle', close]])

    it("carries the brand's town match, and none for a brand with no stores in towns", () => {
      const { matches } = assembleMatches(input({ townMatches }))
      expect(matches.find((m) => m.brandId === 'fettle')!.townMatch).toEqual(close)
      expect(matches.find((m) => m.brandId === 'aldi')!.townMatch).toBeNull()
      expect(assembleMatches(input()).matches.every((m) => m.townMatch === undefined)).toBe(true)
    })

    it('counts towards the score as one of the five signals', () => {
      const fettle = assembleMatches(input({ townMatches })).matches.find((m) => m.brandId === 'fettle')!
      expect(fettle.scoreParts.find((p) => p.component === 'demographics')).toMatchObject({ points: 15, max: 15 })
      expect(signalSummary(fettle, 'demographics', { useClass: 'E' })).toEqual({ key: 'demographics', status: 'good', value: 'Close match' })
    })

    it('reads a gap of up to 1 as close and up to 2 as partial', () => {
      expect([0, 1, 1.01, 2, 2.5, null].map(townBand)).toEqual(['close', 'close', 'partial', 'partial', 'none', null])
    })

    it('lists stores best match first, nearest first on a tie, stores in no town last', () => {
      const s = (name: string, gap: number | null, miles: number) => ({ name, gap, miles })
      expect(sortStoreTowns([s('a', null, 1), s('b', 2, 9), s('c', 0.5, 40), s('d', 0.5, 3)]).map((x) => x.name)).toEqual([
        'd', 'c', 'b', 'a',
      ])
    })

    it('exports the town match', () => {
      const csv = matchesToCsv(assembleMatches(input({ townMatches })).matches, { sqft: 14000, useClass: 'E', postcode: 'LS6 2AT' })
      const [header, ...rows] = csv.split('\n')
      const col = header.split(',').indexOf('Town match')
      expect(col).toBeGreaterThan(-1)
      expect(rows.map((r) => r.split(',')[col])).toContain('Close match')
    })
  })
})

describe('sector filter', () => {
  const brands = [
    { name: 'A', category: 'Retail' },
    { name: 'B', category: 'Gym' },
    { name: 'C', category: 'Retail' },
    { name: 'D', category: null },
    { name: 'E', category: 'Leisure · Padel' },
  ]

  it('lists sectors present, A–Z, with unlisted last', () => {
    expect(sectorOptions(brands)).toEqual([
      { id: 'Gym', name: 'Gym', count: 1 },
      { id: 'Leisure', name: 'Leisure', count: 1 },
      { id: 'Retail', name: 'Retail', count: 2 },
      { id: NO_SECTOR, name: 'No sector listed', count: 1 },
    ])
  })

  it('keeps everything when nothing is selected', () => {
    expect(filterBySector(brands, [])).toBe(brands)
  })

  it('keeps only the selected sectors, including unlisted brands', () => {
    expect(filterBySector(brands, ['Retail', NO_SECTOR]).map((b) => b.name)).toEqual(['A', 'C', 'D'])
    expect(filterBySector(brands, ['Leisure']).map((b) => b.name)).toEqual(['E'])
  })
})
