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
// Links a fascia to a category (a fascia may map to several categories).
export interface FasciaCategoryMapping {
  fascia_id: string
  category_id: string
  is_primary: boolean
}
export interface ReferenceData {
  categories: RefCategory[]
  brands: RefBrand[]
  fasciaCategoryMappings: FasciaCategoryMapping[]
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

// A live occupier requirement location, from /api/public/gapfinder/requirement-locations.
export interface RequirementLocation {
  id: string
  requirementId: string
  companyName: string
  title: string | null
  listingType: string | null
  placeName: string | null
  formattedAddress: string | null
  coordinates: { lng: number; lat: number }
}

// A single acquiring contact on a requirement. `kind` distinguishes the retailer's own
// team ('in-house') from an appointed agent ('agency'); null when unspecified.
export interface RequirementContact {
  name: string | null
  title: string | null
  org: string | null
  email: string | null
  phone: string | null
  kind: 'in-house' | 'agency' | null
}

// Subset of /api/public/listings/[id]/detailed the requirement modal renders.
// Note: `id` and `listing_type` are top-level on the API response, not under `company`.
export interface RequirementDetail {
  id: string
  listing_type: string | null
  description: string | null
  verified_at: string | null
  company: {
    name: string
    logo_url: string | null
    sector: string
    use_class: string
    sectors: string[]
    use_classes: string[]
    site_size: string
    brochure_url: string | null
  }
  contacts: {
    primary: {
      name: string | null
      title: string | null
      email: string | null
      phone: string | null
    } | null
    all: RequirementContact[]
  }
  locations: {
    all: { place_name?: string | null; formatted_address?: string | null }[]
    is_nationwide: boolean
  }
}

// The brand's store estate for a requirement, from
// /api/public/requirements/[id]/store-estate. `dateIsProxy` is true when `date` is a
// store's created_at (import date) rather than a real open_date.
export interface StoreEstateStore {
  id: string
  name: string | null
  town: string | null
  lat: number
  lon: number
}
export interface StoreEstate {
  storeCount: number
  latestStore: {
    name: string | null
    town: string | null
    date: string | null
    dateIsProxy: boolean
  } | null
  stores: StoreEstateStore[]
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
  traffic: boolean
  // Requirement location pins (Assess-only, gated on an active dropped point).
  requirements: boolean
}
