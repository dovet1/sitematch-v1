import {
  acquisitiveLine,
  byFit,
  demographicsLine,
  financialRows,
  nearestLine,
  parseReportMeta,
  reportFileName,
  reportPageCount,
  sizeLine,
  sizeScale,
  toReportBrand,
  useClassLine,
} from '../brand-report'
import type { BrandMatch, BrandMatcherSite, TradingFacts } from '../../types/brand-matcher'

const match: BrandMatch = {
  brandId: 'b1',
  name: 'Cook',
  logoUrl: null,
  domain: 'cookfood.net',
  category: 'Grocery',
  storeCount: 115,
  size: {
    state: 'fits',
    basis: 'requirement',
    rangeMin: 900,
    rangeMax: 1400,
    postedAt: '2026-07-11',
  },
  useClass: { codes: ['E'], matches: true },
  acquisitive: {
    level: 'high',
    requirements: {
      count: 1,
      sizeMin: 900,
      sizeMax: 1400,
      useClasses: ['E'],
      nationwide: false,
      nearbyPlaces: ['Ashford', 'Canterbury', 'Hythe', 'Maidstone'],
      otherPlaces: [],
      otherPlaceCount: 0,
    },
    news: null,
    planning: null,
  },
  tradingFacts: null,
  locationType: null,
  nearest: {
    miles: 27,
    storeName: 'Cook Leigh on Sea',
    town: 'Southend-On-Sea',
  },
  typicalRange: { min: 936, max: 1600 },
  contacts: {
    primary: {
      id: 'c',
      name: 'Pat',
      title: null,
      area: null,
      email: 'pat@cook.example',
      phone: '01',
      isPrimary: true,
    },
    coversRegion: true,
    others: [],
    total: 1,
  },
  townMatch: {
    band: 'close',
    bestTown: 'Banbury',
    townStores: 115,
    closeStores: 5,
    towns: 90,
    closeTowns: 5,
  },
  score: 100,
  scoreParts: [],
}

const site: BrandMatcherSite = {
  postcode: 'CT1 1XU',
  lat: 51.28,
  lon: 1.08,
  centre: null,
  region: 'South East',
  country: 'England',
  town: { code: 'E1', name: 'Canterbury', population: 55000, affluence: 97 },
}

it('copies a match without its contacts', () => {
  const r = toReportBrand(match, null)
  expect(r).not.toHaveProperty('contacts')
  expect(JSON.stringify(r)).not.toMatch(/pat@cook|Pat/)
  expect(r.townMatch).toEqual(match.townMatch)
})

it('orders by fit and counts pages', () => {
  expect(
    byFit([
      { name: 'B', score: 80 },
      { name: 'A', score: 80 },
      { name: 'C', score: 95 },
    ]).map((b) => b.name)
  ).toEqual(['C', 'A', 'B'])
  expect(reportPageCount(4)).toBe(1 + 1 + 4)
  expect(reportPageCount(12)).toBe(1 + 1 + 12)
  expect(reportPageCount(20)).toBe(1 + 2 + 20)
})

it('writes the handoff sentences', () => {
  expect(sizeLine(match, 1000)).toBe(
    "Your 1,000 sq ft sits inside the size range of Cook's existing stores and its live requirement."
  )
  expect(useClassLine(match, 'E')).toBe('Cook typically trades under Class E, the same as your site.')
  expect(acquisitiveLine(match)).toBe(
    '1 requirement listed with SiteMatcher points to an active opening programme. Its requirements target Ashford, Canterbury, Hythe and Maidstone, within reach of your site.'
  )
  expect(demographicsLine(match, site)).toBe(
    "5 stores of Cook's 115 are in 5 towns like Canterbury, the closest being Banbury."
  )
  expect(nearestLine(match)).toBe('Far enough from existing Cook stores to avoid cannibalising them.')
  expect(
    nearestLine({
      ...match,
      nearest: { miles: 1.4, storeName: null, town: null },
    })
  ).toBe('An existing Cook store is 1.4 mi away, so a new store here may compete with it.')
})

it('scales the size chart from at least 3k', () => {
  expect(sizeScale([1000, 1600, 1400])).toEqual({
    max: 3000,
    ticks: [0, 1000, 2000, 3000],
  })
  expect(sizeScale([4500])).toEqual({
    max: 5000,
    ticks: [0, 1000, 2000, 3000, 4000, 5000],
  })
  expect(sizeScale([18000, 22000]).ticks).toEqual([0, 5000, 10000, 15000, 20000, 25000])
})

it('lists Companies House facts with overdue accounts flagged', () => {
  const facts: TradingFacts = {
    companyNumber: '13557104',
    companyName: 'FAT PHILLS LTD',
    status: 'Active',
    accountsType: null,
    accountsMadeUpTo: '2025-03-31',
    accountsOverdue: true,
    registeredOffice: null,
    turnover: { status: 'not_published' },
    netAssets: { status: 'filed', value: 300_000 },
    fetchedAt: '2026-10-01',
  }
  const rows = financialRows(facts)
  expect(rows.find((r) => r.label === 'Accounts filed')).toEqual({
    label: 'Accounts filed',
    value: 'Overdue',
    tone: 'bad',
  })
  expect(rows.find((r) => r.label === 'Latest turnover')).toEqual({
    label: 'Latest turnover',
    value: 'Not disclosed',
    tone: 'muted',
  })
  expect(rows.find((r) => r.label === 'Accounts type')).toBeUndefined()
  expect(rows.find((r) => r.label === 'Accounts made up to')?.value).toBe('31 Mar 2025')
})

it('names the file and reads saved meta defensively', () => {
  expect(reportFileName('Harbour / Estates', 'CT1 1XU')).toBe('SiteMatcher brand report – Harbour Estates – CT1 1XU')
  expect(reportFileName('  ', 'CT1 1XU')).toBe('SiteMatcher brand report – CT1 1XU')
  expect(parseReportMeta({ preparedFor: 'Aldi', paper: 'tabloid', note: 3 })).toEqual({ preparedFor: 'Aldi' })
  expect(parseReportMeta('nope')).toBeNull()
})
