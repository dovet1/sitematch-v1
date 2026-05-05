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
