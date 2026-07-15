import { act, renderHook, waitFor } from '@testing-library/react'
import { useDemographicsData } from '../useDemographicsData'

describe('useDemographicsData', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/demographics/bua-boundaries') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            lsoa_codes: ['E01000001', 'E01000002'],
            boundary_geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          }),
        } as Response)
      }

      if (url === '/api/demographics/data') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            by_lsoa: {
              E01000001: { population: 100 },
              E01000002: { population: 200 },
            },
            national_averages: { population: 150 },
          }),
        } as Response)
      }

      if (url === '/api/demographics/tooltip-data') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tooltip_data: {
              E01000001: { lsoa_name: 'One' },
              E01000002: { lsoa_name: 'Two' },
            },
          }),
        } as Response)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }) as jest.Mock
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('loads BUA boundaries, demographics, national averages, and tooltips', async () => {
    const { result } = renderHook(() => useDemographicsData())

    let response: Awaited<ReturnType<typeof result.current.analyzeBua>>
    await act(async () => {
      response = await result.current.analyzeBua('E34000001')
    })

    expect(response!.success).toBe(true)
    expect(response!.lsoaCodes).toEqual(['E01000001', 'E01000002'])

    await waitFor(() => {
      expect(result.current.rawDemographicsData).toEqual({
        E01000001: { population: 100 },
        E01000002: { population: 200 },
      })
    })

    expect(result.current.nationalAverages).toEqual({ population: 150 })
    expect(result.current.lsoaTooltipData).toEqual({
      E01000001: { lsoa_name: 'One' },
      E01000002: { lsoa_name: 'Two' },
    })
    expect(result.current.isochroneGeometry).toEqual({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    })

    const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => String(url))
    expect(urls).toContain('/api/demographics/bua-boundaries')
    expect(urls).toContain('/api/demographics/data')
    expect(urls).toContain('/api/demographics/tooltip-data')
    expect(urls).not.toContain('/api/demographics/boundaries')
  })
})
