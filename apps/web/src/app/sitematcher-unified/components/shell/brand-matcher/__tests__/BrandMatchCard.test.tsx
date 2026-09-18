import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrandMatchCard } from '../BrandMatchCard'
import { scoreMatch } from '../../../../lib/brand-matcher'
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
}

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
  size: { state: 'fits', basis: 'requirement', rangeMin: 8000, rangeMax: 20000 },
  useClass: { codes: ['E'], matches: true },
  acquisitive: {
    level: 'high',
    requirements: {
      count: 12, sizeMin: 8000, sizeMax: 20000, useClasses: ['E'], nationwide: false,
      nearbyPlaces: ['Leeds'], otherPlaces: [], otherPlaceCount: 0,
    },
    news: null,
    planning: { count: 5 },
  },
  tradingFacts: null,
  locationType: { form: 'retail_park', count: 10, names: ['Owlcotes', 'Crown Point', 'Kirkstall Bridge'], nearestMiles: 3 },
  nearest: { miles: 3.1, storeName: 'Aldi Kirkstall', town: 'Leeds' },
  typicalRange: null,
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

function renderCard(match: BrandMatch, expanded = true, onExpandedChange = jest.fn()) {
  render(
    <BrandMatchCard
      match={match}
      rank={1}
      query={query}
      site={site}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
    />
  )
  return onExpandedChange
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn()
})

describe('BrandMatchCard — rich brand', () => {
  it('shows the pills, the location band, the evidence and a region contact', () => {
    renderCard(rich)
    expect(screen.getByText('Size fit')).toBeInTheDocument()
    expect(screen.getByText('Acquisitive')).toBeInTheDocument()
    expect(screen.getByText('Trades in 10')).toBeInTheDocument()
    expect(screen.getByText('Already trades in your type of location.')).toBeInTheDocument()
    expect(screen.getByText(/Owlcotes, Crown Point and Kirkstall Bridge/)).toBeInTheDocument()
    expect(screen.getByText('12 open requirements')).toBeInTheDocument()
    expect(screen.getByText(/within reach of your site/)).toBeInTheDocument()
    expect(screen.getByText('Covers your region')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact Rebecca Hale' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:r.hale@aldi.co.uk')
    )
    expect(screen.getByRole('link', { name: 'Or email all three at once' })).toHaveAttribute(
      'href',
      expect.stringContaining('r.hale@aldi.co.uk,d.marsh@aldi.co.uk,property@aldi.co.uk')
    )
    expect(screen.getByRole('img', { name: 'Match score 95%' })).toBeInTheDocument()
  })

  it('never renders a Companies House column or turnover pill without facts', () => {
    renderCard(rich)
    expect(screen.queryByText(/Companies House/)).not.toBeInTheDocument()
    expect(screen.queryByText('Turnover')).not.toBeInTheDocument()
  })

  it('Contact on a collapsed card expands it', async () => {
    const onChange = renderCard(rich, false)
    await userEvent.click(screen.getByRole('button', { name: 'Contact' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('BrandMatchCard — sparse brand', () => {
  it('shows only what we can verify', () => {
    renderCard(sparse)
    expect(screen.queryByText('Acquisitive')).not.toBeInTheDocument()
    expect(screen.queryByText('The evidence')).not.toBeInTheDocument()
    expect(screen.getByText('Matched on size and location.')).toBeInTheDocument()
    expect(
      screen.getByText(/typical unit is 12,000–16,000 sq ft, and they already trade in one retail park — Owlcotes, 42 miles away\./)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/We could not find any evidence that Fettle Home is acquiring at the moment/)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'rob@sitematcher.co.uk' })).toBeInTheDocument()
    expect(screen.getByText('What we verified')).toBeInTheDocument()
  })

  it('uses the empty contact treatment with a Request a contact action', () => {
    renderCard(sparse)
    expect(screen.getByText('No named acquisitions contact')).toBeInTheDocument()
    expect(screen.getByText('none on file')).toBeInTheDocument()
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

  it('shows register facts without implying figures were not filed', () => {
    renderCard({ ...rich, tradingFacts: facts })
    expect(screen.getByText('Companies House — published facts')).toBeInTheDocument()
    expect(screen.getByText('ALDI STORES LIMITED · 02321869')).toBeInTheDocument()
    expect(screen.getByText('Filed on time')).toBeInTheDocument()
    expect(screen.getByText('31 Dec 2024')).toBeInTheDocument()
    // Unread figures: no row, no pill, and never "Not disclosed".
    expect(screen.queryByText('Latest turnover')).not.toBeInTheDocument()
    expect(screen.queryByText('Turnover')).not.toBeInTheDocument()
    expect(screen.queryByText('Not disclosed')).not.toBeInTheDocument()
    expect(
      screen.getByText(/SiteMatcher does not rate, score or comment on a company.s financial standing — including covenant strength/)
    ).toBeInTheDocument()
  })

  it('shows filed figures neutrally', () => {
    renderCard({
      ...rich,
      tradingFacts: { ...facts, turnover: { status: 'filed', value: 17.9e9 }, netAssets: { status: 'filed', value: 4.1e9 } },
    })
    const pill = screen.getByText('Turnover').parentElement as HTMLElement
    expect(within(pill).getByText('£17.9bn')).toBeInTheDocument()
    expect(pill.className).toContain('bg-[#F5F6FA]')
    expect(screen.getByText('Companies House — trading facts')).toBeInTheDocument()
  })

  it('uses the small-company note only when turnover is genuinely not published', () => {
    renderCard({ ...sparse, tradingFacts: { ...facts, turnover: { status: 'not_published' } } })
    expect(screen.getAllByText('Not disclosed').length).toBeGreaterThan(0)
    expect(screen.getByText(/Small companies aren.t required to file turnover/)).toBeInTheDocument()
  })

  it('offers the registered office when there is no named contact', () => {
    renderCard({ ...sparse, tradingFacts: facts })
    expect(screen.getByText(/we hold the registered office only/)).toBeInTheDocument()
    expect(screen.getByText('Holly Lane, Atherstone, Warwickshire, CV9 2SQ')).toBeInTheDocument()
  })
})
