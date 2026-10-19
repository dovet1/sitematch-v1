// Companies House Public Data API shapes — only the fields we read.
// https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api

export interface ChAddress {
  premises?: string
  address_line_1?: string
  address_line_2?: string
  locality?: string
  region?: string
  postal_code?: string
  country?: string
  po_box?: string
}

export interface ChSearchItem {
  company_number: string
  title: string
  company_status?: string
  company_type?: string
  address_snippet?: string
  date_of_creation?: string
  date_of_cessation?: string
}

export interface ChSearchResponse {
  items?: ChSearchItem[]
  total_results?: number
}

export interface ChCompanyProfile {
  company_number: string
  company_name: string
  company_status?: string
  type?: string
  date_of_creation?: string
  registered_office_address?: ChAddress
  sic_codes?: string[]
  accounts?: {
    last_accounts?: { made_up_to?: string; type?: string; period_end_on?: string }
    next_due?: string
    overdue?: boolean
  }
}

export interface ChFilingItem {
  type?: string
  date?: string
  description?: string
  description_values?: { made_up_date?: string }
  links?: { self?: string; document_metadata?: string }
}

export interface ChDocumentMetadata {
  pages?: number
  resources?: Record<string, unknown>
}

// 'filed': read from iXBRL tags. 'extracted': read by a model from a scanned (PDF-only) filing.
export type FigureStatus = 'filed' | 'extracted' | 'not_published' | 'unread'

// What a facts refresh did about turnover and net assets. 'read' carries only the figures that
// were found (possibly none); 'unreadable' means the latest filing could not be read at all (not
// for the accounts date, no iXBRL or PDF, or a PDF too long to send).
export type FiguresOutcome =
  | { kind: 'kept' }
  | { kind: 'no_accounts' }
  | { kind: 'unreadable' }
  | { kind: 'read'; figures: Partial<Pick<CompanyFactsRow, 'turnover' | 'turnover_status' | 'turnover_page' | 'net_assets' | 'net_assets_status' | 'net_assets_page'>> }
  | { kind: 'failed'; error: string }

// A company_facts row, as stored.
export interface CompanyFactsRow {
  company_number: string
  company_name: string
  company_status: string | null
  company_type: string | null
  date_of_creation: string | null
  registered_office: string | null
  sic_codes: string[]
  last_accounts_made_up_to: string | null
  last_accounts_type: string | null
  accounts_overdue: boolean
  next_accounts_due: string | null
  turnover: number | null
  turnover_status: FigureStatus
  net_assets: number | null
  net_assets_status: FigureStatus
  figures_period_end: string | null
  // Set for 'extracted' figures: the 1-based PDF page each was read from, and the model that read it.
  turnover_page: number | null
  net_assets_page: number | null
  figures_model: string | null
  profile: ChCompanyProfile
  fetched_at: string
}

// A brand_company_suggestions row, as stored.
export interface BrandCompanySuggestionRow {
  brand_id: string
  company_number: string
  company_name: string
  company_status: string | null
  company_type: string | null
  address_snippet: string | null
  date_of_creation: string | null
  rank: number
  score: number
  query: string
}
