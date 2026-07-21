import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'
import { normalizeDomain, validateDomain } from '@/lib/clearbit-logo'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const q = request.nextUrl.searchParams.get('q')?.trim()
    const supabase = adminClient()

    let query = supabase
      .from('directory_agencies')
      .select('id, name, website, domain, logo_url, directory_agents(count)')
      .order('name', { ascending: true })
      .limit(200)

    if (q) query = query.ilike('name', `%${q}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ agencies: data || [] })
  } catch (error) {
    return adminError('Error listing directory agencies', error)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUpdate(body: Record<string, any>): Record<string, unknown> | NextResponse {
  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    update.name = name
  }
  if ('website' in body) update.website = body.website || null
  if ('logo_url' in body) update.logo_url = body.logo_url || null
  if ('domain' in body) {
    // Same treatment as brands.domain — a bare hostname for the logo.dev lookup.
    const d = body.domain ? normalizeDomain(body.domain) : ''
    if (d && !validateDomain(d)) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }
    update.domain = d || null
  }
  return update
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const body = await request.json()
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const built = buildUpdate(body)
    if (built instanceof NextResponse) return built

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('directory_agencies')
      .insert(built)
      .select('id, name')
      .single()
    if (error) throw error

    return NextResponse.json({ agency: data })
  } catch (error) {
    return adminError('Error creating directory agency', error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const built = buildUpdate(body)
    if (built instanceof NextResponse) return built
    if (Object.keys(built).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('directory_agencies')
      .update(built)
      .eq('id', body.id)
      .select('id, name')
      .single()
    if (error) throw error

    return NextResponse.json({ agency: data })
  } catch (error) {
    return adminError('Error updating directory agency', error)
  }
}

// Agents keep existing when their agency is deleted (agency_id is ON DELETE SET NULL) —
// losing the firm should not silently remove people from brand profiles.
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = adminClient()
    const { error } = await supabase.from('directory_agencies').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminError('Error deleting directory agency', error)
  }
}
