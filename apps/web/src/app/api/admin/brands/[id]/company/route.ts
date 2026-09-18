import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'
import {
  CompaniesHouseConfigError,
  CompaniesHouseError,
  isCompaniesHouseConfigured,
} from '@/lib/companies-house/client'
import {
  CompanyNotFoundError,
  confirmBrandCompany,
  refreshCompanyFacts,
  suggestCompaniesForBrand,
  unlinkBrandCompany,
} from '@/lib/companies-house/service'

export const dynamic = 'force-dynamic'

/**
 * A brand's Companies House link — the admin side of Brand Matcher's trading facts.
 *
 *   GET     link + cached facts + stored suggestions
 *   POST    { action: 'suggest' }  re-run the CH search for candidates
 *           { action: 'refresh' }  re-fetch the linked company's profile
 *   PUT     { companyNumber }      confirm the brand's UK trading company
 *   DELETE                         remove the link (facts row is kept; other brands may share it)
 *
 * Nothing reaches Brand Matcher until an admin confirms here.
 */

type Params = { params: Promise<{ id: string }> }

function chError(context: string, error: unknown) {
  if (error instanceof CompaniesHouseConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }
  if (error instanceof CompanyNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof CompaniesHouseError && error.status === 429) {
    return NextResponse.json({ error: 'Companies House rate limit hit — try again in a minute' }, { status: 429 })
  }
  return adminError(context, error)
}

async function loadState(brandId: string) {
  const db = adminClient()
  const [link, suggestions] = await Promise.all([
    db
      .from('brand_companies')
      .select('company_number, confirmed_at, confirmed_by, company_facts(*)')
      .eq('brand_id', brandId)
      .maybeSingle(),
    db
      .from('brand_company_suggestions')
      .select('company_number, company_name, company_status, company_type, address_snippet, date_of_creation, rank, score, searched_at')
      .eq('brand_id', brandId)
      .order('rank'),
  ])
  if (link.error) throw new Error(`link: ${link.error.message}`)
  if (suggestions.error) throw new Error(`suggestions: ${suggestions.error.message}`)
  return {
    configured: isCompaniesHouseConfigured(),
    link: link.data,
    suggestions: suggestions.data ?? [],
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error
  try {
    const { id } = await params
    return NextResponse.json(await loadState(id))
  } catch (error) {
    return adminError('Load brand company', error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error
  try {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as { action?: string } | null
    const db = adminClient()

    if (body?.action === 'suggest') {
      const { data: brand, error } = await db.from('brands').select('id, name').eq('id', id).maybeSingle()
      if (error) throw new Error(`brand: ${error.message}`)
      if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
      await suggestCompaniesForBrand(db, brand as { id: string; name: string })
    } else if (body?.action === 'refresh') {
      const { data: link, error } = await db
        .from('brand_companies')
        .select('company_number')
        .eq('brand_id', id)
        .maybeSingle()
      if (error) throw new Error(`link: ${error.message}`)
      if (!link) return NextResponse.json({ error: 'Brand has no linked company' }, { status: 400 })
      await refreshCompanyFacts(db, (link as { company_number: string }).company_number)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json(await loadState(id))
  } catch (error) {
    return chError('Brand company action', error)
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error
  try {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as { companyNumber?: unknown } | null
    if (typeof body?.companyNumber !== 'string') {
      return NextResponse.json({ error: 'companyNumber is required' }, { status: 400 })
    }
    await confirmBrandCompany(adminClient(), id, body.companyNumber, gate.user.id)
    return NextResponse.json(await loadState(id))
  } catch (error) {
    return chError('Confirm brand company', error)
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error
  try {
    const { id } = await params
    await unlinkBrandCompany(adminClient(), id)
    return NextResponse.json(await loadState(id))
  } catch (error) {
    return adminError('Unlink brand company', error)
  }
}
