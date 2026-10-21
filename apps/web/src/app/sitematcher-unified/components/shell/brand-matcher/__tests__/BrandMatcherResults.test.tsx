import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrandMatcherResults } from '../BrandMatcherResults'
import { useBrandMatcherStore } from '../../../../lib/stores/brand-matcher-store'
import type { BrandMatch, BrandMatcherResponse } from '../../../../types/brand-matcher'

jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', user_metadata: { full_name: 'Dan Morgan' } },
    profile: { user_company_name: 'Morgan Property Advisors' },
  }),
}))

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
  act(() => useBrandMatcherStore.setState({ result, sectors: [], sort: 'name', expandedId: null, selectedIds: [] }))
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

describe('report selection', () => {
  it('asks for a tick before opening the report dialog', async () => {
    const user = userEvent.setup()
    render(<BrandMatcherResults />)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('menuitem', { name: /PDF report/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Tick up to 20 brands, then create your report.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the selection bar, selects the top brands and lists them by fit in the dialog', async () => {
    const user = userEvent.setup()
    act(() =>
      useBrandMatcherStore.setState({
        result: { ...result, matches: result.matches.map((m, i) => ({ ...m, score: 60 + i * 10 })) },
      })
    )
    render(<BrandMatcherResults />)
    await user.click(screen.getByRole('checkbox', { name: /Add Boots/ }))
    expect(screen.getByRole('region', { name: 'Selected brands' })).toHaveTextContent('1 of 20 selected')

    await user.click(screen.getByRole('button', { name: 'Select top 20' }))
    expect(screen.getByRole('region', { name: 'Selected brands' })).toHaveTextContent('4 of 20 selected')

    await user.click(screen.getByRole('button', { name: /Create PDF report/ }))
    const dialog = screen.getByRole('dialog', { name: 'Create a brand report' })
    expect(within(dialog).getByLabelText('Prepared by')).toHaveValue('Dan Morgan')
    expect(within(dialog).getByLabelText('Company')).toHaveValue('Morgan Property Advisors')
    expect(within(dialog).getByText('Brands in this report · 4')).toBeInTheDocument()
    const names = within(dialog)
      .getAllByRole('button', { name: /^Remove / })
      .map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Remove Dunelm', 'Remove Co-op', 'Remove Boots', 'Remove Aldi'])

    await user.click(within(dialog).getByRole('button', { name: 'Remove Dunelm' }))
    expect(within(dialog).getByText('Brands in this report · 3')).toBeInTheDocument()
    expect(useBrandMatcherStore.getState().selectedIds).not.toContain('d')
  })

  it('stops at 20 and says why', async () => {
    const user = userEvent.setup()
    const ids = Array.from({ length: 20 }, (_, i) => `x${i}`)
    act(() => useBrandMatcherStore.setState({ selectedIds: ids }))
    render(<BrandMatcherResults />)
    expect(screen.queryByRole('button', { name: 'Select top 20' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Add Aldi/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Reports hold up to 20 brands. Remove one to add another.')
    expect(useBrandMatcherStore.getState().selectedIds).toHaveLength(20)
  })
})
