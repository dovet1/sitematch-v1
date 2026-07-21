import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Promote a legacy `brand_contacts` row with contact_kind='agency' into a first-class
// directory agent plus a brand_agents edge.
//
// The dialog runs in the browser and cannot call promote_brand_contact_to_agent directly —
// that RPC has EXECUTE revoked from anon/authenticated and granted only to service_role.
// This route is the gate in front of it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id: brandId } = await params
    const body = await request.json()

    if (!body.contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }
    // An agent must be either matched to an existing row or created under a named agency;
    // the RPC would otherwise create a dangling agent with no firm.
    if (!body.agent_id && !body.agency_id && !body.agency_name) {
      return NextResponse.json(
        { error: 'Provide agent_id, or agency_id / agency_name to create the agent under' },
        { status: 400 }
      )
    }

    const supabase = adminClient()

    // Confirm the contact belongs to this brand before promoting — the brand id comes from
    // the URL and the contact id from the body, so they must be checked against each other.
    const { data: contact, error: contactError } = await supabase
      .from('brand_contacts')
      .select('id, brand_id')
      .eq('id', body.contact_id)
      .single()
    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    if ((contact as { brand_id: string }).brand_id !== brandId) {
      return NextResponse.json(
        { error: 'Contact does not belong to this brand' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('promote_brand_contact_to_agent', {
      p_contact_id: body.contact_id,
      p_payload: {
        agency_id: body.agency_id || null,
        agency_name: body.agency_name || null,
        agency_website: body.agency_website || null,
        agency_domain: body.agency_domain || null,
        agent_id: body.agent_id || null,
        agent_name: body.agent_name || null,
        agent_title: body.agent_title || null,
        agent_email: body.agent_email || null,
        agent_phone: body.agent_phone || null,
        agent_linkedin_url: body.agent_linkedin_url || null,
        role_note: body.role_note || null,
        // Defaults to false: the existing brand info modal still reads brand_contacts, so
        // removing the row would blank a contact card on an already-shipped surface.
        remove_contact: Boolean(body.remove_contact),
      },
    })
    if (error) throw error

    return NextResponse.json({ agentId: data })
  } catch (error) {
    return adminError('Error promoting brand contact', error)
  }
}
