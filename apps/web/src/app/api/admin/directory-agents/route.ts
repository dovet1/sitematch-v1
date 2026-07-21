import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const EDITABLE = [
  'agency_id',
  'name',
  'title',
  'email',
  'phone',
  'linkedin_url',
  'headshot_url',
  'region',
  'focus',
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickEditable(body: Record<string, any>) {
  const update: Record<string, unknown> = {}
  for (const f of EDITABLE) {
    if (f in body) update[f] = body[f] || null
  }
  return update
}

// List agents, optionally filtered by a search term (used by the attach + promote dialogs).
export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const q = request.nextUrl.searchParams.get('q')?.trim()
    const supabase = adminClient()

    let query = supabase
      .from('directory_agents')
      .select(
        'id, agency_id, name, title, email, phone, linkedin_url, region, focus, directory_agencies(id, name), brand_agents(count)'
      )
      .order('name', { ascending: true })
      .limit(200)

    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ agents: data || [] })
  } catch (error) {
    return adminError('Error listing directory agents', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const body = await request.json()
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('directory_agents')
      .insert({ ...pickEditable(body), name: body.name.trim() })
      .select('id, name')
      .single()
    if (error) throw error

    return NextResponse.json({ agent: data })
  } catch (error) {
    return adminError('Error creating directory agent', error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const update = pickEditable(body)
    if ('name' in update && !String(update.name || '').trim()) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('directory_agents')
      .update(update)
      .eq('id', body.id)
      .select('id, name')
      .single()
    if (error) throw error

    return NextResponse.json({ agent: data })
  } catch (error) {
    return adminError('Error updating directory agent', error)
  }
}

// Deleting an agent cascades its brand_agents edges (ON DELETE CASCADE), removing it from
// every brand profile it appeared on.
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = adminClient()
    const { error } = await supabase.from('directory_agents').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminError('Error deleting directory agent', error)
  }
}
