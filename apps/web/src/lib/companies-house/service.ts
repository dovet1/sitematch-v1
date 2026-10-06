// Server-side Companies House operations against our tables. Callers pass a service-role
// client (admin routes, the refresh cron, the suggestion script); all three tables are
// service-role only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseIxbrlFigures } from './accounts'
import {
  getAccountsFilings,
  getCompanyProfile,
  getDocumentBytes,
  getDocumentContent,
  getDocumentMetadata,
  searchCompanies,
} from './client'
import { normaliseCompanyNumber, profileToFactsRow, rankCandidates, suggestionQueries } from './facts'
import { MAX_SCANNED_PAGES, readScannedFigures, SCANNED_ACCOUNTS_MODEL } from './scanned-accounts'
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

const IXBRL = 'application/xhtml+xml'
const PDF = 'application/pdf'

type FiguresFields = Pick<
  CompanyFactsRow,
  'turnover' | 'turnover_status' | 'net_assets' | 'net_assets_status' | 'turnover_page' | 'net_assets_page' | 'figures_model'
>

// Turnover and net assets from the latest accounts: iXBRL tags where CH holds them, otherwise a
// model reading of the PDF (scanned-accounts.ts). Only the figures that were read are returned.
// null when the latest filing is not for the expected accounts date, or has neither format.
export async function readAccountsFigures(
  companyNumber: string,
  madeUpTo: string
): Promise<Partial<FiguresFields> | null> {
  const filings = await getAccountsFilings(companyNumber)
  const latest = filings.find((f) => f.type === 'AA' && f.links?.document_metadata)
  if (!latest?.links?.document_metadata || latest.description_values?.made_up_date !== madeUpTo) return null
  const meta = await getDocumentMetadata(latest.links.document_metadata)
  if (!meta?.resources) return null

  if (IXBRL in meta.resources) {
    const xhtml = await getDocumentContent(latest.links.document_metadata, IXBRL)
    const figures = parseIxbrlFigures(xhtml, madeUpTo)
    return {
      ...(figures.turnover != null ? { turnover: figures.turnover, turnover_status: 'filed' as const } : {}),
      ...(figures.netAssets != null ? { net_assets: figures.netAssets, net_assets_status: 'filed' as const } : {}),
    }
  }

  if (!(PDF in meta.resources) || !meta.pages || meta.pages > MAX_SCANNED_PAGES) return null
  const pdf = await getDocumentBytes(latest.links.document_metadata, PDF)
  const f = await readScannedFigures(pdf, { companyNumber, madeUpTo, pages: meta.pages })
  if (!f) return {}
  return {
    ...(f.turnover != null
      ? { turnover: f.turnover, turnover_status: 'extracted' as const, turnover_page: f.turnoverPage }
      : {}),
    ...(f.netAssets != null
      ? { net_assets: f.netAssets, net_assets_status: 'extracted' as const, net_assets_page: f.netAssetsPage }
      : {}),
    ...(f.turnover != null || f.netAssets != null ? { figures_model: SCANNED_ACCOUNTS_MODEL } : {}),
  }
}

// Fetch a company's profile from CH and upsert its facts row. Figures already read for the
// same accounts period are kept — a profile refresh must not wipe what a reader found. New
// accounts are read once: figures that were read become 'filed' or 'extracted'; anything else
// stays 'unread' (figures_period_end then marks the period as checked, so it is not re-read
// every week).
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
    .select('turnover, turnover_status, net_assets, net_assets_status, turnover_page, net_assets_page, figures_model, figures_period_end')
    .eq('company_number', companyNumber)
    .maybeSingle()
  if (existing.error) throw new Error(`read facts: ${existing.error.message}`)
  const prior = existing.data as (FiguresFields & Pick<CompanyFactsRow, 'figures_period_end'>) | null
  let merged: CompanyFactsRow =
    prior && prior.figures_period_end && prior.figures_period_end === row.last_accounts_made_up_to
      ? { ...row, ...prior }
      : row
  if (merged === row && row.last_accounts_made_up_to) {
    const madeUpTo = row.last_accounts_made_up_to
    // A failed read leaves the figures unread and is retried next refresh; the profile still saves.
    const read = await readAccountsFigures(companyNumber, madeUpTo).catch(() => undefined)
    if (read !== undefined) merged = { ...row, figures_period_end: madeUpTo, ...read }
  }

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
