import {
  acquisitiveSignal,
  areaCoversRegion,
  assembleMatches,
  affluenceComparison,
  filterBySector,
  NO_SECTOR,
  sectorOptions,
  formatSqftRange,
  isNationalArea,
  matchesToCsv,
  normalisePostcode,
  rankContacts,
  regionKey,
  scoreMatch,
  shortCentreName,
  signalSummaries,
  signalSummary,
  sizeFit,
  sortMatches,
  type AssembleInput,
  type CatchmentsInput,
} from '../brand-matcher'
import type {
  BrandMatch,
  BrandMatcherContact,
  BrandMatcherSite,
  RequirementEvidence,
  StoreCatchment,
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
      acquisitive: { level: 'high', requirements: null, news: null, planning: null },
      nearest: { miles: 3.1, storeName: null, town: null },
    })
    const { score, parts } = scoreMatch(m)
    expect(parts.map((p) => p.component).sort()).toEqual(['acquisitive', 'nearest', 'size', 'turnover', 'useClass'])
    // 30 + 10 + 30 + 10 + 0 earned of 30 + 10 + 30 + 15 + 15 available.
    expect(score).toBe(Math.round((100 * 80) / 100))
  })
  it('leaves a missing signal out rather than counting it against the brand', () => {
    const { score, parts } = scoreMatch(baseMatch({}))
    expect(parts.map((p) => p.component)).toEqual(['size', 'turnover'])
    // Size 30 of 30; no published turnover still counts, 0 of 15.
    expect(score).toBe(Math.round((100 * 30) / 45))
  })
  it('scores neither demographics nor location type', () => {
    const catchments = {
      site: { radiusMeters: 1000, population: 19000, affluence: 140 },
      stores: [{ name: null, town: null, miles: 2, catchment: { radiusMeters: 1000, population: 12000, affluence: 140 } }],
    }
    const { parts } = scoreMatch(
      baseMatch({ catchments, locationType: { form: 'retail_park', count: 10, names: [], nearestMiles: 3 } })
    )
    expect(parts.map((p) => p.component)).toEqual(['size', 'turnover'])
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
    expect(big.score).toBe(100)
    expect(big.score).toBeGreaterThan(scoreMatch(baseMatch({})).score)
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

  describe('demographics', () => {
    const area = (affluence: number | null, population = 12000) => ({ radiusMeters: 1000, population, affluence })
    const catchments: CatchmentsInput = {
      site: area(118, 19000),
      stores: new Map<string, StoreCatchment[]>([
        ['fettle', [
          { name: 'Fettle Leeds', town: 'Leeds', miles: 1.2, catchment: area(110) },
          { name: 'Fettle Wakefield', town: 'Wakefield', miles: 9, catchment: area(120) },
          { name: 'Fettle Cardiff', town: 'Cardiff', miles: 180, catchment: null },
        ]],
        ['aldi', [{ name: 'Aldi Leeds', town: 'Leeds', miles: 0.4, catchment: area(80) }]],
      ]),
    }
    const run = (c = catchments) => assembleMatches(input({ catchments: c })).matches
    const find = (id: string, c = catchments) => run(c).find((m) => m.brandId === id)!

    it("carries the site's and the brand's nearest stores' catchments", () => {
      expect(find('fettle').catchments).toEqual({ site: area(118, 19000), stores: catchments.stores.get('fettle') })
      const noAldiStores = { ...catchments, stores: new Map([['fettle', catchments.stores.get('fettle')!]]) }
      expect(find('aldi', noAldiStores).catchments).toEqual({ site: area(118, 19000), stores: [] })
      expect(assembleMatches(input()).matches.every((m) => m.catchments == null)).toBe(true)
    })

    it('compares the site with the average of the stores it has figures for', () => {
      // 118 against (110 + 120) / 2 = 115: within ten points.
      expect(affluenceComparison(find('fettle').catchments)).toEqual({ comparison: 'similar', storesAverage: 115 })
      expect(affluenceComparison(find('aldi').catchments)?.comparison).toBe('higher')
      expect(affluenceComparison(find('aldi', { ...catchments, stores: new Map() }).catchments)).toBeNull()
      expect(affluenceComparison(find('fettle', { ...catchments, site: null }).catchments)).toBeNull()
    })

    it('is shown as information and never scored', () => {
      const fettle = find('fettle')
      expect(signalSummary(fettle, 'demographics', { useClass: 'E' })).toEqual({ key: 'demographics', status: 'info', value: 'Similar' })
      expect(signalSummary(find('aldi'), 'demographics', { useClass: 'E' }).value).toBe('More affluent')
      expect(fettle.scoreParts.map((p) => p.component)).not.toContain('demographics')
      expect(fettle.score).toBe(assembleMatches(input()).matches.find((m) => m.brandId === 'fettle')!.score)
    })

    it('exports the comparison', () => {
      const csv = matchesToCsv(run(), { sqft: 14000, useClass: 'E', postcode: 'LS6 2AT' })
      const [header, ...rows] = csv.split('\n')
      const col = header.split(',').indexOf('Site affluence vs nearest stores')
      expect(col).toBeGreaterThan(-1)
      expect(rows.map((r) => r.split(',')[col])).toContain('Similar')
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
