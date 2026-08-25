import { render, screen } from '@testing-library/react'
import { UBrandProfile } from '../UBrandProfile'
import type { DirectoryBrandProfile } from '../../../../types/unified-workspace'

// react-map-gl pulls in mapbox-gl, which needs WebGL. The estate map's own behaviour is
// not what these tests are about — only whether the profile asks it for a Targets layer.
jest.mock('react-map-gl/mapbox', () => ({
  Map: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Source: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

function profile(overrides: Partial<DirectoryBrandProfile> = {}): DirectoryBrandProfile {
  return {
    brand: {
      id: 'brand-1',
      name: 'Acme Coffee',
      logoUrl: null,
      domain: null,
      websiteUrl: null,
      storeLocatorUrl: null,
      category: 'Food & Beverage',
      storeCount: 42,
      latestStore: null,
      stores: [],
    },
    requirement: null,
    contacts: [],
    agents: [],
    activity: [],
    ...overrides,
  }
}

const REQUIREMENT: DirectoryBrandProfile['requirement'] = {
  id: 'req-1',
  sizeMin: 1200,
  sizeMax: 2500,
  sizeSeenSqft: 1800,
  sizeSeenBasis: 'Average of 12 recent openings',
  summary: 'Seeking high-street units in commuter towns.',
  listingType: 'leasehold',
  useClasses: ['E(b)'],
  verifiedAt: new Date().toISOString(),
  brochureUrl: 'https://example.com/brochure.pdf',
  targets: [{ id: 't-1', name: 'Reading', lat: 51.45, lon: -0.97 }],
  targetNames: ['Reading'],
}

describe('UBrandProfile', () => {
  // The point of the feature: a brand with nothing linked should not advertise the
  // absence — no panel, no negative status pill, no empty state, no Targets toggle.
  it('says nothing about requirements when none is linked', () => {
    render(<UBrandProfile data={profile()} onOpenAgent={jest.fn()} />)

    expect(screen.queryByText(/requirement/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/actively acquiring/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /targets/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /existing estate/i })).not.toBeInTheDocument()

    // The rest of the profile is untouched.
    expect(screen.getByText('Acme Coffee')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders the full requirement panel when one is linked', () => {
    render(<UBrandProfile data={profile({ requirement: REQUIREMENT })} onOpenAgent={jest.fn()} />)

    expect(screen.getByText('Expansion requirement')).toBeInTheDocument()
    expect(screen.getByText('Actively acquiring')).toBeInTheDocument()
    expect(screen.getByText('1,200 – 2,500')).toBeInTheDocument()
    expect(screen.getByText('View requirement brochure')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /targets/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /existing estate/i })).toBeInTheDocument()
  })
})
