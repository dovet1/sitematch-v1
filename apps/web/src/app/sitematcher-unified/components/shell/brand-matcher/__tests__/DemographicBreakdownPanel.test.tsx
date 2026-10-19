import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { BrandMatchCard } from '../BrandMatchCard'
import { scoreMatch } from '../../../../lib/brand-matcher'
import type { DemographicMatch } from '../../../../lib/brand-matcher-demographics'
import type { BrandMatch, BrandMatcherQuery, BrandMatcherSite } from '../../../../types/brand-matcher'

const query: BrandMatcherQuery = { sqft: 2000, useClass: 'E', postcode: 'GU1 3UW' }
const site: BrandMatcherSite = {
  postcode: 'GU1 3UW',
  lat: 51.236,
  lon: -0.571,
  centre: null,
  region: 'South East',
  country: 'England',
}

const demographic: DemographicMatch = {
  band: 'partial',
  basis: 'fascia',
  townName: 'Guildford',
  reasons: [
    { signalName: 'affluence_high', direction: 'higher', sitePosition: 'typical' },
    { signalName: 'car_dependency_walkable', direction: 'lower', sitePosition: 'above' },
  ],
  size: { position: 'typical', sitePopulation: 77_000, typicalMin: 40_000, typicalMax: 140_000 },
  breakdown: {
    score: 0.6,
    townCount: 34,
    backtestAuc: 0.71,
    signals: [
      { signalName: 'affluence_high', direction: 'higher', position: 'typical', siteRank: 0.88, median: 0.81, typical: [0.7, 0.92], range: [0.55, 0.97], fit: 1, weight: 0.6 },
      { signalName: 'car_dependency_walkable', direction: 'lower', position: 'above', siteRank: 0.9, median: 0.25, typical: [0.15, 0.35], range: [0.05, 0.45], fit: 0, weight: 0.4 },
    ],
  },
}

function brand(over: Partial<BrandMatch> = {}): BrandMatch {
  const m = {
    brandId: 'gails',
    name: "Gail's",
    logoUrl: null,
    domain: null,
    category: 'Bakery',
    storeCount: 160,
    size: { state: 'fits' as const, basis: 'requirement' as const, rangeMin: 1500, rangeMax: 2500 },
    useClass: { codes: ['E'], matches: true },
    acquisitive: null,
    tradingFacts: null,
    locationType: null,
    nearest: null,
    typicalRange: null,
    contacts: { primary: null, coversRegion: false, others: [], total: 0 },
    demographic,
    ...over,
  } as Omit<BrandMatch, 'score' | 'scoreParts'>
  const { score, parts } = scoreMatch(m)
  return { ...m, score, scoreParts: parts } as BrandMatch
}

function Card({ match }: { match: BrandMatch }) {
  const [expanded, setExpanded] = useState(false)
  return <BrandMatchCard match={match} rank={1} query={query} site={site} expanded={expanded} onExpandedChange={setExpanded} />
}

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn()
})

it('opens the card at the breakdown when the Demographics pill is clicked', async () => {
  render(<Card match={brand()} />)
  expect(screen.queryByRole('region', { name: 'Why this demographic fit' })).toBeNull()

  await userEvent.click(screen.getByRole('button', { name: /Demographics: Partial fit\. Why this fit\?/ }))
  const panel = screen.getByRole('region', { name: 'Why this demographic fit' })
  expect(within(panel).getByText('Partial fit')).toBeInTheDocument()
  expect(within(panel).getByText(/Guildford looks partly like the kind of town Gail's opens in\. It scores 60 out of 100/)).toBeInTheDocument()
  expect(within(panel).getByText('Why these 2 measures')).toBeInTheDocument()
  expect(within(panel).getByText('Why it matters')).toBeInTheDocument()
  expect(within(panel).getByText('Affluence')).toBeInTheDocument()
  expect(within(panel).getByText('Walkability')).toBeInTheDocument()
  expect(within(panel).getByText(/Guildford: more affluent than 88 in 100 towns its size\. Their typical town: more affluent than 81 in 100\./)).toBeInTheDocument()
  expect(within(panel).getByText('Does not match: more walkable than 9 in 10 of their towns.')).toBeInTheDocument()
  expect(within(panel).getByText(/picked the real one 71% of the time/)).toBeInTheDocument()

  // Clicking the pill again keeps the card open rather than collapsing it.
  await userEvent.click(screen.getByRole('button', { name: /Demographics: Partial fit/ }))
  expect(screen.getByRole('region', { name: 'Why this demographic fit' })).toBeInTheDocument()
})

it('has no breakdown or clickable pill without a demographic fit', async () => {
  render(<Card match={brand({ demographic: null })} />)
  expect(screen.queryByRole('button', { name: /Demographics/ })).toBeNull()
})
