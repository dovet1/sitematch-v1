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

describe('GapFinder page viewport gate', () => {
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    })
  })

  it('shows the unavailable message on mobile widths', async () => {
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

  it('mounts GapFinder on tablet widths', async () => {
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
