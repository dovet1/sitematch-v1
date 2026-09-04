// Shared types for the unified workspace. Shapes follow the design handoff
// state contract in /docs/design_handoff_unified_workspace/README.md.

export type WorkspaceMode = 'assess' | 'find' | 'sketch' | 'directory'

export type InspectorTab = 'missing' | 'present' | 'catchment' | 'planning' | 'sketch'

export type MapScale = 'national' | 'local'

export type CatchmentMode = 'distance' | 'drive' | 'walk'

export type GapGeography = 'town' | 'retail_centre'
export type RetailCentreForm = 'high_street' | 'retail_park' | 'shopping_centre'

// A selected opportunity: a built-up area or a dropped point.
export interface WorkspaceArea {
  id: string
  name: string
  region?: string
  center: [number, number]
  population?: number
  // Polygon selections use their exact boundary for Present and Planning.
  kind: 'bua' | 'retail_centre' | 'point'
  classification?: string
  retailCount?: number
  retailForm?: RetailCentreForm
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

export interface RetailCentreResult {
  rc_id: string
  name: string
  classification: string
  form: RetailCentreForm
  form_label: string
  country: string | null
  region_name: string | null
  retail_count: number | null
  area_km2: number | null
  centroid_lat: number
  centroid_lon: number
}

export type GapResult = BUAResult | RetailCentreResult

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

// A commercial-relevant planning application from the PlanIt API
// (/api/public/planning). Keyed on `name` (Council/uid) — `uid` alone is only
// council-scoped. Applicant/agent names are omitted: PlanIt only ever returns
// the placeholder "See source"; the `url` link-out reaches the real parties.
export type PlanningTruncationReason =
  | 'authority_cap'
  | 'page_cap'
  | 'record_cap'
  | 'upstream_timeout'
  | 'upstream_busy'
  | 'rate_limited'
  | 'upstream_error'
  | null

// Progress while a planning lookup fans out across planning authorities. A
// lookup can span ~20 authorities at concurrency 2, so the tab reports which
// one it is on rather than showing an unqualified spinner for minutes.
export interface PlanningProgress {
  done: number
  total: number
  authority: string | null
}

export interface PlanningApplication {
  name: string
  uid: string
  address: string
  appSize: string
  appState: string
  appType: string
  description: string
  url: string
  lat: number
  lng: number
  decidedDate: string | null
  dateValidated: string | null
  nDwellings: number | null
  applicantAddress: string | null
  agentAddress: string | null
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
  // Drives the directory estate map's "opened in last 12 months" legend series.
  // Frequently null — many imported stores carry no open_date.
  openDate?: string | null
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
export type GapSort = 'pop' | 'retail_count' | 'az'

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

// ---------------------------------------------------------------------------
// Company Directory
// ---------------------------------------------------------------------------

// One card in the directory grid, from /api/public/directory/brands (backed by the
// directory_brand_cards() aggregate — every count is independent, not a join product).
export interface DirectoryBrandCard {
  id: string
  name: string
  logoUrl: string | null
  domain: string | null
  websiteUrl: string | null
  // "Leisure · Restaurants" — parent · child, or just child when there is no parent.
  category: string | null
  storeCount: number
  inHouseCount: number
  agentCount: number
  // The status kicker is derived from this alone: there is no expansion_status column,
  // so it is "Actively acquiring" or "No requirement on file", nothing in between.
  hasActiveRequirement: boolean
}

// A contact tile. `kind` drives the visual treatment — in-house tiles are plain, agent
// tiles get the violet `AGENT · <firm>` tag and navigate to the agent profile.
export interface DirectoryContact {
  id: string
  name: string | null
  title: string | null
  org: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  kind: 'in-house' | 'agent'
  // Set only when kind === 'agent' — the directory_agents id to navigate to.
  agentId?: string
}

// A row in the In-house teams tab, from /api/public/directory/in-house. Needs its own
// endpoint: the grid payload carries only counts, so there is nothing to flatten.
export interface DirectoryTeamMember extends DirectoryContact {
  brandId: string
  brandName: string
  brandLogoUrl: string | null
}

export interface DirectoryAgentSummary {
  id: string
  name: string
  title: string | null
  firm: string | null
  firmId: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  region: string | null
  focus: string | null
  brandCount: number
}

// Target location pins. Coordinates are normalised server-side via
// normalizeRequirementCoordinates() — requirement_locations.coordinates is untyped jsonb
// holding either [lng, lat] or {lat, lng}, so raw values would plot in the sea.
export interface DirectoryTarget {
  id: string
  name: string | null
  lat: number
  lon: number
}

export interface DirectoryRequirement {
  id: string
  sizeMin: number | null
  sizeMax: number | null
  sizeSeenSqft: number | null
  sizeSeenBasis: string | null
  summary: string | null
  listingType: string | null
  useClasses: string[]
  verifiedAt: string | null
  brochureUrl: string | null
  targets: DirectoryTarget[]
  targetNames: string[]
}

export interface DirectoryActivityEvent {
  id: string
  kind: 'opening' | 'closure'
  eventDate: string
  isUpcoming: boolean
  headline: string
  url: string | null
}

// Full brand profile payload, from /api/public/directory/brands/[id].
export interface DirectoryBrandProfile {
  brand: {
    id: string
    name: string
    logoUrl: string | null
    domain: string | null
    websiteUrl: string | null
    storeLocatorUrl: string | null
    category: string | null
    storeCount: number
    latestStore: { name: string | null; town: string | null; date: string | null; dateIsProxy: boolean } | null
    // Estate points for the map; capped at STORE_POINT_CAP.
    stores: StoreEstateStore[]
  }
  requirement: DirectoryRequirement | null
  contacts: DirectoryContact[]
  agents: DirectoryContact[]
  activity: DirectoryActivityEvent[]
}

// Agent profile payload, from /api/public/directory/agents/[id]. `brands` is the reverse
// side of brand_agents — the whole point of normalising the edge.
export interface DirectoryAgentProfile {
  agent: DirectoryAgentSummary
  brands: DirectoryBrandCard[]
}

// Every list endpoint caps its result set and says so explicitly, rather than silently
// returning a prefix — client-side search cannot find a record the cap omitted.
export interface DirectoryList<T> {
  items: T[]
  truncated: boolean
}

// Which entity a directory nav-stack node points at. The stack (not a pair of selected
// ids) is what makes Brand A -> Agent -> Brand B -> back -> Agent -> back work.
export type DirectoryNode = { kind: 'brand' | 'agent'; id: string }

export type DirectoryTab = 'brands' | 'agents' | 'inhouse'
