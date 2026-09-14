export type CommercialWork =
  | 'new'
  | 'extension'
  | 'to-commercial'
  | 'between'
  | 'loss'
  | 'minor'

export type PlanningStage =
  | 'pending'
  | 'approved'
  | 'refused'
  | 'withdrawn'
  | 'decided'
  | 'other'

export interface PlotaAuthority {
  slug: string
  name: string
}

export interface PlotaCategory {
  slug: string
  label: string
}

export interface PlotaApplication {
  id: string
  reference: string
  authority: PlotaAuthority
  address?: string | null
  postcode?: string | null
  ward?: string | null
  parish?: string | null
  parish_code?: string | null
  uprn?: string | number | null
  description?: string | null
  category?: PlotaCategory | null
  categories?: PlotaCategory[] | null
  planning_route?: string | null
  procedure?: string | null
  dwelling_count?: number | null
  commercial?: boolean | null
  commercial_work?: CommercialWork | null
  commercial_use_class?: string | null
  floorspace_sqm?: number | null
  status?: string | null
  stage?: PlanningStage | null
  decision?: Record<string, unknown> | null
  appeal?: Record<string, unknown> | null
  date_received?: string | null
  date_validated?: string | null
  date_decided?: string | null
  key_dates?: Record<string, unknown> | null
  location?: { lat?: number | null; lng?: number | null; precision?: string | null } | null
  documents_count?: number | null
  comments?: Record<string, unknown> | null
  links?: {
    plota?: string | null
    council?: string | null
    associated?: string | null
  } | null
  changed_at?: string | null
  source?: string | null
}

/** A member of a Plota associated-application family, including the principal at depth 0. */
export interface PlotaFamilyMember {
  id: string
  reference: string
  authority: PlotaAuthority
  address?: string | null
  description?: string | null
  planning_route?: string | null
  procedure?: string | null
  status?: string | null
  stage?: PlanningStage | null
  date_received?: string | null
  date_decided?: string | null
  links?: PlotaApplication['links']
  source?: string | null
  parent_id: string | null
  parent_reference: string | null
  linked_by: 'citation' | 'reference' | null
  depth: number
  is_this?: boolean
}

export interface PlotaFamily {
  id: string
  reference: string
  role: string
  principal: PlotaFamilyMember
  conditions: Array<Record<string, unknown>>
  count: number
  applications: PlotaFamilyMember[]
}

export interface PlotaPage {
  data: PlotaApplication[]
  meta: {
    count?: number
    next_cursor?: string | null
    total?: number
    hint?: string
    historical_available?: boolean
    historical_included?: boolean
    [key: string]: unknown
  }
}

/**
 * A: commercial supply, D: commercial loss, both from Plota's `commercial_work`. `A-described` and
 * `D-described` are the same limbs read from the description, for records whose source carries no
 * `commercial_work` (Plota's archive); the label keeps the weaker evidence visible on the stored row.
 */
export type EligibilityLimb = 'A' | 'A-described' | 'B' | 'C' | 'D' | 'D-described'

export interface BrandAliasHit {
  brandId: string
  observedAlias: string
  source: 'description' | 'address'
  ambiguous: boolean
}

export interface EligibilityDecision {
  intelligenceTier: boolean
  limbs: EligibilityLimb[]
  brandHits: BrandAliasHit[]
  /**
   * True when limbs were met but the record is only paperwork against an existing consent.
   * The limbs are still reported, so a stored row with limbs and `intelligence_tier = false`
   * is an audit trail of exactly this exclusion.
   */
  detailSubmission: boolean
}

export interface SearchSpec {
  key: string
  params: Record<string, string>
}

export interface PlanningClassification {
  /**
   * Whether this application is worth paying to investigate, not whether commercial space
   * exists. It gates the expensive document and web-search pass, so it is a budget decision.
   */
  relevance: 'high' | 'medium' | 'low'
  /** Confidence in the relevance and commercialSpace judgement, not in any single figure. */
  confidence: number
  substantiveProposal: string
  /**
   * Whether a unit is built or moves to a different use -- NOT whether the finished building
   * contains occupiable commercial space. A trading shop getting a new shopfront contains
   * occupiable space but has no arriving occupier to find, so researching it returns nothing.
   */
  commercialSpace: {
    creates: 'yes' | 'no' | 'unclear'
    /** Use classes as written in the source, e.g. "E(b)", "B8", "sui generis". */
    useClasses: string[]
    evidence: string
    confidence: number
  }
  /**
   * Homes the proposal creates, asked on every record regardless of Plota's category.
   * Plota leaves `dwelling_count` empty on most records while the description states it.
   */
  dwellings: {
    /** null means the application does not say. 0 means it says there are none. */
    count: number | null
    basis: 'stated' | 'counted_from_description' | 'not_stated'
    evidence: string
    confidence: number
  }
  brandMentions: Array<{
    name: string
    role:
      | 'proposed_occupier'
      | 'proposed_operator'
      | 'applicant_developer'
      | 'existing_occupier'
      | 'former_occupier'
      | 'neighbouring_occupier'
      | 'referenced_only'
      | 'unclear'
    evidence: string
    confidence: number
  }>
  /** Floorspace only: dwellings are a first-class field now, not an observation. */
  observations: Array<{
    metric: 'commercial_floorspace'
    scope: 'existing' | 'proposed' | 'lost' | 'net' | 'stated_unspecified'
    action: 'create' | 'retain' | 'remove' | 'change' | 'unknown'
    /** null means the source refers to the figure but never quantifies it. Never stored. */
    value: number | null
    unit: 'count' | 'sqm'
    evidence: string
    confidence: number
  }>
  reasons: string[]
  uncertainties: string[]
  unansweredQuestions: string[]
}

export interface OpenRouterClassificationResult {
  classification: PlanningClassification
  model: string
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
}

export type ResearchBrandRole =
  | 'proposed_occupier'
  | 'proposed_operator'
  | 'applicant_developer'

export interface PlanningResearchSignal {
  name: string
  role: ResearchBrandRole
  evidenceSource: 'council_page' | 'document' | 'web'
  evidenceUrl: string
  evidenceExcerpt: string
  confidence: number
}

export type PlanningResearchEvidenceSource = 'council_page' | 'document' | 'web'

export interface PlanningResearchFloorspace {
  scope: 'existing' | 'lost' | 'proposed' | 'net'
  sqm: number
  measurementBasis: 'gross_internal' | 'net_internal' | 'gross_external' | 'unspecified'
  /** What the figure describes; absent on runs before research schema v4. */
  extent?: 'whole_development' | 'building' | 'unit' | 'phase' | 'unspecified'
  evidenceSource: PlanningResearchEvidenceSource
  evidenceUrl: string
  evidenceExcerpt: string
  evidencePage: string | null
  confidence: number
}

export interface PlanningResearchUseClass {
  phase: 'existing' | 'proposed'
  useClass: string
  evidenceSource: PlanningResearchEvidenceSource
  evidenceUrl: string
  evidenceExcerpt: string
  evidencePage: string | null
  confidence: number
}

export interface PlanningResearchSiteArea {
  phase: 'existing' | 'proposed' | 'unspecified'
  extent?: 'whole_development' | 'building' | 'unit' | 'phase' | 'unspecified'
  value: number
  unit: 'sqm' | 'sqft' | 'hectares' | 'acres'
  evidenceSource: PlanningResearchEvidenceSource
  evidenceUrl: string
  evidenceExcerpt: string
  evidencePage: string | null
  confidence: number
}
export interface PlanningResearchPartyClue {
  name: string
  role: 'applicant' | 'developer' | 'agent'
  evidenceSource: PlanningResearchEvidenceSource
  evidenceUrl: string
  evidenceExcerpt: string
  evidencePage: string | null
  confidence: number
}
export interface PlanningResearchResult {
  siteAreas?: PlanningResearchSiteArea[]
  partyClues?: PlanningResearchPartyClue[]
  researchWarnings?: string[]
  signals: PlanningResearchSignal[]
  commercialFloorspace: PlanningResearchFloorspace[]
  useClasses: PlanningResearchUseClass[]
  noOperatorReason: string
  researchMemo: string
  webCitations: Array<{
    url: string
    title: string | null
    excerpt: string | null
  }>
  webSearchRequests: number
  model: string
  inputTokens: number | null
  outputTokens: number | null
  costUsd: number | null
}
