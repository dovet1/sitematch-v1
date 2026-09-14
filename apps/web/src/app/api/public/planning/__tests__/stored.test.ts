const rpc = jest.fn()
jest.mock('@/lib/planning-intelligence/db', () => ({
  createPlanningAdminClient: () => ({ rpc }),
}))

import { fetchStoredPlanningApplications } from '../stored'
import type { Boundary } from '../boundary'

const BOUNDARY: Boundary = {
  type: 'Polygon',
  coordinates: [[[-0.5, 51.6], [-0.4, 51.6], [-0.4, 51.7], [-0.5, 51.7], [-0.5, 51.6]]],
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    sort_rank: 1,
    id: '11111111-1111-1111-1111-111111111111',
    provider_id: 'tdko9cpy',
    authority_name: 'Watford',
    reference: '26/00712/FULH',
    address: '32 Gade Avenue Watford',
    status: 'Undecided',
    stage: 'pending',
    planning_route: 'full',
    procedure: null,
    commercial_work: 'new',
    stated_floorspace_sqm: null,
    description: 'Erection of a new retail foodstore',
    links: { council: 'https://example.test/app' },
    longitude: -0.422497,
    latitude: 51.65759,
    location_provenance: 'source_centroid',
    location_uncertainty_m: 1500,
    inside_boundary: true,
    date_received: '2026-09-08',
    date_decided: null,
    date_validated: '2026-09-09',
    stated_dwelling_count: null,
    intelligence_tier: true,
    development_id: '22222222-2222-2222-2222-222222222222',
    relevance: 'high',
    summary: 'A new foodstore on the site of a former car showroom.',
    model_dwelling_count: 9,
    creates_commercial_space: 'yes',
    ...overrides,
  }
}

/**
 * The stored read chains `.order().range()` onto an rpc call and awaits it, so the stand-in
 * returns a chainable thenable and hands back one page per call.
 */
function pages(...results: Array<{ data: unknown[]; error: unknown }>) {
  let call = 0
  rpc.mockImplementation((fn: string) => {
    if (fn === 'planning_pipeline_status') {
      return Promise.resolve({ data: { coverage: {}, freshness: {} }, error: null })
    }
    const result = results[Math.min(call++, results.length - 1)]
    const builder = {
      order: () => builder,
      range: () => builder,
      then: (onfulfilled: (value: unknown) => unknown) =>
        Promise.resolve(result).then(onfulfilled),
    }
    return builder
  })
}

describe('fetchStoredPlanningApplications', () => {
  beforeEach(() => jest.clearAllMocks())

  it('asks the database to rank and cap, rather than doing either here', async () => {
    pages({ data: [row()], error: null })
    await fetchStoredPlanningApplications(BOUNDARY)
    expect(rpc).toHaveBeenCalledWith('planning_tab_applications_v3', {
      p_boundary: BOUNDARY,
      p_limit: 2001,
    })
  })

  it('carries the classification through to the tab', async () => {
    pages({ data: [row()], error: null })
    const result = await fetchStoredPlanningApplications(BOUNDARY)
    const [app] = result.applications
    expect(app.relevance).toBe('high')
    expect(app.summary).toBe('A new foodstore on the site of a former car showroom.')
    expect(app.modelDwellingCount).toBe(9)
    expect(app.createsCommercialSpace).toBe('yes')
  })

  it('carries how precisely each record is placed', async () => {
    pages({ data: [row({ inside_boundary: false })], error: null })
    const [app] = (await fetchStoredPlanningApplications(BOUNDARY)).applications
    expect(app.locationProvenance).toBe('source_centroid')
    expect(app.locationUncertaintyM).toBe(1500)
    expect(app.insideBoundary).toBe(false)
  })

  // The provider's figure and the model's are both evidence and must not be merged.
  it('keeps the source dwelling count separate from the model reading', async () => {
    pages({ data: [row({ stated_dwelling_count: 12 })], error: null })
    const [app] = (await fetchStoredPlanningApplications(BOUNDARY)).applications
    expect(app.nDwellings).toBe(12)
    expect(app.modelDwellingCount).toBe(9)
  })

  it('drops a record with no usable coordinate rather than plotting a null island', async () => {
    pages({ data: [row({ longitude: null, latitude: null })], error: null })
    const result = await fetchStoredPlanningApplications(BOUNDARY)
    expect(result.applications).toHaveLength(0)
  })

  it('reports truncation when the store holds more than the cap', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row({ sort_rank: i + 1 }))
    pages(
      { data: full, error: null },
      { data: full, error: null },
      { data: [row({ sort_rank: 2001 })], error: null }
    )
    const result = await fetchStoredPlanningApplications(BOUNDARY)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('record_cap')
    expect(result.applications).toHaveLength(2000)
  })

  // Freshness is a caption on the answer; losing it must not lose the answer.
  it('still returns applications when the freshness read fails', async () => {
    pages({ data: [row()], error: null })
    const original = rpc.getMockImplementation()!
    rpc.mockImplementation((fn: string, args: unknown) => {
      if (fn === 'planning_pipeline_status') {
        return Promise.resolve({ data: null, error: { message: 'boom' } })
      }
      return original(fn, args)
    })
    const result = await fetchStoredPlanningApplications(BOUNDARY)
    expect(result.applications).toHaveLength(1)
    expect(result.freshness?.staleReason).toBe('freshness_unavailable')
  })
})

it.each([0, null, 12])('gives a human correction precedence over the source, including %s', async (count) => {
 pages({data:[row({stated_dwelling_count:40,model_dwelling_count:count,model_dwelling_basis:'human_review'})],error:null})
 const [app]=(await fetchStoredPlanningApplications(BOUNDARY)).applications
 expect(app.nDwellings).toBe(count)
 expect(app.dwellingCountReviewed).toBe(true)
})
