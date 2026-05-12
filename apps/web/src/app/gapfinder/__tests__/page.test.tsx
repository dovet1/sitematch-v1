import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import GapFinderPage from '../page'

jest.mock('next/dynamic', () => {
  return () => {
    const MockGapFinderClient = () => <div>GapFinder tool mounted</div>
    MockGapFinderClient.displayName = 'MockGapFinderClient'
    return MockGapFinderClient
  }
})

jest.mock('next/link', () => {
  return ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
})

jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/hooks/useSubscriptionAccess', () => ({
  useSubscriptionAccess: jest.fn(),
}))

jest.mock('@/components/TrialSignupModal', () => ({
  TrialSignupModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/PaywallModal', () => ({
  PaywallModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const { useAuth } = require('@/contexts/auth-context')
const { useSubscriptionAccess } = require('@/hooks/useSubscriptionAccess')

describe('GapFinder page viewport gate', () => {
  const originalInnerWidth = window.innerWidth

  beforeEach(() => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    })
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: true,
      loading: false,
      error: null,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    })
  })

  it('shows the landing page for logged-out users', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    })
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: false,
      loading: false,
      error: null,
    })

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    })

    render(<GapFinderPage />)

    expect(await screen.findByText('Unlock GapFinder')).toBeInTheDocument()
    expect(screen.getAllByText('Start free trial')).toHaveLength(2)
    expect(screen.queryByText('GapFinder works best on a larger screen')).not.toBeInTheDocument()
    expect(screen.queryByText('GapFinder tool mounted')).not.toBeInTheDocument()
  })

  it('shows the landing page for logged-in users without access', async () => {
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: false,
      loading: false,
      error: null,
    })

    render(<GapFinderPage />)

    expect(await screen.findByText('Unlock GapFinder')).toBeInTheDocument()
    expect(screen.getByText('Find retail white space, compare locations and understand which operators are missing from the markets that matter. GapFinder helps you analyse built-up areas, neighbouring fascias and occupier requirements in one focused workflow.')).toBeInTheDocument()
    expect(screen.queryByText('GapFinder tool mounted')).not.toBeInTheDocument()
  })

  it('shows the unavailable message for subscribed users on mobile widths', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    })

    render(<GapFinderPage />)

    expect(
      await screen.findByText('GapFinder works best on a larger screen')
    ).toBeInTheDocument()
    expect(screen.getByText('Please try again on desktop or tablet.')).toBeInTheDocument()
    expect(screen.queryByText('GapFinder tool mounted')).not.toBeInTheDocument()
  })

  it('mounts GapFinder for subscribed users on tablet widths', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 768,
    })

    render(<GapFinderPage />)

    await waitFor(() => {
      expect(screen.getByText('GapFinder tool mounted')).toBeInTheDocument()
    })
    expect(
      screen.queryByText('GapFinder works best on a larger screen')
    ).not.toBeInTheDocument()
  })
})
