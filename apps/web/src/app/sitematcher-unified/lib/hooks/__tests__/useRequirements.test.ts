import { renderHook, waitFor } from '@testing-library/react'
import { useRequirements } from '../useRequirements'
import { fetchRequirementLocations } from '../../services/requirements-service'
import type { RequirementLocation } from '../../../types/unified-workspace'

jest.mock('../../services/requirements-service')

const mockFetch = fetchRequirementLocations as jest.MockedFunction<
  typeof fetchRequirementLocations
>

// Centre ~ central London.
const center = { lat: 51.5, lon: -0.12 }

function loc(
  id: string,
  listingId: string,
  companyName: string,
  lat: number,
  lng: number
): RequirementLocation {
  return {
    id,
    listingId,
    companyName,
    title: null,
    listingType: null,
    placeName: null,
    formattedAddress: null,
    coordinates: { lng, lat },
  }
}

// A: ~0.55km (listing L1), B: ~1.1km (same listing L1, farther),
// D: ~2.2km (listing L3), C: ~111km away (listing L2) — outside the catchment.
const A = loc('a', 'L1', 'BrandOne', 51.505, -0.12)
const B = loc('b', 'L1', 'BrandOne', 51.51, -0.12)
const D = loc('d', 'L3', 'BrandThree', 51.52, -0.12)
const C = loc('c', 'L2', 'FarBrand', 52.5, -0.12)

const FIXTURES = [A, B, D, C]

// A small polygon covering only D (excludes A/B, and the far-away C).
const isochroneAroundD: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-0.13, 51.515],
      [-0.11, 51.515],
      [-0.11, 51.525],
      [-0.13, 51.525],
      [-0.13, 51.515],
    ],
  ],
}

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(FIXTURES)
})

describe('useRequirements — distance mode (no isochrone)', () => {
  it('withinCatchment holds every in-radius location (non-deduped)', async () => {
    const { result } = renderHook(() => useRequirements(center, 5))
    await waitFor(() => expect(result.current.withinCatchment).toHaveLength(3))
    const ids = result.current.withinCatchment.map((r) => r.id).sort()
    expect(ids).toEqual(['a', 'b', 'd'])
  })

  it('local dedupes by listing (nearest per listing), nearest-first', async () => {
    const { result } = renderHook(() => useRequirements(center, 5))
    await waitFor(() => expect(result.current.local.length).toBeGreaterThan(0))
    // L1 collapses to its nearest pin (A, not B); L3 → D. C is out of radius.
    expect(result.current.local.map((r) => r.id)).toEqual(['a', 'd'])
  })
})

describe('useRequirements — drive/walk mode (isochrone supplied)', () => {
  it('reflects polygon membership, not the radius circle', async () => {
    const { result } = renderHook(() =>
      // Radius 50km would include A/B/D, but the polygon only covers D.
      useRequirements(center, 50, isochroneAroundD)
    )
    await waitFor(() => expect(result.current.withinCatchment).toHaveLength(1))
    expect(result.current.withinCatchment[0].id).toBe('d')
    expect(result.current.local.map((r) => r.id)).toEqual(['d'])
  })
})

describe('useRequirements — findByBrand stays UK-wide', () => {
  it('matches a company whose only location is outside the catchment', async () => {
    const { result } = renderHook(() => useRequirements(center, 5))
    await waitFor(() => expect(result.current.withinCatchment).toHaveLength(3))
    // FarBrand (C) is ~111km away — excluded from the catchment lists…
    expect(result.current.withinCatchment.some((r) => r.id === 'c')).toBe(false)
    // …but findByBrand still resolves it from the whole-UK set.
    expect(result.current.findByBrand('FarBrand')?.id).toBe('c')
  })
})
