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
  turnover_status: 'filed' | 'not_published' | 'unread'
  net_assets: number | null
  net_assets_status: 'filed' | 'not_published' | 'unread'
  figures_period_end: string | null
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
