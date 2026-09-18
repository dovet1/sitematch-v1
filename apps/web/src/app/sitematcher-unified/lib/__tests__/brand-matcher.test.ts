import {
  acquisitiveSignal,
  areaCoversRegion,
  assembleMatches,
  buildPills,
  formatSqftRange,
  isNationalArea,
  matchesToCsv,
  normalisePostcode,
  rankContacts,
  regionKey,
  scoreMatch,
  shortCentreName,
  sizeFit,
  sortMatches,
  type AssembleInput,
} from '../brand-matcher'
import type {
  BrandMatch,
  BrandMatcherContact,
  BrandMatcherSite,
  RequirementEvidence,
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
  it('is the sum of the parts shown as pills', () => {
    const m = baseMatch({
      useClass: { codes: ['E'], matches: true },
      acquisitive: { level: 'high', requirements: null, news: null, planning: null },
      locationType: { form: 'retail_park', count: 10, names: [], nearestMiles: 3 },
      nearest: { miles: 3.1, storeName: null, town: null },
    })
    const { score, parts } = scoreMatch(m)
    expect(parts.map((p) => p.component).sort()).toEqual(
      ['acquisitive', 'locationType', 'nearest', 'size', 'useClass']
    )
    expect(score).toBe(30 + 10 + 30 + 15 + 10)
  })
  it('never scores trading facts', () => {
    const facts = {
      ...chFacts,
      turnover: { status: 'filed' as const, value: 1e10 },
      netAssets: { status: 'filed' as const, value: 1e9 },
    }
    expect(scoreMatch(baseMatch({ tradingFacts: facts })).score).toBe(scoreMatch(baseMatch({})).score)
  })
  it('scores a store under a mile away as a blocker (no points)', () => {
    const { parts } = scoreMatch(baseMatch({ nearest: { miles: 0.6, storeName: null, town: null } }))
    expect(parts.find((p) => p.component === 'nearest')?.points).toBe(0)
  })
})

describe('buildPills', () => {
  it('drops the acquisitive pill for a sparse brand and keeps the verifiable ones', () => {
    const pills = buildPills(
      baseMatch({
        useClass: { codes: ['E'], matches: true },
        locationType: { form: 'retail_park', count: 1, names: ['Owlcotes'], nearestMiles: 42 },
        nearest: { miles: 42, storeName: null, town: null },
      }),
      { useClass: 'E' }
    )
    expect(pills.map((p) => p.key)).toEqual(['size', 'useClass', 'locationType', 'nearest'])
    expect(pills.find((p) => p.key === 'useClass')?.value).toBe('Class E')
    expect(pills.find((p) => p.key === 'locationType')).toMatchObject({ label: 'retail parks', value: 'Trades in 1', tone: 'green' })
  })
  it('shows no turnover pill while figures are unread', () => {
    const pills = buildPills(baseMatch({ tradingFacts: chFacts }), { useClass: 'E' })
    expect(pills.find((p) => p.key === 'turnover')).toBeUndefined()
  })
  it('colours a very near store red and turnover always neutral', () => {
    const pills = buildPills(
      baseMatch({
        nearest: { miles: 0.6, storeName: 'Greggs Headingley', town: 'Leeds' },
        tradingFacts: { ...chFacts, turnover: { status: 'not_published' } },
      }),
      { useClass: 'E' }
    )
    expect(pills.find((p) => p.key === 'nearest')?.tone).toBe('red')
    expect(pills.find((p) => p.key === 'turnover')).toMatchObject({ value: 'Not disclosed', tone: 'neutral' })
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
    expect(sortMatches([f, g, a], 'best').map((m) => m.brandId)).toEqual(['a', 'g', 'f'])
    expect(sortMatches([f, g, a], 'acquisitive').map((m) => m.brandId)).toEqual(['g', 'a', 'f'])
    expect(sortMatches([f, g, a], 'gap').map((m) => m.brandId)).toEqual(['g', 'a', 'f'])
    expect(sortMatches([f, g, a], 'name').map((m) => m.brandId)).toEqual(['a', 'f', 'g'])
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
  it('leaves the location-type signal out when the site is in no centre', () => {
    const { matches } = assembleMatches(input({ site: { ...site, centre: null } }))
    expect(matches.every((m) => m.locationType === null)).toBe(true)
  })
})
