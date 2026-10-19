import type { DemographicMatch } from '../lib/brand-matcher-demographics'

// Brand Matcher (site -> brands) payload types. Shared by /api/public/brand-matcher and the
// mode's UI. See docs/design_handoff_contact_brands/README.md.

// Use classes offered on the form. Residential (C) is not a unit a brand takes.
export const BRAND_MATCHER_USE_CLASSES = ['E', 'B', 'F', 'Sui Generis'] as const
export type BrandMatcherUseClass = (typeof BRAND_MATCHER_USE_CLASSES)[number]

export interface BrandMatcherQuery {
  sqft: number
  useClass: BrandMatcherUseClass
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

export type AcquisitiveLevel = 'high' | 'medium'

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

export interface NewsEvidence {
  count: number
  items: { headline: string; url: string | null; date: string; upcoming: boolean }[]
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
}

// A filed figure. 'unread' (we have not read the accounts) and 'not_published' (the filing
// carries no figure) are different facts: only 'not_published' may be shown as "Not disclosed".
export type FiledFigure =
  | { status: 'filed'; value: number }
  // Read by a model from scanned accounts; page is the PDF page it came from.
  | { status: 'extracted'; value: number; page: number | null }
  | { status: 'not_published' }
  | { status: 'unread' }

// Companies House facts for the brand's admin-confirmed UK trading company. Register facts
// shown as filed — NEVER scored, rated or coloured.
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
  fetchedAt: string
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

export type ScoreComponent = 'size' | 'useClass' | 'acquisitive' | 'demographics' | 'nearest'

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
  locationType: LocationTypeSignal | null
  nearest: NearestStoreSignal | null
  // Typical unit for the band copy, from the estate profile (p25–p75), in sq ft.
  typicalRange: { min: number; max: number } | null
  contacts: BrandMatcherContacts
  // Does the site's town look like the towns the brand trades in? Absent when there is nothing
  // validated to say (brand-matcher-demographics.ts).
  demographic?: DemographicMatch | null
  // Why there is no demographic read: the site is outside every town we profile, the brand has
  // too few towns to profile, or it has a profile the backtest did not back. Absent when
  // demographics were not loaded.
  demographicGap?: 'no_town' | 'no_profile' | 'unproven' | null
  // Points out of 100 across the signals we hold data for; missing signals are left out.
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
