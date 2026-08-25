// Shared request/response DTOs for the Find Sites search endpoint. Defined ONCE so the
// route handler (server) and the client service/hook agree on the wire shape. Everything
// here is plain JSON-serialisable — no engine internals leak across the boundary beyond the
// already-serialisable `SiteFeaturesRaw` and `CriterionResult`.

import type { CriterionResult, SiteFeaturesRaw } from './types'
import type { SiteTier } from './tiering'
import type { SearchDiagnostics } from './types'
import type { LandUseRoadCrossTab } from './feature-assembly'
import type { RecallReport } from './search-analysis'

/** The four generic worked-example briefs (data, not logic — see requirement-presets.ts). */
export type FindSitesPreset = 'drive-thru' | 'roadside' | 'retail' | 'industrial'

/** Query parameters accepted by GET /api/public/sites/search. All optional except preset. */
export interface FindSitesSearchParams {
  /** [minLon, minLat, maxLon, maxLat]. Defaults to the Canterbury bbox server-side. */
  bbox?: [number, number, number, number]
  preset: FindSitesPreset
  /** Optional brand — appends the (hard) same-brand-distance gate. Omit for brand-agnostic. */
  brandId?: string | null
  fasciaIds?: string[] | null
  /** Same-brand minimum distance (miles) — only used when brandId is set. */
  minMiles?: number
  siteSource?: string
  minAcres?: number
  /** How many ranked, non-`unlikely` parcels to return (with geometry). */
  topN?: number
}

/** One evidence entry surfaced to the UI (a partial carries its hedging note). */
export interface FindSitesPartial {
  label: string
  note: string | null
}

/** The passed / partial / failed / unknown breakdown for one parcel (labels only). */
export interface FindSitesEvidence {
  passed: string[]
  partial: FindSitesPartial[]
  failed: string[]
  unknown: string[]
}

/** One ranked parcel in the shortlist. Carries the assembled features + full criteria so the
 *  detail view never re-derives anything, plus the title polygon + centroid for the map. */
export interface FindSitesItem {
  rank: number
  siteId: string
  name: string | null
  tier: SiteTier
  tierLabel: string
  /** Internal ordering key in [0,1]. NOT a suitability %; shown only as a hidden sort aid. */
  signal: number
  completeness: number
  oversized: boolean
  eligible: boolean
  /** Assembled, normalised feature bundle — area, land use, roads, traffic, frontage, etc. */
  features: SiteFeaturesRaw
  evidence: FindSitesEvidence
  criteria: CriterionResult[]
  /** [lon, lat] for flyTo; derived from the title polygon. null when geometry is unavailable. */
  centroid: [number, number] | null
  /** Registered-title polygon (indicative freehold extent — never an exact development plot). */
  geometry: GeoJSON.Geometry | null
}

/** Tier counts across the whole scored universe (not just the returned page). */
export type FindSitesTierCounts = Record<SiteTier, number>

export interface FindSitesResponse {
  /** Echo of the resolved parameters (post-defaulting) for display + debugging. */
  params: Required<Pick<FindSitesSearchParams, 'preset' | 'siteSource' | 'minAcres' | 'topN'>> & {
    bbox: [number, number, number, number]
    brandId: string | null
    brandName: string | null
    minMiles: number | null
  }
  universeSize: number
  /** Eligible survivors after the hard gates (across the whole universe). */
  eligibleCount: number
  funnel: SearchDiagnostics
  tiers: FindSitesTierCounts
  crossTab: LandUseRoadCrossTab
  /** Known-site recall — only present for a brand-specific search. */
  recall: RecallReport | null
  /** The returned shortlist page (ranked, non-`unlikely`, capped at topN, with geometry). */
  items: FindSitesItem[]
  /** True when more non-`unlikely` parcels exist than were returned. */
  truncated: boolean
}
