// Shared types for the unified workspace. Shapes follow the design handoff
// state contract in /docs/design_handoff_unified_workspace/README.md.

export type WorkspaceMode = 'assess' | 'find' | 'sketch'

export type InspectorTab = 'missing' | 'present' | 'catchment' | 'sketch'

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
  logoDomain: string | null
  logoUrl: string | null
}

// A brand trading in the catchment, aggregated from the nearby-store landscape.
export interface PresentBrand {
  brandId: string
  brandName: string
  storeCount: number
  town: string | null
  // Union of categories across the brand's trading fascias (for filtering).
  categoryIds: string[]
  // One category name for optional display; does not gate filtering.
  categoryName: string | null
  logoDomain: string | null
  logoUrl: string | null
}

// A brand with no presence in the catchment. Missing fascias are collapsed to
// their owning brand; a brand with any present fascia is excluded (counts as
// present). `representative` is the fascia used to open the brand detail modal.
export interface MissingBrand {
  brandId: string
  brandName: string
  categoryName: string | null
  // Union of categories across the brand's missing fascias (for filtering).
  categoryIds: string[]
  nearestStoreDistance?: number
  representative: MissingFascia
  logoDomain: string | null
  logoUrl: string | null
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
  brandId: string | null
  companyName: string
  title: string | null
  listingType: string | null
  siteSizeMin: number | null
  siteSizeMax: number | null
  siteAcreageMin: number | null
  siteAcreageMax: number | null
  dwellingCountMin: number | null
  dwellingCountMax: number | null
  placeName: string | null
  formattedAddress: string | null
  companyDomain: string | null
  logoUrl: string | null
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

// Payload for the brand info modal (no active requirement), from
// /api/public/brands/[id]/detailed. `activeRequirementId` is resolved server-side with the
// same visibility rules as the requirement map — when non-null the caller opens the
// requirement modal instead of this brand-info view.
export interface BrandInfo {
  activeRequirementId: string | null
  brand: {
    id: string
    name: string
    logo_url: string | null
    category: string | null
    storeCount: number
    latestStore: { name: string | null; town: string | null; openedDate: string | null } | null
    locations: { lat: number; lon: number }[]
  }
  contacts: RequirementContact[]
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

// One brand/category token dropped into a Find-Gaps bucket. `key` (`${type}:${id}`)
// is the namespaced identity used for add/remove/toggle so a category and a brand
// sharing a raw id can't collide. `targetIds` are the resolved fascia/category
// UUIDs sent to the API (a brand resolves to all of its fascia ids).
export interface GapItem {
  key: string
  id: string
  type: 'category' | 'brand'
  label: string
  targetIds: string[]
}

export type GapBucket = 'missing' | 'have'
export type GapSort = 'pop' | 'az'

export interface CatchmentDefinition {
  mode: CatchmentMode
  value: number
}

// --- Compare two locations (Assess Area) ---

// A bare map coordinate (input to dropComparePoint before a catchment is attached).
export interface LatLng {
  lat: number
  lng: number
}

// A dropped map point in the compare flow, carrying its own catchment so each
// pin can be analysed at an independent radius / drive / walk.
export interface ComparePoint {
  lat: number
  lng: number
  catchment: CatchmentDefinition
}

// The armed pair: A is the original Assess pin, B the second dropped point.
export interface ComparePair {
  a: ComparePoint
  b: ComparePoint
}

// Which compare pin the catchment control currently edits.
export type CompareArm = 'a' | 'b'

// Aggregated catchment demographics for one compared point.
export interface CompareStats {
  population: number | null
  households: number | null
  affluence: number | null
}

// The per-point comparison result (brands + demographics for one catchment).
export interface ComparePointResult {
  present: PresentBrand[]
  missing: MissingBrand[]
  stats: CompareStats
}

// One row of the catchment-stats delta table (Pin A · Pin B · Δ B−A).
export interface CompareStatRow {
  key: string
  label: string
  a: number | null
  b: number | null
  delta: number | null
  pct: number | null
  // 'up' = higher is good for this metric, 'down' = lower is good.
  better: 'up' | 'down'
  // Whole numbers vs one-decimal (affluence) formatting.
  decimals: number
}

export interface WorkspaceOverlays {
  // Road AADT line-shading (available everywhere except sketch).
  roadTraffic: boolean
  // Count-point intensity heatmap (available everywhere except sketch).
  trafficHeatmap: boolean
  // Requirement location pins (Assess-only, gated on an active dropped point).
  requirements: boolean
}
