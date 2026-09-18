import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminError } from '@/lib/admin-auth'
import {
  CompaniesHouseConfigError,
  CompaniesHouseError,
  searchCompanies,
} from '@/lib/companies-house/client'

export const dynamic = 'force-dynamic'

// Free-text Companies House search for the admin picker, when no stored suggestion is right.
// Results are shown, not stored; confirming one goes through PUT ../company.
export async function GET(request: NextRequest) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ items: [] })
  try {
    const items = await searchCompanies(q, 20)
    return NextResponse.json({
      items: items.map((i) => ({
        company_number: i.company_number,
        company_name: i.title,
        company_status: i.company_status ?? null,
        company_type: i.company_type ?? null,
        address_snippet: i.address_snippet ?? null,
        date_of_creation: i.date_of_creation ?? null,
      })),
    })
  } catch (error) {
    if (error instanceof CompaniesHouseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof CompaniesHouseError && error.status === 429) {
      return NextResponse.json({ error: 'Companies House rate limit hit — try again in a minute' }, { status: 429 })
    }
    return adminError('Companies House search', error)
  }
}
