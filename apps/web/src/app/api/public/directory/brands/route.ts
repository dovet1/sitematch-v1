import { NextResponse } from 'next/server'
import {
  requirePlusAccess,
  directoryAdminClient,
  formatCategory,
  BRAND_CARD_CAP,
} from '@/lib/directory'
import type {
  DirectoryBrandCard,
  DirectoryList,
} from '@/app/sitematcher-unified/types/unified-workspace'

export const dynamic = 'force-dynamic'

// Directory grid payload. One RPC call — directory_brand_cards() pre-aggregates each count
// in its own CTE, so a brand with 400 stores and 3 contacts reports 3 contacts, not 1200.
export async function GET() {
  try {
    const gate = await requirePlusAccess()
    if (gate.error) return gate.error

    const supabase = directoryAdminClient()
    const { data, error } = await supabase.rpc('directory_brand_cards')
    if (error) throw error

    const rows = (data || []) as {
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
    }[]

    const truncated = rows.length > BRAND_CARD_CAP
    const items: DirectoryBrandCard[] = rows.slice(0, BRAND_CARD_CAP).map((r) => ({
      id: r.id,
      name: r.name,
      logoUrl: r.logo_url,
      domain: r.domain,
      websiteUrl: r.website_url,
      category: formatCategory(r.category_child, r.category_parent),
      storeCount: Number(r.store_count),
      inHouseCount: Number(r.in_house_count),
      agentCount: Number(r.agent_count),
      hasActiveRequirement: r.has_active_requirement,
    }))

    const payload: DirectoryList<DirectoryBrandCard> = { items, truncated }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching directory brands:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
