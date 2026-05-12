import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ResultsPanel } from '../ResultsPanel'

jest.mock('../MissingFasciasSection', () => ({
  MissingFasciasSection: () => <div data-testid="missing-fascias-section" />
}))

const renderResultsPanel = (props: Partial<ComponentProps<typeof ResultsPanel>> = {}) => {
  return render(
    <ResultsPanel
      results={[]}
      isLoading={false}
      selectedBUA={null}
      onItemClick={jest.fn()}
      {...props}
    />
  )
}

describe('ResultsPanel area indicator', () => {
  it('keeps Missing Brands outside the scrollable results list in Assess Area mode', () => {
    renderResultsPanel({
      mode: 'assess-area'
    })

    const scrollContainer = screen.getByTestId('results-scroll-container')
    const stickyFooter = screen.getByTestId('missing-fascias-sticky-footer')
    const missingFasciasSection = screen.getByTestId('missing-fascias-section')

    expect(stickyFooter).toContainElement(missingFasciasSection)
    expect(scrollContainer).not.toContainElement(missingFasciasSection)
  })

  it('does not show Missing Brands in Find Gaps mode', () => {
    renderResultsPanel({
      mode: 'find-gaps'
    })

    expect(screen.queryByTestId('missing-fascias-sticky-footer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('missing-fascias-section')).not.toBeInTheDocument()
  })

  it('shows Area A as the active source in Assess Area mode', () => {
    renderResultsPanel({
      mode: 'assess-area',
      activeAssessArea: 'area-a'
    })

    expect(screen.getByText('Showing Area A stores')).toBeInTheDocument()
    expect(screen.queryByText('Showing Area B stores')).not.toBeInTheDocument()
  })

  it('shows Area B as the active source in Assess Area mode', () => {
    renderResultsPanel({
      mode: 'assess-area',
      activeAssessArea: 'area-b'
    })

    expect(screen.getByText('Showing Area B stores')).toBeInTheDocument()
    expect(screen.queryByText('Showing Area A stores')).not.toBeInTheDocument()
  })

  it('does not show an area source in Find Gaps mode', () => {
    renderResultsPanel({
      mode: 'find-gaps',
      activeAssessArea: 'area-a'
    })

    expect(screen.queryByText('Showing Area A stores')).not.toBeInTheDocument()
    expect(screen.queryByText('Showing Area B stores')).not.toBeInTheDocument()
  })

  it('does not show an area source in single-area Assess Area mode', () => {
    renderResultsPanel({
      mode: 'assess-area',
      activeAssessArea: null
    })

    expect(screen.queryByText('Showing Area A stores')).not.toBeInTheDocument()
    expect(screen.queryByText('Showing Area B stores')).not.toBeInTheDocument()
  })
})

describe('ResultsPanel travel times', () => {
  const store = {
    id: 'store-1',
    name: 'Test Store',
    lat: 51.5,
    lon: -0.12,
    town: 'London',
    postcode: 'SW1A 1AA'
  }

  it('shows travel times stored with the Area A cache key', () => {
    renderResultsPanel({
      mode: 'assess-area',
      results: [store],
      selectedPoint: { lat: 51.51, lng: -0.13 },
      activeAssessArea: null,
      travelTimes: {
        'store-1:area-a': {
          walking: { duration: 900, distance: 1100 },
          driving: { duration: 300, distance: 1600 }
        }
      }
    })

    expect(screen.queryByRole('button', { name: 'Get Travel Times' })).not.toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
    expect(screen.getByText('5 min')).toBeInTheDocument()
  })

  it('shows loading state stored with the Area B cache key', () => {
    renderResultsPanel({
      mode: 'assess-area',
      results: [store],
      selectedPoint: { lat: 51.51, lng: -0.13 },
      activeAssessArea: 'area-b',
      travelTimeLoading: {
        'store-1:area-b': true
      },
      onGetTravelTime: jest.fn()
    })

    expect(screen.getByRole('button', { name: /Calculating/i })).toBeDisabled()
  })

  it('shows travel times stored with the Area B cache key', () => {
    renderResultsPanel({
      mode: 'assess-area',
      results: [store],
      selectedPoint: { lat: 51.51, lng: -0.13 },
      activeAssessArea: 'area-b',
      travelTimes: {
        'store-1:area-b': {
          walking: { duration: 1200, distance: 1400 },
          driving: { duration: 420, distance: 2100 }
        }
      }
    })

    expect(screen.queryByRole('button', { name: 'Get Travel Times' })).not.toBeInTheDocument()
    expect(screen.getByText('20 min')).toBeInTheDocument()
    expect(screen.getByText('7 min')).toBeInTheDocument()
  })
})
