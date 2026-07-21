import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess, directoryAdminClient, formatCategory } from '@/lib/directory'
import type {
  DirectoryAgentProfile,
  DirectoryBrandCard,
} from '@/app/sitematcher-unified/types/unified-workspace'

export const dynamic = 'force-dynamic'

// Agent profile — the reverse side of brand_agents. Resolving "which other brands does this
// agent represent" is the whole reason the edge is a normalised table rather than the
// free-text contact_org it replaced.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlusAccess()
    if (gate.error) return gate.error

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    const supabase = directoryAdminClient()

    const { data: agentRow, error: agentError } = await supabase
      .from('directory_agents')
      .select(
        'id, name, title, email, phone, linkedin_url, region, focus, directory_agencies(id, name)'
      )
      .eq('id', id)
      .single()
    if (agentError || !agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const { data: edges } = await supabase
      .from('brand_agents')
      .select('brand_id')
      .eq('agent_id', id)

    const brandIds = ((edges || []) as { brand_id: string }[]).map((e) => e.brand_id)

    // Reuse the grid aggregate so the agent profile's brand cards are identical to the
    // grid's — same counts, same category, same status kicker.
    let brands: DirectoryBrandCard[] = []
    if (brandIds.length > 0) {
      const { data: cards, error: cardsError } = await supabase.rpc('directory_brand_cards')
      if (cardsError) throw cardsError
      const wanted = new Set(brandIds)
      brands = ((cards || []) as {
        id: string
        name: string
        logo_url: string | null
        domain: string | null
        website_url: string | null
        category_child: string | null
        category_parent: string | null
        store_count: number
        in_house_count: number
        agent_count: number
        has_active_requirement: boolean
      }[])
        .filter((c) => wanted.has(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          logoUrl: c.logo_url,
          domain: c.domain,
          websiteUrl: c.website_url,
          category: formatCategory(c.category_child, c.category_parent),
          storeCount: Number(c.store_count),
          inHouseCount: Number(c.in_house_count),
          agentCount: Number(c.agent_count),
          hasActiveRequirement: c.has_active_requirement,
        }))
    }

    const agency = (agentRow as unknown as {
      directory_agencies: { id: string; name: string } | null
    }).directory_agencies

    const payload: DirectoryAgentProfile = {
      agent: {
        id: agentRow.id,
        name: agentRow.name,
        title: agentRow.title,
        firm: agency?.name ?? null,
        firmId: agency?.id ?? null,
        email: agentRow.email,
        phone: agentRow.phone,
        linkedinUrl: agentRow.linkedin_url,
        region: agentRow.region,
        focus: agentRow.focus,
        brandCount: brands.length,
      },
      brands,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching directory agent profile:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
