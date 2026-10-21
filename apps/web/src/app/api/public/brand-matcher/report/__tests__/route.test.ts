/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { brandStoreTowns, matchSite } from '../../engine'
import type { BrandMatch } from '@/app/sitematcher-unified/types/brand-matcher'

jest.mock('@/lib/feature-flags', () => ({
  isBrandMatcherEnabled: jest.fn().mockResolvedValue(true),
  isBrandMatcherDemographicsEnabled: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/lib/directory', () => ({
  requirePlusAccess: jest.fn().mockResolvedValue({ error: null }),
}))
jest.mock('../../engine', () => ({
  parseQuery: (b: { sqft: number; postcode: string; useClass: string } | undefined) =>
    b
      ? {
          sqft: b.sqft,
          postcode: b.postcode,
          useClass: b.useClass,
          widen: false,
        }
      : 'Invalid request',
  matchSite: jest.fn(),
  brandStoreTowns: jest.fn(),
}))

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function brand(n: number, score: number): BrandMatch {
  return {
    brandId: id(n),
    name: `Brand ${n}`,
    logoUrl: null,
    domain: null,
    category: 'Food & beverage',
    storeCount: 12,
    size: { state: 'fits', basis: 'estate', rangeMin: 1000, rangeMax: 2000 },
    useClass: { codes: ['E'], matches: true },
    acquisitive: null,
    tradingFacts: null,
    locationType: null,
    nearest: { miles: 12, storeName: `Brand ${n} Leeds`, town: 'Leeds' },
    typicalRange: { min: 1000, max: 2000 },
    contacts: {
      primary: {
        id: 'c',
        name: 'Pat Person',
        title: 'Head of Property',
        area: null,
        email: 'pat@secret.example',
        phone: '0113 000 0000',
        isPrimary: true,
      },
      coversRegion: true,
      others: [
        {
          id: 'd',
          name: 'Sam Other',
          title: null,
          area: 'North',
          email: 'sam@secret.example',
          phone: null,
          isPrimary: false,
        },
      ],
      total: 2,
    },
    score,
    scoreParts: [],
  }
}

const site = {
  postcode: 'LS6 2AT',
  lat: 53.8,
  lon: -1.5,
  centre: null,
  region: null,
  country: 'England',
  town: { code: 'E1', name: 'Leeds', population: 500000, affluence: 101 },
}

function post(body: unknown) {
  return POST(
    new NextRequest('http://test/api/public/brand-matcher/report', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  )
}

const query = { sqft: 1500, postcode: 'LS6 2AT', useClass: 'E' }

beforeEach(() => {
  ;(matchSite as jest.Mock).mockResolvedValue({
    ok: true,
    payload: {
      site,
      query: { ...query, widen: false },
      matches: [brand(1, 70), brand(2, 90), brand(3, 80)],
      considered: 3,
    },
  })
  ;(brandStoreTowns as jest.Mock).mockResolvedValue({ stores: [], total: 4 })
})

it('returns only the chosen brands, ordered by fit, with no contact data anywhere', async () => {
  const res = await post({ query, brandIds: [id(1), id(2)] })
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(text).not.toMatch(/contacts|secret\.example|0113|Pat Person|Sam Other/)
  const body = JSON.parse(text)
  expect(body.brands.map((b: { name: string }) => b.name)).toEqual(['Brand 2', 'Brand 1'])
  expect(body.brands[0].storeTowns).toEqual({ stores: [], total: 4 })
})

it('rejects more than 20 brands and malformed ids', async () => {
  const many = Array.from({ length: 21 }, (_, i) => id(i + 1))
  expect((await post({ query, brandIds: many })).status).toBe(400)
  expect((await post({ query, brandIds: ['nope'] })).status).toBe(400)
  expect((await post({ query, brandIds: [] })).status).toBe(400)
})

it('keeps the report when a store read fails', async () => {
  ;(brandStoreTowns as jest.Mock).mockRejectedValueOnce(new Error('boom'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const res = await post({ query, brandIds: [id(2)] })
  expect(res.status).toBe(200)
  expect((await res.json()).brands[0].storeTowns).toBeNull()
})
