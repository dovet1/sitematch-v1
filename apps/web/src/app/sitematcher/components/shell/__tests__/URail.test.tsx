import { act, fireEvent, render, screen } from '@testing-library/react'
import { URail, HOVER_CARD_DELAY_MS } from '../URail'
import { useWorkspaceStore } from '../../../lib/stores/unified-workspace-store'
import { PlanningMonitorFlagProvider } from '../../../lib/planning-monitor-flag-context'
import { BrandMatcherFlagProvider } from '../../../lib/brand-matcher-flag-context'

function renderRail() {
  return render(
    <PlanningMonitorFlagProvider enabled>
      <BrandMatcherFlagProvider enabled>
        <URail />
      </BrandMatcherFlagProvider>
    </PlanningMonitorFlagProvider>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  useWorkspaceStore.setState({ view: 'assess', chooserOpen: false })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('URail', () => {
  it('labels every mode under its icon and marks the active one', () => {
    renderRail()
    for (const label of ['Assess', 'Gaps', 'Sketch', 'Planning', 'Match', 'Directory']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Assess area' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the hover card only after the delay, and hides it on leaving the rail', () => {
    renderRail()
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Find gaps' }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    act(() => jest.advanceTimersByTime(HOVER_CARD_DELAY_MS))
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Quickly identify towns or retail centres where brands exist, or don’t.'
    )

    fireEvent.mouseLeave(screen.getByRole('navigation', { name: 'Modes' }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows the card on keyboard focus', () => {
    renderRail()
    act(() => screen.getByRole('button', { name: 'Directory' }).focus())
    expect(screen.getByRole('tooltip')).toHaveTextContent('Directory')
  })

  it('does not show the card while the chooser is open', () => {
    useWorkspaceStore.setState({ chooserOpen: true })
    renderRail()
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Find gaps' }))
    act(() => jest.advanceTimersByTime(HOVER_CARD_DELAY_MS))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens the chooser from the "?" button and switches mode on click', () => {
    renderRail()
    fireEvent.click(screen.getByRole('button', { name: 'Choose a mode' }))
    expect(useWorkspaceStore.getState().chooserOpen).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Brand matcher' }))
    expect(useWorkspaceStore.getState().view).toBe('brand-matcher')
  })
})
