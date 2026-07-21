import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Agents attached to a brand (the brand_agents edge).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const supabase = adminClient()

    const { data, error } = await supabase
      .from('brand_agents')
      .select(
        'id, role_note, display_order, directory_agents(id, name, title, email, phone, linkedin_url, directory_agencies(id, name))'
      )
      .eq('brand_id', id)
      .order('display_order', { ascending: true })
    if (error) throw error

    return NextResponse.json({ agents: data || [] })
  } catch (error) {
    return adminError('Error fetching brand agents', error)
  }
}

// Attach an existing directory agent to this brand.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const body = await request.json()
    if (!body.agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('brand_agents')
      .upsert(
        {
          brand_id: id,
          agent_id: body.agent_id,
          role_note: body.role_note || null,
          display_order: typeof body.display_order === 'number' ? body.display_order : 0,
        },
        { onConflict: 'brand_id,agent_id' }
      )
      .select('id')
      .single()
    if (error) throw error

    return NextResponse.json({ brandAgent: data })
  } catch (error) {
    return adminError('Error attaching brand agent', error)
  }
}

// Detach an agent. Removes only the edge — the directory_agents row survives because the
// same agent may act for other brands.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const agentId = request.nextUrl.searchParams.get('agent_id')
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const supabase = adminClient()
    const { error } = await supabase
      .from('brand_agents')
      .delete()
      .eq('brand_id', id)
      .eq('agent_id', agentId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminError('Error detaching brand agent', error)
  }
}
