// Server-side Companies House operations against our tables. Callers pass a service-role
// client (admin routes, the refresh cron, the suggestion script); all three tables are
// service-role only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCompanyProfile, searchCompanies } from './client'
import { normaliseCompanyNumber, profileToFactsRow, rankCandidates, suggestionQueries } from './facts'
import type { BrandCompanySuggestionRow, CompanyFactsRow } from './types'

const SUGGESTION_LIMIT = 5

export class CompanyNotFoundError extends Error {}

// Search CH for the brand's likely trading company and replace its stored suggestions.
export async function suggestCompaniesForBrand(
  db: SupabaseClient,
  brand: { id: string; name: string }
): Promise<BrandCompanySuggestionRow[]> {
  const queries = suggestionQueries(brand.name)
  const results = await Promise.all(queries.map((q) => searchCompanies(q)))
  const ranked = rankCandidates(brand.name, results.flat(), SUGGESTION_LIMIT)
  const rows: BrandCompanySuggestionRow[] = ranked.map(({ item, score }, i) => ({
    brand_id: brand.id,
    company_number: item.company_number,
    company_name: item.title,
    company_status: item.company_status ?? null,
    company_type: item.company_type ?? null,
    address_snippet: item.address_snippet ?? null,
    date_of_creation: item.date_of_creation ?? null,
    rank: i + 1,
    score,
    query: queries.join(' | '),
  }))

  const del = await db.from('brand_company_suggestions').delete().eq('brand_id', brand.id)
  if (del.error) throw new Error(`clear suggestions: ${del.error.message}`)
  if (rows.length > 0) {
    const ins = await db.from('brand_company_suggestions').insert(rows)
    if (ins.error) throw new Error(`store suggestions: ${ins.error.message}`)
  }
  return rows
}

// Fetch a company's profile from CH and upsert its facts row. Figures already read for the
// same accounts period are kept — a profile refresh must not wipe what a parser found.
export async function refreshCompanyFacts(
  db: SupabaseClient,
  rawCompanyNumber: string
): Promise<CompanyFactsRow> {
  const companyNumber = normaliseCompanyNumber(rawCompanyNumber)
  if (!companyNumber) throw new CompanyNotFoundError(`${rawCompanyNumber} is not a company number`)
  const profile = await getCompanyProfile(companyNumber)
  if (!profile) throw new CompanyNotFoundError(`Companies House has no company ${companyNumber}`)

  const row = profileToFactsRow(profile)
  const existing = await db
    .from('company_facts')
    .select('turnover, turnover_status, net_assets, net_assets_status, figures_period_end')
    .eq('company_number', companyNumber)
    .maybeSingle()
  if (existing.error) throw new Error(`read facts: ${existing.error.message}`)
  const prior = existing.data as Pick<
    CompanyFactsRow,
    'turnover' | 'turnover_status' | 'net_assets' | 'net_assets_status' | 'figures_period_end'
  > | null
  const merged: CompanyFactsRow =
    prior && prior.figures_period_end && prior.figures_period_end === row.last_accounts_made_up_to
      ? { ...row, ...prior }
      : row

  const up = await db.from('company_facts').upsert(merged, { onConflict: 'company_number' })
  if (up.error) throw new Error(`store facts: ${up.error.message}`)
  return merged
}

// Link a brand to its UK trading company. Fetches the profile first, so a confirmed link
// always has facts behind it (brand_companies references company_facts).
export async function confirmBrandCompany(
  db: SupabaseClient,
  brandId: string,
  rawCompanyNumber: string,
  confirmedBy: string
): Promise<CompanyFactsRow> {
  const facts = await refreshCompanyFacts(db, rawCompanyNumber)
  const link = await db.from('brand_companies').upsert(
    {
      brand_id: brandId,
      company_number: facts.company_number,
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id' }
  )
  if (link.error) throw new Error(`link brand: ${link.error.message}`)
  return facts
}

export async function unlinkBrandCompany(db: SupabaseClient, brandId: string): Promise<void> {
  const del = await db.from('brand_companies').delete().eq('brand_id', brandId)
  if (del.error) throw new Error(`unlink brand: ${del.error.message}`)
}
