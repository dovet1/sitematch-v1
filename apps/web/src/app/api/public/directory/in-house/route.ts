import { NextResponse } from 'next/server'
import { requirePlusAccess, directoryAdminClient, IN_HOUSE_CAP } from '@/lib/directory'
import type {
  DirectoryTeamMember,
  DirectoryList,
} from '@/app/sitematcher-unified/types/unified-workspace'

export const dynamic = 'force-dynamic'

// Flat list of every in-house contact, tagged with its brand — the In-house teams tab.
//
// This endpoint is required, not a convenience: /directory/brands returns only an
// in_house_count per brand, so there is nothing in the loaded card list to flatten, and
// fetching every brand detail to assemble the tab would reintroduce the N+1 that
// directory_brand_cards() exists to avoid.
export async function GET() {
  try {
    const gate = await requirePlusAccess()
    if (gate.error) return gate.error

    const supabase = directoryAdminClient()

    // Fetch one over the cap so `truncated` is accurate without a second count query.
    const { data, error } = await supabase
      .from('brand_contacts')
      .select(
        'id, brand_id, contact_name, contact_title, contact_org, contact_email, contact_phone, contact_kind, linkedin_url, brands!inner(id, name, logo_url)'
      )
      .or('contact_kind.is.null,contact_kind.eq.in-house')
      .limit(IN_HOUSE_CAP + 1)
    if (error) throw error

    const rows = (data || []) as unknown as {
      id: string
      brand_id: string
      contact_name: string | null
      contact_title: string | null
      contact_org: string | null
      contact_email: string | null
      contact_phone: string | null
      linkedin_url: string | null
      brands: { id: string; name: string; logo_url: string | null } | null
    }[]

    const truncated = rows.length > IN_HOUSE_CAP
    const items: DirectoryTeamMember[] = rows
      .slice(0, IN_HOUSE_CAP)
      .filter((r) => r.brands !== null)
      .map((r) => ({
        id: r.id,
        name: r.contact_name,
        title: r.contact_title,
        org: r.contact_org,
        email: r.contact_email,
        phone: r.contact_phone,
        linkedinUrl: r.linkedin_url,
        kind: 'in-house' as const,
        brandId: r.brand_id,
        brandName: r.brands!.name,
        brandLogoUrl: r.brands!.logo_url,
      }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName))

    const payload: DirectoryList<DirectoryTeamMember> = { items, truncated }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching directory in-house contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
