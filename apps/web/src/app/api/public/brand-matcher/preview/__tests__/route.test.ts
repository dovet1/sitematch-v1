/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { matchSite } from '../../engine'
import type { BrandMatch } from '@/app/sitematcher-unified/types/brand-matcher'

jest.mock('@/lib/feature-flags', () => ({ isBrandMatcherEnabled: jest.fn().mockResolvedValue(true) }))
jest.mock('../../engine', () => ({
  parseQuery: (b: { sqft: number; postcode: string; useClass: string }) => ({
    sqft: b.sqft,
    postcode: b.postcode,
    useClass: b.useClass,
    widen: false,
  }),
  matchSite: jest.fn(),
}))

function brand(id: string, score: number, codes: string[] | null): BrandMatch {
  return {
    brandId: id,
    name: `Secret ${id}`,
    logoUrl: `https://logos.example/${id}.png`,
    domain: `${id}.example`,
    category: 'Food & beverage',
    storeCount: 12,
    size: { state: 'fits', basis: 'estate', rangeMin: 1000, rangeMax: 2000 },
    useClass: codes ? { codes, matches: true } : null,
    acquisitive: null,
    tradingFacts: null,
    locationType: null,
    nearest: { miles: 12, storeName: `Secret ${id} Leeds`, town: 'Leeds' },
    typicalRange: null,
    contacts: {
      primary: { id: 'c', name: 'Pat Person', title: 'Head of Property', area: null, email: 'pat@secret.example', phone: '0113 000 0000', isPrimary: true },
      coversRegion: true,
      others: [],
      total: 1,
    },
    score,
    scoreParts: [],
  }
}

function post(body: unknown, ip = '1.1.1.1') {
  return POST(
    new NextRequest('http://localhost/api/public/brand-matcher/preview', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-forwarded-for': ip },
    })
  )
}

beforeEach(() => {
  ;(matchSite as jest.Mock).mockResolvedValue({
    ok: true,
    payload: {
      site: { postcode: 'LS6 2AT', lat: 0, lon: 0, centre: null, region: null, country: null },
      query: { sqft: 1500, useClass: 'All', postcode: 'LS6 2AT' },
      matches: [brand('a', 90, ['E']), brand('b', 80, ['Sui Generis']), brand('c', 70, null), brand('d', 60, ['E']), brand('e', 50, ['F'])],
      considered: 5,
    },
  })
})

describe('POST /api/public/brand-matcher/preview', () => {
  it('sends no brand identity or contact details', async () => {
    const res = await post({ postcode: 'LS6 2AT', sqft: 1500 })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(/Secret|logos\.example|\.example|Pat Person|0113/)
  })

  it('runs once across every use class and cuts the E and Sui generis lists from it', async () => {
    const res = await post({ postcode: 'LS1 1AA', sqft: 1500 }, '2.2.2.2')
    const body = await res.json()
    expect((matchSite as jest.Mock).mock.calls.at(-1)[0].useClass).toBe('All')
    expect(body.lists.all.total).toBe(5)
    // A brand with no stated use class stays in every list.
    expect(body.lists.E.total).toBe(3)
    expect(body.lists.SG.total).toBe(2)
    expect(body.lists.all.rows).toHaveLength(3)
    expect(body.lists.all.rows.map((r: { score: number }) => r.score)).toEqual([90, 80, 70])
    expect(body.lists.all.rows[0].contactCount).toBe(1)
  })

  it('limits bursts from one address', async () => {
    let last = 200
    for (let i = 0; i < 22; i++) {
      const res = await post({ postcode: `LS${i} 1AA`, sqft: 1500 }, '3.3.3.3')
      last = res.status
    }
    expect(last).toBe(429)
  })
})
