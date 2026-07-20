import { renderHook, waitFor } from '@testing-library/react'
import { usePlanningData } from '../usePlanningData'
import { fetchPlanningApplications } from '../../services/planning-service'
import type { PlanningApplication } from '../../../types/unified-workspace'

jest.mock('../../services/planning-service')

const fetchMock = fetchPlanningApplications as jest.MockedFunction<
  typeof fetchPlanningApplications
>

function app(name: string, lng: number, lat: number): PlanningApplication {
  return {
    name,
    uid: name,
    address: '1 High St',
    appSize: 'Large',
    appState: 'Undecided',
    appType: 'Full',
    description: '',
    url: '',
    lat,
    lng,
    decidedDate: null,
    dateValidated: null,
    nDwellings: null,
    applicantAddress: null,
    agentAddress: null,
  }
}

// Unit square boundary (lng/lat 0..1).
const boundary: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('usePlanningData', () => {
  it('does nothing while disabled', () => {
    const { result } = renderHook(() => usePlanningData(boundary, false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.applications).toEqual([])
  })

  it('reports loading while enabled with no boundary yet (BUA polygon resolving)', () => {
    const { result } = renderHook(() => usePlanningData(null, true))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it('keeps inside points, filters outside ones, and propagates truncated', async () => {
    fetchMock.mockResolvedValue({
      applications: [app('IN/1', 0.5, 0.5), app('OUT/1', 5, 5)],
      truncated: true,
    })
    const { result } = renderHook(() => usePlanningData(boundary, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.applications.map((a) => a.name)).toEqual(['IN/1'])
    expect(result.current.truncated).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('surfaces fetch errors', async () => {
    fetchMock.mockRejectedValue(new Error('planning failed (503)'))
    const { result } = renderHook(() => usePlanningData(boundary, true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('planning failed (503)')
    expect(result.current.applications).toEqual([])
  })

  it('clears results when the tab is disabled again', async () => {
    fetchMock.mockResolvedValue({
      applications: [app('IN/1', 0.5, 0.5)],
      truncated: false,
    })
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => usePlanningData(boundary, enabled),
      { initialProps: { enabled: true } }
    )
    await waitFor(() => expect(result.current.applications).toHaveLength(1))
    rerender({ enabled: false })
    expect(result.current.applications).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})
