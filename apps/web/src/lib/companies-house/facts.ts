// Pure Companies House transforms: company numbers, profile -> company_facts row, row -> the
// Brand Matcher TradingFacts payload, and ranking search candidates for a brand.
//
// Compliance (docs/design_handoff_contact_brands/README.md): figures are shown as filed and
// never rated. Labels here describe the register; none of them judge a company.

import type { TradingFacts } from '@/app/sitematcher-unified/types/brand-matcher'
import type { ChAddress, ChCompanyProfile, ChSearchItem, CompanyFactsRow } from './types'

// ---------------------------------------------------------------------------
// Company numbers
// ---------------------------------------------------------------------------

// CH numbers are 8 characters: all digits (England & Wales) or a two-letter prefix plus six
// digits (SC, NI, OC, SO, …). People type them without leading zeros.
export function normaliseCompanyNumber(raw: string): string | null {
  const s = raw.toUpperCase().replace(/\s+/g, '')
  if (/^\d{1,8}$/.test(s)) return s.padStart(8, '0')
  if (/^[A-Z]{2}\d{1,6}$/.test(s)) return s.slice(0, 2) + s.slice(2).padStart(6, '0')
  if (/^[A-Z0-9]{8}$/.test(s)) return s
  return null
}

export function companiesHouseUrl(companyNumber: string, page: '' | 'filing-history' = ''): string {
  const base = `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`
  return page ? `${base}/${page}` : base
}

// ---------------------------------------------------------------------------
// Register labels (CH api-enumerations)
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  dissolved: 'Dissolved',
  liquidation: 'Liquidation',
  receivership: 'Receivership',
  administration: 'In administration',
  'voluntary-arrangement': 'Voluntary arrangement',
  'converted-closed': 'Converted / closed',
  'insolvency-proceedings': 'Insolvency proceedings',
  registered: 'Registered',
  removed: 'Removed',
  closed: 'Closed',
  open: 'Open',
}

const ACCOUNTS_TYPE_LABEL: Record<string, string> = {
  full: 'Full accounts',
  small: 'Small company accounts',
  medium: 'Medium company accounts',
  group: 'Group accounts',
  dormant: 'Dormant company accounts',
  interim: 'Interim accounts',
  initial: 'Initial accounts',
  'total-exemption-full': 'Total exemption full accounts',
  'total-exemption-small': 'Total exemption small accounts',
  'partial-exemption': 'Partial exemption accounts',
  'audit-exemption-subsidiary': 'Audit exemption subsidiary accounts',
  'filing-exemption-subsidiary': 'Filing exemption subsidiary accounts',
  'micro-entity': 'Micro-entity accounts',
  'audited-abridged': 'Audited abridged accounts',
  'unaudited-abridged': 'Unaudited abridged accounts',
}

function humanise(code: string): string {
  const s = code.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function statusLabel(code: string | null): string | null {
  if (!code) return null
  return STATUS_LABEL[code] ?? humanise(code)
}

export function accountsTypeLabel(code: string | null): string | null {
  if (!code || code === 'no-accounts-type-available' || code === 'null') return null
  return ACCOUNTS_TYPE_LABEL[code] ?? humanise(code)
}

// ---------------------------------------------------------------------------
// Profile -> row -> payload
// ---------------------------------------------------------------------------

export function formatAddress(a: ChAddress | undefined): string | null {
  if (!a) return null
  const parts = [
    [a.premises, a.address_line_1].filter(Boolean).join(' '),
    a.address_line_2,
    a.locality,
    a.region,
    a.postal_code?.toUpperCase(),
  ]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
  return parts.length ? parts.join(', ') : null
}

const isoDate = (d: string | undefined): string | null => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null)

// Figures stay 'unread': the profile carries no turnover or balance sheet, and the accounts
// parser that would read them has not been built. Inferring "not published" from the accounts
// type would be a guess, and "Not disclosed" must only ever mean the filing has no figure.
export function profileToFactsRow(profile: ChCompanyProfile, fetchedAt = new Date().toISOString()): CompanyFactsRow {
  const last = profile.accounts?.last_accounts
  return {
    company_number: profile.company_number,
    company_name: profile.company_name,
    company_status: profile.company_status ?? null,
    company_type: profile.type ?? null,
    date_of_creation: isoDate(profile.date_of_creation),
    registered_office: formatAddress(profile.registered_office_address),
    sic_codes: profile.sic_codes ?? [],
    last_accounts_made_up_to: isoDate(last?.made_up_to ?? last?.period_end_on),
    last_accounts_type: last?.type ?? null,
    accounts_overdue: profile.accounts?.overdue === true,
    next_accounts_due: isoDate(profile.accounts?.next_due),
    turnover: null,
    turnover_status: 'unread',
    net_assets: null,
    net_assets_status: 'unread',
    figures_period_end: null,
    profile,
    fetched_at: fetchedAt,
  }
}

type FactsFields = Pick<
  CompanyFactsRow,
  | 'company_number'
  | 'company_name'
  | 'company_status'
  | 'registered_office'
  | 'last_accounts_made_up_to'
  | 'last_accounts_type'
  | 'accounts_overdue'
  | 'turnover'
  | 'turnover_status'
  | 'net_assets'
  | 'net_assets_status'
  | 'fetched_at'
>

function figure(value: number | null, status: CompanyFactsRow['turnover_status']): TradingFacts['turnover'] {
  if (status === 'filed' && value != null) return { status: 'filed', value: Number(value) }
  if (status === 'not_published') return { status: 'not_published' }
  return { status: 'unread' }
}

export function factsRowToTradingFacts(row: FactsFields): TradingFacts {
  return {
    companyNumber: row.company_number,
    companyName: row.company_name,
    status: statusLabel(row.company_status),
    accountsType: accountsTypeLabel(row.last_accounts_type),
    accountsMadeUpTo: row.last_accounts_made_up_to,
    accountsOverdue: row.accounts_overdue,
    registeredOffice: row.registered_office,
    turnover: figure(row.turnover, row.turnover_status),
    netAssets: figure(row.net_assets, row.net_assets_status),
    fetchedAt: row.fetched_at,
  }
}

// ---------------------------------------------------------------------------
// Suggestions — rank CH search results for a brand. An admin confirms; this only orders.
// ---------------------------------------------------------------------------

const LEGAL_SUFFIX = new Set(['limited', 'ltd', 'plc', 'llp', 'lp', 'the', 'co', 'company', 'cic'])
// Words an operating company commonly adds to the brand ("ALDI STORES", "MCDONALD'S
// RESTAURANTS"). They cost nothing, and mark the entity that trades.
const OPERATING_WORDS = new Set([
  'stores', 'store', 'retail', 'retailers', 'restaurants', 'restaurant', 'trading',
  'operations', 'supermarkets', 'shops', 'uk', 'gb', 'great', 'britain', 'and',
])
// The entity we want signs leases and trades; these words mark holding and finance vehicles.
const NON_TRADING = /\b(holdings?|group|investments?|properties|property|nominees?|trustees?|pension|finance|capital|topco|midco|bidco|holdco)\b/i
const GONE = /^(dissolved|closed|converted-closed|removed)/
const DISTRESSED = new Set(['liquidation', 'administration', 'receivership', 'insolvency-proceedings'])

export function coreTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !LEGAL_SUFFIX.has(t))
}

// Search variants per brand. The bare name alone misses trading companies whose name adds an
// operating word — "Aldi" does not return ALDI STORES LIMITED in its first 20 results.
export function suggestionQueries(brandName: string): string[] {
  const base = brandName.trim()
  return [base, `${base} stores`, `${base} retail`, `${base} restaurants`, `${base} UK`]
}

export function scoreCandidate(brandName: string, item: ChSearchItem): number {
  const b = coreTokens(brandName)
  const c = coreTokens(item.title)
  if (b.length === 0 || c.length === 0) return 0
  const bSet = new Set(b)
  const cSet = new Set(c)
  const coverage = b.filter((t) => cSet.has(t)).length / b.length
  if (coverage === 0) return 0

  const extras = c.filter((t) => !bSet.has(t))
  const distinctive = extras.filter((t) => !OPERATING_WORDS.has(t))
  // An operating company puts the brand first ("ALDI STORES"); a brand word that only turns
  // up later ("RETAIL ACTIVATE" for Activate) is a different business, so the name-match
  // bonuses need the brand's words to lead.
  const leads = b.every((t, i) => c[i] === t)
  let score = 0.6 * coverage - 0.12 * Math.min(distinctive.length, 4)
  if (leads && distinctive.length === 0) score += 0.3
  if (leads && extras.some((t) => OPERATING_WORDS.has(t) && t !== 'and')) score += 0.1

  const status = item.company_status ?? ''
  if (status === 'active') score += 0.1
  else if (GONE.test(status)) score -= 0.5
  else if (DISTRESSED.has(status)) score -= 0.2
  if (NON_TRADING.test(item.title)) score -= 0.15
  if (item.company_type === 'ltd' || item.company_type === 'plc') score += 0.05
  else if (item.company_type === 'oversea-company') score -= 0.3
  return Math.round(score * 1000) / 1000
}

export interface RankedCandidate {
  item: ChSearchItem
  score: number
}

// Merges results across queries (first sighting wins the tie-break order — CH already weights
// exact and active matches) and keeps the best few.
export function rankCandidates(brandName: string, items: ChSearchItem[], limit = 5): RankedCandidate[] {
  const seen = new Set<string>()
  return items
    .filter((item) => !seen.has(item.company_number) && seen.add(item.company_number))
    .map((item, i) => ({ item, score: scoreCandidate(brandName, item), i }))
    .filter((c) => c.score > 0)
    .sort((a, z) => z.score - a.score || a.i - z.i)
    .slice(0, limit)
    .map(({ item, score }) => ({ item, score }))
}
