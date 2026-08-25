export type PlanningAlertBoundary = GeoJSON.Polygon | GeoJSON.MultiPolygon

export interface PlanningAlertStore {
  id: string
  name: string
  town: string | null
  postcode: string | null
  lat: number
  lng: number
}

export interface PlanningAlertApplication {
  id: string
  reference: string
  address: string
  postcode: string | null
  description: string
  status: string
  applicationType: string | null
  authorityName: string | null
  dateReceived: string
  lat: number
  lng: number
  sourceUrl: string | null
  /** Deterministic first-pass relevance for commercial property users. */
  relevance?: PlanningAlertApplicationRelevance
  nearestStore: {
    id: string
    name: string
    town: string | null
    distanceKm: number
  } | null
}

export type PlanningAlertRelevanceLevel = 'priority' | 'watchlist' | 'low'

export interface PlanningAlertApplicationRelevance {
  level: PlanningAlertRelevanceLevel
  reason: string
}

export interface PlanningAlertDigest {
  subscriptionId: string
  recipient: {
    name: string | null
    email: string
  }
  brand: {
    id: string
    name: string
    logoUrl: string | null
  }
  period: {
    start: string
    end: string
    label: string
  }
  patch: {
    name: string
    geometry: PlanningAlertBoundary
  }
  radiusKm: number
  stores: PlanningAlertStore[]
  nearStoreApplications: PlanningAlertApplication[]
  patchApplications: PlanningAlertApplication[]
  generatedAt: string
  provider: 'mock' | 'plannexus'
  /** Reserved for the later LLM summarisation stage. */
  summary: string | null
}

export type PlanningAlertGenerationStatus = 'processing' | 'generated' | 'sent' | 'failed'

export interface PlanningAlertReportState {
  digest: PlanningAlertDigest
  generation: {
    status: PlanningAlertGenerationStatus
    processedPrefixes: number
    totalPrefixes: number
    error: string | null
  }
}

export interface PlanningAlertSubscription {
  id: string
  userId: string
  brandId: string
  patchName: string
  patchGeometry: PlanningAlertBoundary
  postcodePrefixes: string[]
  radiusMeters: number
  enabled: boolean
}

export interface PlanningAlertSubscriptionOption {
  id: string
  userId: string
  brandName: string
  patchName: string
  recipientEmail: string | null
}
