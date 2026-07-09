// Shared types for the unified workspace. Shapes follow the design handoff
// state contract in /docs/design_handoff_unified_workspace/README.md.

export type WorkspaceMode = 'assess' | 'find' | 'sketch'

export type InspectorTab = 'summary' | 'catchment' | 'sketch'

export type MapScale = 'national' | 'local'

export type CatchmentMode = 'distance' | 'drive' | 'walk'

// A selected opportunity: a built-up area or a dropped point.
export interface WorkspaceArea {
  id: string
  name: string
  region?: string
  center: [number, number]
  population?: number
  // 'bua' = a built-up area picked from the gap list/map; 'point' = a dropped Assess pin.
  kind: 'bua' | 'point'
}

// A ranked built-up area returned by /api/public/gaps/find.
export interface BUAResult {
  gsscode: string
  name: string
  pop: number
  pop_final: number | null
  pop_official: number | null
  pop_band: string
  centroid_lat: number
  centroid_lon: number
}

// Reference data for the rule builder (categories + brands with nested fascias).
export interface RefCategory {
  id: string
  name: string
}
export interface RefFascia {
  id: string
  name: string
  brand_id: string
}
export interface RefBrand {
  id: string
  name: string
  fascias: RefFascia[]
}
export interface ReferenceData {
  categories: RefCategory[]
  brands: RefBrand[]
}

// A brand/fascia with no presence near the selected area (from missing-fascias).
export interface MissingFascia {
  fasciaId: string
  fasciaName: string
  brandId: string
  brandName: string
  categoryId: string | null
  categoryName: string | null
  nearestStoreDistance?: number
  nearestStoreName?: string
  nearestStoreTown?: string
}

// Map sub-selection (a store dot, etc.). Requirements are deferred in v1.
export interface MapSubSelection {
  type: 'store'
  id: string
}

// Presence/proximity gap rule (mirrors GapFinder's filter rule shape).
// `value` is the human label; `targetIds` are the resolved fascia/category UUIDs
// sent to the API (a brand resolves to all of its fascia ids).
export interface GapRule {
  id: string
  kind: 'presence' | 'proximity'
  type: 'category' | 'brand' | 'fascia'
  value: string
  targetIds: string[]
  op: 'has' | 'lacks' | 'within' | 'beyond'
  km?: number
}

export interface CatchmentDefinition {
  mode: CatchmentMode
  value: number
}

export interface WorkspaceOverlays {
  // Requirements overlay is deferred in v1.
  traffic: boolean
}
