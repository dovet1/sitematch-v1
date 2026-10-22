import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrandMatchCard } from '../BrandMatchCard'
import { scoreMatch } from '../../../../lib/brand-matcher'
import { fetchBrandStoreTowns } from '../../../../lib/services/brand-matcher-service'
import type {
  BrandMatch,
  BrandMatcherQuery,
  BrandMatcherSite,
} from '../../../../types/brand-matcher'

const query: BrandMatcherQuery = { sqft: 14000, useClass: 'E', postcode: 'LS6 2AT' }
const site: BrandMatcherSite = {
  postcode: 'LS6 2AT',
  lat: 53.82,
  lon: -1.58,
  centre: { id: 'rc', name: 'Kirkstall Retail Park', classification: 'Large Retail Park', form: 'retail_park' },
  region: 'Yorkshire and The Humber',
  country: 'England',
  town: { code: 'E63000001', name: 'Leeds', population: 536_280, affluence: 104 },
}

jest.mock('../../../../lib/services/brand-matcher-service', () => ({ fetchBrandStoreTowns: jest.fn() }))
const mockStoreTowns = fetchBrandStoreTowns as jest.MockedFunction<typeof fetchBrandStoreTowns>

function withScore(m: Omit<BrandMatch, 'score' | 'scoreParts'>): BrandMatch {
  const { score, parts } = scoreMatch(m)
  return { ...m, score, scoreParts: parts }
}

const rich = withScore({
  brandId: 'aldi',
  name: 'Aldi',
  logoUrl: null,
  domain: null,
  category: 'Discount grocery',
  storeCount: 990,
  size: { state: 'fits', basis: 'requirement', rangeMin: 10000, rangeMax: 18000, postedAt: '2026-10-03' },
  useClass: { codes: ['E'], matches: true },
  acquisitive: {
    level: 'high',
    requirements: {
      count: 12, sizeMin: 8000, sizeMax: 20000, useClasses: ['E'], nationwide: false,
      nearbyPlaces: ['Leeds'], otherPlaces: [], otherPlaceCount: 0,
      items: [
        { sizeMin: 8000, sizeMax: 20000, useClasses: ['E'], places: ['Leeds', 'Bradford'], postedAt: '2026-10-03' },
      ],
    },
    news: {
      count: 1,
      score: 4,
      items: [{ kind: 'news', headline: 'Aldi confirms 40 new UK stores this year', url: 'https://example.com/aldi', date: '2026-09-22', upcoming: false, rating: 4 }],
    },
    planning: { count: 5 },
  },
  tradingFacts: null,
  locationType: { form: 'retail_park', count: 10, names: ['Owlcotes', 'Crown Point', 'Kirkstall Bridge'], nearestMiles: 3 },
  nearest: {
    miles: 3.1, storeName: 'Aldi Kirkstall', town: 'Leeds',
    stores: [
      { name: 'Aldi Kirkstall', town: 'Leeds', miles: 3.1 },
      { name: 'Aldi Headingley', town: 'Leeds', miles: 4.2 },
      { name: 'Aldi Horsforth', town: 'Leeds', miles: 5.8 },
    ],
  },
  typicalRange: { min: 14000, max: 20000 },
  contacts: {
    primary: { id: 'rh', name: 'Rebecca Hale', title: 'Property Acquisitions', area: 'North & Yorkshire', email: 'r.hale@aldi.co.uk', phone: '01827 711 812', isPrimary: false },
    coversRegion: true,
    others: [
      { id: 'dm', name: 'Daniel Marsh', title: 'National Property Director', area: null, email: 'd.marsh@aldi.co.uk', phone: null, isPrimary: true },
      { id: 'in', name: null, title: null, area: null, email: 'property@aldi.co.uk', phone: null, isPrimary: false },
    ],
    total: 3,
  },
})

const sparse = withScore({
  brandId: 'fettle',
  name: 'Fettle Home',
  logoUrl: null,
  domain: null,
  category: 'Homeware',
  storeCount: 22,
  size: { state: 'fits', basis: 'estate', rangeMin: 12000, rangeMax: 16000 },
  useClass: null,
  acquisitive: null,
  tradingFacts: null,
  locationType: { form: 'retail_park', count: 1, names: ['Owlcotes'], nearestMiles: 42 },
  nearest: { miles: 42, storeName: null, town: null },
  typicalRange: { min: 12000, max: 16000 },
  contacts: { primary: null, coversRegion: false, others: [], total: 0 },
})

function Harness({
  match,
  startExpanded,
  onChange,
  limited = false,
  onToggle = jest.fn(),
}: {
  match: BrandMatch
  startExpanded: boolean
  onChange: jest.Mock
  limited?: boolean
  onToggle?: jest.Mock
}) {
  const [expanded, setExpanded] = useState(startExpanded)
  const [selected, setSelected] = useState(false)
  return (
    <BrandMatchCard
      match={match}
      query={query}
      site={site}
      expanded={expanded}
      onExpandedChange={(open) => {
        onChange(open)
        setExpanded(open)
      }}
      selection={{
        selected,
        limited,
        onToggle: () => {
          onToggle()
          if (!limited) setSelected((v) => !v)
        },
      }}
    />
  )
}

function renderCard(match: BrandMatch, expanded = true) {
  const onChange = jest.fn()
  render(<Harness match={match} startExpanded={expanded} onChange={onChange} />)
  return onChange
}

const townMatch = { band: 'close' as const, bestTown: 'Bradford', townStores: 960, closeStores: 41, towns: 700, closeTowns: 6 }
const bua = (name: string, population: number, affluence: number) => ({ code: name, name, population, affluence })
const storeTowns = [
  { name: 'Aldi Bradford', town: 'Bradford', miles: 9, bua: bua('Bradford', 470_000, 98), band: 'close' as const, gap: 0.6 },
  { name: 'Aldi Harrogate', town: 'Harrogate', miles: 14, bua: bua('Harrogate', 75_000, 131), band: 'none' as const, gap: 5.4 },
  { name: 'Aldi A1 services', town: null, miles: 20, bua: null, band: null, gap: null },
]

describe('BrandMatchCard — report selection', () => {
  it('ticks the brand without expanding the row', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<Harness match={rich} startExpanded={false} onChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: /Add Aldi to the PDF report/ })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks the checkbox when the report is full', async () => {
    const user = userEvent.setup()
    const onToggle = jest.fn()
    render(<Harness match={rich} startExpanded={false} onChange={jest.fn()} limited onToggle={onToggle} />)
    const box = screen.getByRole('checkbox', { name: /Add Aldi/ })
    expect(box).toHaveAttribute('aria-disabled', 'true')
    expect(box).toHaveAttribute('title', 'Reports hold up to 20 brands')
    await user.click(box)
    expect(onToggle).toHaveBeenCalled()
    expect(box).toHaveAttribute('aria-checked', 'false')
  })
})

describe('BrandMatchCard — collapsed row', () => {
  it('shows a status glyph and value per signal, the fit score and the contact count', () => {
    renderCard({ ...rich, nearest: { miles: 0.6, storeName: null, town: null } }, false)
    expect(screen.getAllByRole('img', { name: 'Good' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'Concern' })).toBeInTheDocument()
    expect(screen.getByText('0.6 mi')).toBeInTheDocument()
    // No demographic read: a dash and "No data", never a guess.
    expect(screen.getByRole('img', { name: 'No data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 contacts' })).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('opens on the contacts list from the contacts button', async () => {
    const onChange = renderCard(rich, false)
    await userEvent.click(screen.getByRole('button', { name: '3 contacts' }))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByText('Covers your region')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Email all three' })).toHaveAttribute(
      'href',
      expect.stringContaining('r.hale@aldi.co.uk,d.marsh@aldi.co.uk,property@aldi.co.uk')
    )
  })
})

describe('BrandMatchCard — expanded card', () => {
  it('shows the score over the signals held and opens on the first signal worth a look', () => {
    renderCard(rich)
    // 98 of 120 points: demographics is missing, so it is left out; no turnover scores 0 of 15;
    // a news score of +4 earns 18 of 20.
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('+4 ›')).toBeInTheDocument()
    expect(screen.getByText('Based on 4 of 5 signals')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Demographics/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('No stores in towns we hold')).toBeInTheDocument()
  })

  it('swaps the panel when a breakdown row is picked', async () => {
    renderCard(rich)
    await userEvent.click(screen.getByRole('button', { name: /Acquisitive/ }))
    expect(screen.getByText('Acquisitive: high')).toBeInTheDocument()
    expect(screen.getByText('8k–20k sq ft, Class E, Leeds, Bradford')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Aldi confirms 40 new UK stores this year/ })).toHaveAttribute('href', 'https://example.com/aldi')

    await userEvent.click(screen.getByRole('button', { name: /Size fit/ }))
    expect(screen.getByText('Size fit: fits')).toBeInTheDocument()
    expect(screen.getByText(/inside the size range of Aldi's existing stores and its live requirement/)).toBeInTheDocument()
    expect(screen.getByText('Live requirement 10k–18k')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Nearest store/ }))
    expect(screen.getByText('Nearest store: 3.1 mi')).toBeInTheDocument()
    expect(screen.getByText('Aldi Horsforth')).toBeInTheDocument()
    expect(screen.getByText(/also trades in 10 other retail parks within 30 miles/)).toBeInTheDocument()
  })

  it("lists the best-matching stores' towns, best first, and scores the close match", async () => {
    mockStoreTowns.mockResolvedValue({ stores: storeTowns.slice(0, 2), total: 960 })
    const match = withScore({ ...rich, townMatch })
    expect(match.scoreParts.find((p) => p.component === 'demographics')).toMatchObject({ points: 15 })
    renderCard(match)
    await userEvent.click(screen.getByRole('button', { name: /Demographics/ }))
    expect(screen.getByText('Demographics: close match')).toBeInTheDocument()
    expect(screen.getByText(/41 stores of Aldi's 960 are in 6 towns like Leeds, the closest being Bradford\./)).toBeInTheDocument()
    expect(mockStoreTowns).toHaveBeenCalledWith('aldi', site, expect.anything())
    expect(await screen.findByText('Aldi Bradford')).toBeInTheDocument()
    expect(screen.getByText('BEST 2 OF 960 STORES')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
    expect(screen.getByText('Not close')).toBeInTheDocument()
    expect(screen.getByText('470k')).toBeInTheDocument()
  })

  it('never renders financial figures without Companies House facts', async () => {
    renderCard(rich)
    await userEvent.click(screen.getByRole('button', { name: /Financials/ }))
    expect(screen.getByText('No Companies House match')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Search Companies House/ })).toBeInTheDocument()
  })
})

describe('BrandMatchCard — sparse brand', () => {
  it('leaves missing signals out of the score and says so', async () => {
    renderCard(sparse)
    expect(screen.getByText('Based on 2 of 5 signals')).toBeInTheDocument()
    // Opens on the first signal that isn't good: no use class stated.
    expect(screen.getByText('Use class not confirmed')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Acquisitive/ }))
    expect(screen.getByText('Acquisitive: no evidence')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'rob@sitematcher.co.uk' })).toBeInTheDocument()
  })

  it('offers Request a contact when we hold no contact', async () => {
    renderCard(sparse)
    expect(screen.getByText('No named contact')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a contact' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:rob@sitematcher.co.uk')
    )
  })
})

describe('BrandMatchCard — Companies House facts (when present)', () => {
  const facts = {
    companyNumber: '02321869',
    companyName: 'ALDI STORES LIMITED',
    status: 'Active',
    accountsType: 'Group accounts',
    accountsMadeUpTo: '2024-12-31',
    accountsOverdue: false,
    registeredOffice: 'Holly Lane, Atherstone, Warwickshire, CV9 2SQ',
    turnover: { status: 'unread' as const },
    netAssets: { status: 'unread' as const },
    fetchedAt: '2026-09-18T00:00:00.000Z',
  }

  async function openFinancials(match: BrandMatch) {
    renderCard(match)
    await userEvent.click(screen.getByRole('button', { name: /Financials/ }))
  }

  it('shows register facts without implying figures were not filed', async () => {
    await openFinancials({ ...rich, tradingFacts: facts })
    expect(screen.getByText('ALDI STORES LIMITED, active', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('On time')).toBeInTheDocument()
    expect(screen.getByText('31 Dec 2024')).toBeInTheDocument()
    // Unread figures: no row, and never "Not disclosed".
    expect(screen.queryByText('Latest turnover')).not.toBeInTheDocument()
    expect(screen.queryByText('Not disclosed')).not.toBeInTheDocument()
    expect(
      screen.getByText(/Published turnover counts towards the match score/)
    ).toBeInTheDocument()
  })

  it('shows filed turnover on the row and in the panel', async () => {
    const match = { ...rich, tradingFacts: { ...facts, turnover: { status: 'filed' as const, value: 17.9e9 }, netAssets: { status: 'filed' as const, value: 4.1e9 } } }
    await openFinancials(match)
    expect(screen.getByText('£17.9bn ›')).toBeInTheDocument()
    const panel = screen.getByText('Latest turnover').parentElement as HTMLElement
    expect(within(panel).getByText('£17.9bn')).toBeInTheDocument()
    expect(screen.queryByText(/scanned accounts/)).not.toBeInTheDocument()
  })

  it('says where figures read from scanned accounts came from', async () => {
    await openFinancials({
      ...rich,
      tradingFacts: {
        ...facts,
        turnover: { status: 'extracted', value: 8_986_000, page: 11 },
        netAssets: { status: 'extracted', value: -3_461_000, page: 12 },
      },
    })
    expect(screen.getByText(/Read automatically from scanned accounts \(PDF p\. 11, p\. 12\)/)).toBeInTheDocument()
  })

  it('uses the small-company note only when turnover is genuinely not published', async () => {
    await openFinancials({ ...sparse, tradingFacts: { ...facts, turnover: { status: 'not_published' } } })
    expect(screen.getAllByText('Not disclosed').length).toBeGreaterThan(0)
    expect(screen.getByText(/Small companies aren.t required to file turnover/)).toBeInTheDocument()
  })

  it('offers the registered office when there is no named contact', async () => {
    renderCard({ ...sparse, tradingFacts: facts })
    await userEvent.click(screen.getByRole('button', { name: /No named contact/ }))
    expect(screen.getByText(/we hold the registered office only: Holly Lane, Atherstone/)).toBeInTheDocument()
  })
})
