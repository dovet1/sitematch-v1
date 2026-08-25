import { classifyPlanningApplications } from '../classify'
import type { PlanningAlertApplication, PlanningAlertBoundary, PlanningAlertStore } from '../types'

const patch: PlanningAlertBoundary = {
  type: 'Polygon',
  coordinates: [[[-0.2, 51.4], [0.2, 51.4], [0.2, 51.7], [-0.2, 51.7], [-0.2, 51.4]]],
}
const stores: PlanningAlertStore[] = [
  { id: 'store', name: 'Central', town: 'London', postcode: 'SW1', lat: 51.5, lng: 0 },
]

function application(id: string, lat: number, lng: number): PlanningAlertApplication {
  return {
    id, reference: id, address: id, postcode: null, description: id,
    status: 'Validated', applicationType: 'Full', authorityName: null,
    dateReceived: '2026-06-10', lat, lng, sourceUrl: null, nearestStore: null,
  }
}

describe('classifyPlanningApplications', () => {
  it('gives the store-radius bucket precedence over the patch bucket', () => {
    const result = classifyPlanningApplications([
      application('near', 51.51, 0),
      application('patch-only', 51.62, 0.12),
      application('outside', 52, 0),
    ], stores, patch, 5000)

    expect(result.nearStore.map((item) => item.id)).toEqual(['near'])
    expect(result.nearStore[0].nearestStore).toMatchObject({ id: 'store', name: 'Central' })
    expect(result.inPatch.map((item) => item.id)).toEqual(['patch-only'])
  })

  it('sorts both buckets newest first with a stable reference tie-break', () => {
    const older = { ...application('B', 51.51, 0), dateReceived: '2026-06-01' }
    const newerB = { ...application('B2', 51.51, 0), reference: 'B', dateReceived: '2026-06-20' }
    const newerA = { ...application('A2', 51.51, 0), reference: 'A', dateReceived: '2026-06-20' }
    const result = classifyPlanningApplications([older, newerB, newerA], stores, patch)
    expect(result.nearStore.map((item) => item.id)).toEqual(['A2', 'B2', 'B'])
  })
})
