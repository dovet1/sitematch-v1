import { fetchPlanNexusApplications, mapPlanNexusApplication } from '../plannexus'

describe('PlanNexus adapter', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('maps documented application fields and rejects records without coordinates', () => {
    expect(mapPlanNexusApplication({
      id: 'app-1', reference: 'ABC/123', address: '1 High Street', postcode: 'M1 1AA',
      description: 'New shopfront', status: 'validated', application_type: 'full',
      date_received: '2026-06-12', latitude: 53.48, longitude: -2.24,
      authority: { name: 'Manchester' }, source_url: 'https://example.test/app-1',
    })).toMatchObject({ id: 'app-1', reference: 'ABC/123', lat: 53.48, lng: -2.24 })
    expect(mapPlanNexusApplication({ id: 'app-2', reference: 'ABC/124', date_received: '2026-06-12' })).toBeNull()
  })

  it('queries each coarse postcode prefix for the exact month and deduplicates results', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'app-1', reference: 'ABC/123', date_received: '2026-06-12', lat: 53.48, lng: -2.24 }],
        meta: { page: 1, pages: 1 },
      }),
      headers: { get: () => null },
      status: 200,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await fetchPlanNexusApplications({
      apiKey: 'test-key', baseUrl: 'https://api.example.test/v1',
      postcodePrefixes: ['m1', 'M1', 'M2'],
      period: { start: '2026-06-01', end: '2026-07-01', label: 'June 2026' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('date_received_to=2026-06-30')
    expect(String(fetchMock.mock.calls[0][0])).toContain('postcode=M1')
    expect(result).toHaveLength(1)
  })

  it('follows the total_pages pagination field returned by the live API', async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) => ({
      id: `app-${index}`,
      reference: `REF/${index}`,
      date_received: '2026-06-12',
      lat: 53.48,
      lng: -2.24,
    }))
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: pageOne, meta: { page: 1, total_pages: 2 } }),
        headers: { get: () => null },
        status: 200,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'app-100', reference: 'REF/100', date_received: '2026-06-13', lat: 53.49, lng: -2.25 }],
          meta: { page: 2, total_pages: 2 },
        }),
        headers: { get: () => null },
        status: 200,
      } as unknown as Response)
    global.fetch = fetchMock

    const result = await fetchPlanNexusApplications({
      apiKey: 'test-key', baseUrl: 'https://api.example.test/v1',
      postcodePrefixes: ['M1'],
      period: { start: '2026-06-01', end: '2026-07-01', label: 'June 2026' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
    expect(result).toHaveLength(101)
  })

  it('refuses to make an unbounded national query', async () => {
    await expect(fetchPlanNexusApplications({
      apiKey: 'test-key', postcodePrefixes: [],
      period: { start: '2026-06-01', end: '2026-07-01', label: 'June 2026' },
    })).rejects.toThrow(/refusing a national query/)
  })
})
