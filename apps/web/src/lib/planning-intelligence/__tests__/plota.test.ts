import { buildSearchSpecs, deepDiscoveryWindow, discoveryWindow, lateDiscoveryWindow, PlotaClient } from '../plota'

describe('PlotaClient', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('keeps the key in the bearer header and always opts out of contact data', async () => {
    const headers = new Map([
      ['x-ratelimit-limit-month', '500'],
      ['x-ratelimit-remaining-month', '496'],
    ])
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
      json: async () => ({ data: [], meta: { next_cursor: null } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await new PlotaClient('secret-demo-key').search({ nation: 'england' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('include_contact=false')
    expect(String(url)).not.toContain('secret-demo-key')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-demo-key')
    expect(result.usage.monthlyRemaining).toBe(496)
  })

  it('does not include secrets in upstream errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({ error: { message: 'Bad filter' } }),
    }) as unknown as typeof fetch
    await expect(new PlotaClient('secret-demo-key').search({ q: 'x' })).rejects.toThrow('Bad filter')
  })
})

describe('buildSearchSpecs', () => {
  it('gives council-scoped archive searches independent keys without live-only filters', () => {
    const specs = buildSearchSpecs({ scope: 'full', dateFrom: '2025-11-01', dateTo: '2025-11-30',
      pageSize: 50, councils: ['wandsworth', 'canterbury', 'canterbury'] })
    expect(specs).toEqual([
      { key: 'council:canterbury:all', params: { date_from: '2025-11-01', date_to: '2025-11-30', limit: '50', council: 'canterbury' } },
      { key: 'council:wandsworth:all', params: { date_from: '2025-11-01', date_to: '2025-11-30', limit: '50', council: 'wandsworth' } },
    ])
  })

  it('uses a single broad search per nation for a licensed full census', () => {
    const specs = buildSearchSpecs({
      scope: 'full', dateFrom: '2026-08-01', dateTo: '2026-08-31', pageSize: 50,
      nations: ['england'],
    })
    expect(specs).toHaveLength(1)
    expect(specs[0].params).toEqual(expect.objectContaining({ nation: 'england', limit: '50' }))
  })

  it('covers all commercial work, dwellings and brand-evidence routes in reduced mode', () => {
    const specs = buildSearchSpecs({
      scope: 'reduced', dateFrom: '2026-08-01', dateTo: '2026-08-31', pageSize: 50,
      nations: ['england'],
    })
    expect(specs.map((spec) => spec.key)).toEqual([
      'england:commercial', 'england:residential', 'england:brand-evidence-routes',
    ])
    expect(specs[0].params.commercial_work).toContain('loss')
    expect(specs[1].params.dmin).toBe('1')
    expect(specs[2].params.procedure).toContain('advert-consent')
  })
})

describe('discovery windows', () => {
  it('chains the latest week, the late lane and the deep lane without gaps', () => {
    const now = new Date('2027-03-01T07:00:00Z')
    expect(discoveryWindow(now)).toEqual({ dateFrom: '2027-02-22', dateTo: '2027-03-01' })
    expect(lateDiscoveryWindow(now)).toEqual({ dateFrom: '2026-11-01', dateTo: '2027-02-22' })
    expect(deepDiscoveryWindow(now)).toEqual({ dateFrom: '2026-03-01', dateTo: '2026-11-01' })
  })

  it('never takes a reduced lane before the live-only filter floor', () => {
    const now = new Date('2026-09-13T07:00:00Z')
    expect(lateDiscoveryWindow(now)).toEqual({ dateFrom: '2026-05-16', dateTo: '2026-09-06' })
    expect(deepDiscoveryWindow(now)).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-05-16' })
    expect(lateDiscoveryWindow(new Date('2026-02-10T12:00:00Z')))
      .toEqual({ dateFrom: '2026-01-01', dateTo: '2026-02-03' })
  })

  it('has no deep window while the whole year predates the floor', () => {
    expect(deepDiscoveryWindow(new Date('2026-03-01T12:00:00Z'))).toBeNull()
  })
})
