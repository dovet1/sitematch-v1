import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UModeChooser } from '../UModeChooser'
import { useWorkspaceStore } from '../../../lib/stores/unified-workspace-store'
import { PlanningMonitorFlagProvider } from '../../../lib/planning-monitor-flag-context'
import { BrandMatcherFlagProvider } from '../../../lib/brand-matcher-flag-context'
import { DONT_SHOW_KEY } from '../../../lib/mode-nav'

const fetchMock = jest.fn(() => Promise.resolve({ ok: true }))

function renderChooser({ planning = true, brandMatcher = true } = {}) {
  return render(
    <PlanningMonitorFlagProvider enabled={planning}>
      <BrandMatcherFlagProvider enabled={brandMatcher}>
        <UModeChooser />
      </BrandMatcherFlagProvider>
    </PlanningMonitorFlagProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockClear()
  global.fetch = fetchMock as unknown as typeof fetch
  useWorkspaceStore.setState({ view: 'assess', chooserOpen: true })
})

describe('UModeChooser', () => {
  it('renders nothing while closed', () => {
    useWorkspaceStore.setState({ chooserOpen: false })
    renderChooser()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a labelled modal dialog with focus on the first card', () => {
    renderChooser()
    expect(screen.getByRole('dialog', { name: 'What do you want to do today?' })).toHaveAttribute(
      'aria-modal',
      'true'
    )
    expect(screen.getByRole('button', { name: /Match brands to a site/ })).toHaveFocus()
  })

  it('switches mode and closes when a card is picked', async () => {
    renderChooser()
    await userEvent.click(screen.getByRole('button', { name: /Look up a brand/ }))
    expect(useWorkspaceStore.getState().view).toBe('directory')
    expect(useWorkspaceStore.getState().chooserOpen).toBe(false)
  })

  it('keeps the current mode on Skip and on Escape', async () => {
    useWorkspaceStore.setState({ view: 'find' })
    renderChooser()
    await userEvent.click(screen.getByRole('button', { name: 'Skip, just show me the map' }))
    expect(useWorkspaceStore.getState()).toMatchObject({ view: 'find', chooserOpen: false })

    act(() => useWorkspaceStore.setState({ chooserOpen: true }))
    await userEvent.keyboard('{Escape}')
    expect(useWorkspaceStore.getState()).toMatchObject({ view: 'find', chooserOpen: false })
  })

  it('saves "Don\'t show this again" immediately without closing', async () => {
    renderChooser()
    await userEvent.click(screen.getByRole('checkbox', { name: /Don.t show this again/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(localStorage.getItem(DONT_SHOW_KEY)).toBe('1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/user/preferences',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ dont_show_mode_chooser: true }) })
    )
  })

  it('only offers flagged-on modes', () => {
    renderChooser({ planning: false, brandMatcher: false })
    expect(screen.queryByRole('button', { name: /Watch planning/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Match brands to a site/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Look up a brand/ })).toBeInTheDocument()
  })
})
