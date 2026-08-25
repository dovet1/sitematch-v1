import { haversineMeters, pointInGeometry } from '@/app/sitematcher-unified/lib/geo'
import type {
  PlanningAlertApplication,
  PlanningAlertBoundary,
  PlanningAlertStore,
} from './types'

export interface ClassifiedPlanningApplications {
  nearStore: PlanningAlertApplication[]
  inPatch: PlanningAlertApplication[]
}

export function classifyPlanningApplications(
  applications: PlanningAlertApplication[],
  stores: PlanningAlertStore[],
  patch: PlanningAlertBoundary,
  radiusMeters = 5000
): ClassifiedPlanningApplications {
  const nearStore: PlanningAlertApplication[] = []
  const inPatch: PlanningAlertApplication[] = []

  for (const application of applications) {
    let nearest: PlanningAlertStore | null = null
    let nearestDistance = Infinity

    for (const store of stores) {
      const distance = haversineMeters(
        application.lat,
        application.lng,
        store.lat,
        store.lng
      )
      if (distance < nearestDistance) {
        nearest = store
        nearestDistance = distance
      }
    }

    if (nearest && nearestDistance <= radiusMeters) {
      nearStore.push({
        ...application,
        nearestStore: {
          id: nearest.id,
          name: nearest.name,
          town: nearest.town,
          distanceKm: Number((nearestDistance / 1000).toFixed(1)),
        },
      })
      continue
    }

    if (pointInGeometry(application.lng, application.lat, patch)) {
      inPatch.push({ ...application, nearestStore: null })
    }
  }

  const newestFirst = (a: PlanningAlertApplication, b: PlanningAlertApplication) =>
    b.dateReceived.localeCompare(a.dateReceived) || a.reference.localeCompare(b.reference)

  return {
    nearStore: nearStore.sort(newestFirst),
    inPatch: inPatch.sort(newestFirst),
  }
}
