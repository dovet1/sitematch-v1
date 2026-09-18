import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isCompaniesHouseConfigured } from '@/lib/companies-house/client'
import { refreshCompanyFacts } from '@/lib/companies-house/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Companies House allows 600 requests per 5 minutes; one profile fetch per company, spaced so
// a full run stays well under that and inside the function's 300s.
const SPACING_MS = 450
const BUDGET_MS = 270_000

/**
 * Weekly refresh of Companies House facts for every company an admin has linked to a brand.
 * Oldest-fetched first, so a run cut short by the time budget picks up where the last left off.
 * A company that fails is reported and skipped; its previous facts stay in place.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isCompaniesHouseConfigured()) {
    return NextResponse.json({ error: 'COMPANIES_HOUSE_KEY is not set' }, { status: 500 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await db
    .from('brand_companies')
    .select('company_number, company_facts(fetched_at)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const numbers = Array.from(
    new Map(
      ((data ?? []) as unknown as { company_number: string; company_facts: { fetched_at: string } | null }[]).map(
        (r) => [r.company_number, r.company_facts?.fetched_at ?? '']
      )
    )
  )
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([n]) => n)

  const started = Date.now()
  let refreshed = 0
  const failures: { companyNumber: string; error: string }[] = []
  for (const companyNumber of numbers) {
    if (Date.now() - started > BUDGET_MS) break
    try {
      await refreshCompanyFacts(db, companyNumber)
      refreshed++
    } catch (e) {
      failures.push({ companyNumber, error: e instanceof Error ? e.message : String(e) })
    }
    await new Promise((r) => setTimeout(r, SPACING_MS))
  }

  return NextResponse.json({
    companies: numbers.length,
    refreshed,
    failed: failures.length,
    skippedForTime: numbers.length - refreshed - failures.length,
    failures: failures.slice(0, 20),
  })
}
