import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrandMatcherResults } from '../BrandMatcherResults'
import { useBrandMatcherStore } from '../../../../lib/stores/brand-matcher-store'
import type { BrandMatch, BrandMatcherResponse } from '../../../../types/brand-matcher'

const match = (brandId: string, name: string, category: string | null): BrandMatch => ({
  brandId,
  name,
  logoUrl: null,
  domain: null,
  category,
  storeCount: 10,
  size: { state: 'fits', basis: 'estate', rangeMin: 1000, rangeMax: 3000 },
  useClass: null,
  acquisitive: null,
  tradingFacts: null,
  locationType: null,
  nearest: null,
  typicalRange: null,
  contacts: { primary: null, coversRegion: false, others: [], total: 0 },
  score: 50,
  scoreParts: [],
})

const result: BrandMatcherResponse = {
  site: { postcode: 'LS6 2AT', lat: 53.82, lon: -1.58, centre: null, region: null, country: 'England' },
  query: { sqft: 2000, useClass: 'E', postcode: 'LS6 2AT' },
  matches: [
    match('a', 'Aldi', 'Grocery'),
    match('b', 'Boots', 'Healthcare & beauty'),
    match('c', 'Co-op', 'Grocery'),
    match('d', 'Dunelm', null),
  ],
  considered: 4,
}

beforeEach(() => {
  act(() => useBrandMatcherStore.setState({ result, sectors: [], sort: 'name', expandedId: null }))
})

it('filters the list by the chosen sectors and can clear back to all', async () => {
  const user = userEvent.setup()
  render(<BrandMatcherResults />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 brands matched')

  await user.click(screen.getByRole('button', { name: /Sector: All sectors/ }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: /Grocery/ }))

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 of 4 brands matched')
  expect(screen.getByRole('button', { name: /Sector: Grocery/ })).toBeInTheDocument()
  expect(screen.getByText('Co-op')).toBeInTheDocument()
  expect(screen.queryByText('Boots')).not.toBeInTheDocument()

  await user.click(screen.getByRole('menuitemcheckbox', { name: /No sector listed/ }))
  expect(screen.getByText('Dunelm')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('3 of 4 brands matched')

  await user.click(screen.getByRole('button', { name: 'Show all sectors' }))
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 brands matched')
})

it('ignores a remembered sector the new results do not contain', () => {
  act(() => useBrandMatcherStore.setState({ sectors: ['Padel'] }))
  render(<BrandMatcherResults />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 brands matched')
})
