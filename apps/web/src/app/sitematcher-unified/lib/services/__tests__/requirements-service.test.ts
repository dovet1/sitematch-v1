import { fetchRequirementLocations } from '../requirements-service'

function feature(props: Record<string, unknown>) {
  return {
    geometry: { coordinates: [-0.12, 51.5] },
    properties: {
      id: 'req-1',
      location_id: 'loc-1',
      company_name: 'Acme',
      title: null,
      listing_type: null,
      site_size_min: null,
      site_size_max: null,
      site_acreage_min: null,
      site_acreage_max: null,
      dwelling_count_min: null,
      dwelling_count_max: null,
      place_name: null,
      formatted_address: null,
      brand_id: null,
      ...props,
    },
  }
}

describe('fetchRequirementLocations', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function mockFetchWith(features: unknown[]) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ geojson: { features } }),
    }) as unknown as typeof fetch
  }

  it('maps company_domain and uploaded_logo_url onto the location', async () => {
    mockFetchWith([
      feature({
        company_domain: 'acme.com',
        uploaded_logo_url: 'https://cdn/acme.png',
        // Resolved logo_url must be ignored by the card mapping.
        logo_url: 'https://img.logo.dev/acme.com?token=x',
      }),
    ])

    const [loc] = await fetchRequirementLocations()
    expect(loc.companyDomain).toBe('acme.com')
    expect(loc.logoUrl).toBe('https://cdn/acme.png')
    // The resolved logo_url is not read for the uploaded-only field.
    expect(loc.logoUrl).not.toContain('logo.dev')
  })

  it('defaults logo fields to null when absent', async () => {
    mockFetchWith([feature({})])
    const [loc] = await fetchRequirementLocations()
    expect(loc.companyDomain).toBeNull()
    expect(loc.logoUrl).toBeNull()
  })
})
