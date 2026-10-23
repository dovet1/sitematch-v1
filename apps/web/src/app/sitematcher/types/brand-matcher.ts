
// Brand Matcher (site -> brands) payload types. Shared by /api/public/brand-matcher and the
// mode's UI. See docs/design_handoff_contact_brands/README.md.

// Use classes offered on the form. Residential (C) is not a unit a brand takes.
export const BRAND_MATCHER_USE_CLASSES = ['E', 'B', 'F', 'Sui Generis'] as const
export type BrandMatcherUseClass = (typeof BRAND_MATCHER_USE_CLASSES)[number]
// A query can also ask for every use class (the homepage search's default): no brand is
// excluded on use class, and the signal shows the brand's own classes.
export const BRAND_MATCHER_ALL_USE_CLASSES = 'All'
export type BrandMatcherQueryUseClass = BrandMatcherUseClass | typeof BRAND_MATCHER_ALL_USE_CLASSES

export interface BrandMatcherQuery {
  sqft: number
  useClass: BrandMatcherQueryUseClass
  postcode: string
  // Loosens the size tolerance and stops excluding brands on use class.
  widen?: boolean
}

// The GeoDS centre the site sits inside, when it sits inside one.
export interface BrandMatcherCentre {
  id: string
  // Short name, e.g. "Kirkstall Retail Park" (GeoDS names carry "; district (region)").
  name: string
  // GeoDS classification, e.g. "Large Retail Park".
  classification: string
  form: 'high_street' | 'retail_park' | 'shopping_centre'
}

export interface BrandMatcherSite {
  postcode: string
  lat: number
  lon: number
  centre: BrandMatcherCentre | null
  region: string | null
  country: string | null
  // The built-up area (town) the site is in, with its figures. null outside every British town;
  // absent when demographics were not loaded.
  town?: TownFigures | null
}

// A built-up area ("town") and the two figures towns are matched on.
export interface TownFigures {
  code: string
  name: string
  population: number
  // Affluence index: 100 is the England and Wales average.
  affluence: number
}

// How close a store's town is to the site's town. 'close': population within 1.5 times and
// affluence within 10 points; 'partial': within twice that on both.
export type TownMatchBand = 'close' | 'partial' | 'none'

// Per brand, for the card and the score: how its stores' towns compare with the site's town.
export interface TownMatch {
  band: TownMatchBand
  // The best-matching town.
  bestTown: string | null
  // Stores in a town we hold figures for, and how many of them are in a close-match town.
  townStores: number
  closeStores: number
  towns: number
  closeTowns: number
}

// One store in the Demographics panel, best match first.
export interface BrandStoreTown {
  name: string | null
  town: string | null
  miles: number
  // null when the store is in no town we hold figures for.
  bua: TownFigures | null
  band: TownMatchBand | null
  // How far the store's town is from the site's town, in close-match units (up to 1 is close).
  gap: number | null
}

export interface BrandStoreTownsResponse {
  // The brand's best-matching stores (at most TOP_STORE_TOWNS), best first. Stores in no town we
  // hold figures for are left out.
  stores: BrandStoreTown[]
  // All the brand's located stores.
  total: number
}

// Pill tone. Semantics are fixed by the handoff: green = criterion met / positive count,
// amber = partial or approximate fit, red = likely blocker, neutral = a fact, not a judgement.
export type SignalTone = 'green' | 'amber' | 'red' | 'neutral'

export type SizeFitState = 'fits' | 'lower_end' | 'upper_end' | 'larger' | 'smaller'

export interface SizeFitSignal {
  state: SizeFitState
  // The range the verdict was read against, in sq ft.
  basis: 'requirement' | 'estate'
  rangeMin: number | null
  rangeMax: number | null
  // When the verdict was read against a requirement: the date it was listed with us.
  postedAt?: string | null
}

// low: the only evidence is news, and on balance it says the brand is not acquiring.
export type AcquisitiveLevel = 'high' | 'medium' | 'low'

export interface RequirementEvidence {
  count: number
  sizeMin: number | null
  sizeMax: number | null
  useClasses: string[]
  // No target locations listed: the requirement does not rule the site's area out.
  nationwide: boolean
  // Target locations within reach of the site (names), and a sample of the rest.
  nearbyPlaces: string[]
  otherPlaces: string[]
  otherPlaceCount: number
  // One line per requirement, newest first, for the evidence list.
  items?: RequirementItem[]
}

export interface RequirementItem {
  sizeMin: number | null
  sizeMax: number | null
  useClasses: string[]
  places: string[]
  // ISO date the requirement was listed with us.
  postedAt: string | null
}

export type NewsKind = 'opening' | 'closure' | 'news'

export interface NewsItem {
  kind: NewsKind
  headline: string
  url: string | null
  date: string
  upcoming: boolean
  // -5 (closing every store) to +5 (needs many stores soon); 0 is neutral.
  rating: number
}

export interface NewsEvidence {
  count: number
  // The brand's news score, -5 to +5, from every article's rating weighted by its age
  // (activityScore in brand-matcher.ts). 0 when there are no articles.
  score: number
  items: NewsItem[]
}

export interface PlanningEvidence {
  count: number
}

export interface AcquisitiveSignal {
  level: AcquisitiveLevel
  requirements: RequirementEvidence | null
  news: NewsEvidence | null
  planning: PlanningEvidence | null
}

export interface LocationTypeSignal {
  form: BrandMatcherCentre['form']
  count: number
  // Up to three nearest centre short names.
  names: string[]
  nearestMiles: number | null
}

export interface NearestStoreSignal {
  miles: number
  storeName: string | null
  town: string | null
  // The three nearest stores, nearest first (absent until brand_matcher_brand_geo returns them).
  stores?: { name: string | null; town: string | null; miles: number }[]
  // How far apart the brand's stores usually are, in miles (tradingArea in brand-matcher.ts).
  // Absent when we hold no spacing for the brand: distance is then scored without it.
  spacingMiles?: number
  // A live requirement names a place within reach of the site: the brand wants to trade here,
  // however far it is from its current estate.
  wantedHere?: boolean
}

// A filed figure. 'unread' (we have not read the accounts) and 'not_published' (the filing
// carries no figure) are different facts: only 'not_published' may be shown as "Not disclosed".
export type FiledFigure =
  | { status: 'filed'; value: number }
  // Read by a model from scanned accounts; page is the PDF page it came from.
  | { status: 'extracted'; value: number; page: number | null }
  | { status: 'not_published' }
  | { status: 'unread' }

// The legal turnover limit a company's filed accounts type puts it under (Companies Act size
// thresholds; they rose for financial years starting on or after 6 April 2025).
export interface TurnoverBand {
  size: 'micro' | 'small'
  // Pounds, and as shown: "£10.2m".
  limit: number
  limitLabel: string
}

// Companies House facts for the brand's admin-confirmed UK trading company. Shown as filed;
// only the latest turnover counts towards the score (turnoverPoints in brand-matcher.ts).
export interface TradingFacts {
  companyNumber: string
  companyName: string
  status: string | null
  accountsType: string | null
  accountsMadeUpTo: string | null
  accountsOverdue: boolean
  registeredOffice: string | null
  turnover: FiledFigure
  netAssets: FiledFigure
  // Set when no turnover was published but the accounts filed are ones only a small or micro
  // company may file, so turnover is known to be under that size's legal limit.
  turnoverBand?: TurnoverBand | null
  // A registered charity: turnover holds its total income, shown as income and left out of the
  // score. Absent on reports shared before charities were recorded.
  isCharity?: boolean
  fetchedAt: string
}

// No one UK Companies House record represents the brand, either because its UK sites are run by
// franchisee companies ('franchise') or because it is run from abroad with no UK company that
// files accounts ('overseas'). Only set when we are highly confident (brand_franchise.confidence
// = 'high'); it then stands in for the financials, and turnover is left out of the score.
export type NoUkRecordKind = 'franchise' | 'overseas'

export interface FranchiseSignal {
  // Absent on reports shared before overseas brands were recorded: those are franchises.
  kind?: NoUkRecordKind
  sourceUrl: string | null
  checkedAt: string
}

export interface BrandMatcherContact {
  id: string
  name: string | null
  title: string | null
  area: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
}

export interface BrandMatcherContacts {
  primary: BrandMatcherContact | null
  // True when the primary contact's area covers the site's region.
  coversRegion: boolean
  others: BrandMatcherContact[]
  total: number
}

export type ScoreComponent = 'size' | 'useClass' | 'acquisitive' | 'demographics' | 'nearest' | 'turnover'

export interface ScorePart {
  component: ScoreComponent
  points: number
  max: number
}

export interface BrandMatch {
  brandId: string
  name: string
  logoUrl: string | null
  domain: string | null
  category: string | null
  storeCount: number
  size: SizeFitSignal
  // The brand's own use classes (from its requirements), or null when unknown.
  useClass: { codes: string[]; matches: boolean } | null
  acquisitive: AcquisitiveSignal | null
  tradingFacts: TradingFacts | null
  // Absent on reports shared before franchises were recorded.
  franchise?: FranchiseSignal | null
  locationType: LocationTypeSignal | null
  nearest: NearestStoreSignal | null
  // Typical unit for the band copy, from the estate profile (p25–p75), in sq ft.
  typicalRange: { min: number; max: number } | null
  contacts: BrandMatcherContacts
  // Whether the brand trades in a town like the site's. null when the site is in no town or the
  // brand has no stores in towns we hold figures for; absent when demographics were not loaded.
  townMatch?: TownMatch | null
  // Points out of 100 across the signals we hold data for; missing signals are left out, except
  // turnover and acquisitive, which are always counted (turnover is left out for a franchise or an
  // overseas brand).
  score: number
  scoreParts: ScorePart[]
}

export interface BrandMatcherResponse {
  site: BrandMatcherSite
  query: BrandMatcherQuery
  matches: BrandMatch[]
  // Brands considered before filtering, for "Scanning N brands".
  considered: number
}

export interface BrandMatcherStats {
  brandsTracked: number
}

export type BrandMatcherSort = 'best' | 'acquisitive' | 'gap' | 'name'

// ---------------------------------------------------------------------------
// Logged-out preview (/api/public/brand-matcher/preview, docs/design_handoff_homepage_trial).
// Redacted server-side: no brand id, name, logo, domain or contact ever leaves the server, and
// only the top rows carry their signals. The page blurs placeholders, it hides nothing real.

export type BrandMatcherPreviewUseClass = 'all' | 'E' | 'B' | 'F' | 'SG'

export interface BrandMatcherPreviewRow {
  score: number
  category: string | null
  storeCount: number
  // Row signals as the member list shows them (status + short value).
  signals: { key: 'size' | 'useClass' | 'acquisitive' | 'demographics' | 'nearest'; status: 'good' | 'caution' | 'poor' | 'none'; value: string }[]
  turnover: string | null
  contactCount: number
}

export interface BrandMatcherPreviewList {
  total: number
  rows: BrandMatcherPreviewRow[]
}

export interface BrandMatcherPreviewResponse {
  site: { postcode: string; centre: string | null }
  sqft: number
  // Brands considered before filtering, for the "Scanning N brands" screen.
  considered: number
  // One list per use-class choice, so the header dropdown switches without a refetch.
  lists: Record<BrandMatcherPreviewUseClass, BrandMatcherPreviewList>
}

// ---------------------------------------------------------------------------
// Brand report (/api/public/brand-matcher/report, docs/design_handoff_brand_report_export).
// A shareable PDF of up to BRAND_REPORT_MAX brands. Contacts never reach it: the route builds each
// brand field by field (toReportBrand in lib/brand-report.ts), so the payload has no contacts key.

export const BRAND_REPORT_MAX = 20

export type BrandReportPaper = 'a4' | 'letter'

export interface BrandReportMeta {
  preparedFor: string
  preparedBy: string
  company: string
  note: string
  paper: BrandReportPaper
}

export interface BrandReportRequest {
  query: BrandMatcherQuery
  brandIds: string[]
}

export type BrandReportBrand = Omit<BrandMatch, 'contacts'> & {
  // The brand's best-matching stores for the Demographics section; null when not loaded.
  storeTowns: BrandStoreTownsResponse | null
}

export interface BrandReportResponse {
  site: BrandMatcherSite
  query: BrandMatcherQuery
  // Ordered by fit.
  brands: BrandReportBrand[]
}
