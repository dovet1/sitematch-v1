import { renderHook, waitFor } from '@testing-library/react'
import { usePointComparison } from '../usePointComparison'
import { fetchNearbyStores, fetchMissingFascias } from '../../services/gaps-service'
import type {
  ComparePair,
  ReferenceData,
} from '../../../types/unified-workspace'

jest.mock('../../services/gaps-service')
jest.mock('../../brand-landscape', () => ({
  buildBrandLandscape: () => ({ present: [], missing: [] }),
}))
jest.mock('../../isochrone-missing', () => ({
  computeIsochroneMissing: () => [],
}))
jest.mock('../../point-comparison', () => ({
  computeBrandDiff: () => ({
    onlyA: [],
    onlyB: [],
    missingBoth: [],
    bothCount: 0,
  }),
  computeStatDeltas: () => [],
}))

const mockFetchNearbyStores = fetchNearbyStores as jest.Mock
const mockFetchMissingFascias = fetchMissingFascias as jest.Mock

const refData = {} as ReferenceData

const pair: ComparePair = {
  a: { lat: 51.5, lng: -0.12, catchment: { mode: 'distance', value: 5 } },
  b: { lat: 52.2, lng: -1.0, catchment: { mode: 'drive', value: 10 } },
}

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as Response
}

let boundariesBodies: any[]

beforeEach(() => {
  jest.clearAllMocks()
  boundariesBodies = []
  mockFetchNearbyStores.mockResolvedValue([])
  mockFetchMissingFascias.mockResolvedValue([])

  global.fetch = jest.fn(async (url: any, init: any) => {
    const u = String(url)
    if (u.includes('/api/demographics/boundaries')) {
      boundariesBodies.push(JSON.parse(init.body))
      return jsonResponse({
        lsoa_codes: ['E01'],
        // A drive/walk arm draws this isochrone; a distance arm ignores it and
        // draws a client circle instead.
        isochrone_geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-1.01, 52.19],
              [-0.99, 52.19],
              [-0.99, 52.21],
              [-1.01, 52.21],
              [-1.01, 52.19],
            ],
          ],
        },
      })
    }
    if (u.includes('/api/demographics/data')) {
      return jsonResponse({
        by_lsoa: {
          aggregated: {
            population_total: 100,
            households_total: 40,
            affluence: { avg_raw_score: 50 },
          },
        },
      })
    }
    throw new Error(`unexpected fetch: ${u}`)
  }) as jest.Mock
})

describe('usePointComparison', () => {
  it('resolves each pin with its own catchment', async () => {
    const { result } = renderHook(() => usePointComparison(pair, refData))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Each arm hits the boundaries route with its own catchment.
    const modes = boundariesBodies.map((b) => b.measurement_mode).sort()
    expect(modes).toEqual(['distance', 'drive_time'])

    const distanceBody = boundariesBodies.find(
      (b) => b.measurement_mode === 'distance'
    )
    const driveBody = boundariesBodies.find(
      (b) => b.measurement_mode === 'drive_time'
    )
    // Distance value is km→miles converted; drive minutes pass through unchanged.
    expect(distanceBody.radius_miles).toBeCloseTo(5 * 0.621371, 3)
    expect(driveBody.radius_miles).toBe(10)
  })

  it('publishes per-pin boundary outlines (distance → circle)', async () => {
    const { result } = renderHook(() => usePointComparison(pair, refData))
    await waitFor(() => {
      expect(result.current.boundaries.a).not.toBeNull()
      expect(result.current.boundaries.b).not.toBeNull()
    })
    expect(result.current.boundaries.a!.type).toBe('Polygon')
  })

  it('still publishes the boundary when a later store fetch fails', async () => {
    mockFetchNearbyStores.mockRejectedValue(new Error('stores down'))
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => usePointComparison(pair, refData))

    // The boundary resolves from the boundaries route before the store fetch runs,
    // so it appears even though the comparison ends in error.
    await waitFor(() => expect(result.current.boundaries.a).not.toBeNull())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    errSpy.mockRestore()
  })

  it('resets boundaries when the pair becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ p }: { p: ComparePair | null }) => usePointComparison(p, refData),
      { initialProps: { p: pair as ComparePair | null } }
    )
    await waitFor(() => expect(result.current.boundaries.a).not.toBeNull())

    rerender({ p: null })
    await waitFor(() => {
      expect(result.current.boundaries.a).toBeNull()
      expect(result.current.boundaries.b).toBeNull()
    })
  })
})
