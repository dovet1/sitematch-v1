import { NextRequest, NextResponse } from 'next/server'
import { fetchBrandStoreEstate, fetchBrandCategory } from '@/lib/brand-estate'
import {
  requirePlusAccess,
  directoryAdminClient,
  applyActiveRequirementOrder,
  toInHouseContacts,
  toAgentContacts,
  toTargets,
  toTargetNames,
} from '@/lib/directory'
import type {
  DirectoryBrandProfile,
  DirectoryRequirement,
  DirectoryActivityEvent,
} from '@/app/sitematcher-unified/types/unified-workspace'

export const dynamic = 'force-dynamic'

// Explicit shapes for each query result — directoryAdminClient() is untyped (see the note
// on it in lib/directory.ts), so these are where the type safety actually comes from.
interface BrandRow {
  id: string
  name: string
  logo_url: string | null
  domain: string | null
  website_url: string | null
  store_locator_url: string | null
}

interface RequirementRow {
  id: string
  description: string | null
  listing_type: string | null
  site_size_min: number | null
  site_size_max: number | null
  size_seen_sqft: number | null
  size_seen_basis: string | null
  verified_at: string | null
  brochure_url: string | null
}

interface ActivityRow {
  id: string
  kind: 'opening' | 'closure'
  event_date: string
  is_upcoming: boolean
  headline: string
  url: string | null
}

// Full brand profile for the directory. No per-row is_featured_free gating here: the whole
// directory is Plus-only (see requirePlusAccess), so everyone who reaches this endpoint may
// see every active requirement.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlusAccess()
    if (gate.error) return gate.error

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 })
    }

    const supabase = directoryAdminClient()

    const { data: brandRow, error: brandError } = (await supabase
      .from('brands')
      .select('id, name, logo_url, domain, website_url, store_locator_url')
      .eq('id', id)
      .single()) as { data: BrandRow | null; error: unknown }
    if (brandError || !brandRow) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Deterministic active-requirement pick (see applyActiveRequirementOrder).
    const reqQuery = applyActiveRequirementOrder(
      supabase
        .from('requirements')
        .select(
          'id, description, listing_type, site_size_min, site_size_max, size_seen_sqft, size_seen_basis, verified_at, brochure_url'
        )
        .eq('brand_id', id)
        .eq('status', 'active')
    ).limit(1)

    const [estate, category, { data: reqRows }, { data: contactRows }, { data: agentRows }, { data: activityRows }] =
      await Promise.all([
        fetchBrandStoreEstate(supabase, id),
        fetchBrandCategory(supabase, id),
        reqQuery,
        supabase
          .from('brand_contacts')
          .select(
            'id, contact_name, contact_title, contact_org, contact_email, contact_phone, contact_kind, linkedin_url'
          )
          .eq('brand_id', id)
          .order('is_primary_contact', { ascending: false }),
        supabase
          .from('brand_agents')
          .select(
            'role_note, display_order, directory_agents(id, name, title, email, phone, linkedin_url, directory_agencies(id, name))'
          )
          .eq('brand_id', id),
        supabase
          .from('brand_activity')
          .select('id, kind, event_date, is_upcoming, headline, url')
          .eq('brand_id', id)
          .order('event_date', { ascending: false })
          .limit(8),
      ])

    const reqRow: RequirementRow | null =
      reqRows && reqRows.length > 0 ? (reqRows[0] as RequirementRow) : null

    let requirement: DirectoryRequirement | null = null
    if (reqRow) {
      const [{ data: locationRows }, { data: useClassRows }] = await Promise.all([
        supabase
          .from('requirement_locations')
          .select('id, place_name, formatted_address, coordinates')
          .eq('requirement_id', reqRow.id),
        supabase
          .from('requirement_use_classes')
          .select('use_classes(code, name)')
          .eq('requirement_id', reqRow.id),
      ])

      requirement = {
        id: reqRow.id,
        sizeMin: reqRow.site_size_min,
        sizeMax: reqRow.site_size_max,
        sizeSeenSqft: reqRow.size_seen_sqft,
        sizeSeenBasis: reqRow.size_seen_basis,
        summary: reqRow.description,
        listingType: reqRow.listing_type,
        useClasses: ((useClassRows || []) as unknown as { use_classes: { code: string; name: string } | null }[])
          .map((u) => u.use_classes?.name || u.use_classes?.code)
          .filter((n): n is string => Boolean(n)),
        verifiedAt: reqRow.verified_at,
        brochureUrl: reqRow.brochure_url,
        targets: toTargets(locationRows),
        targetNames: toTargetNames(locationRows),
      }
    }

    const activity: DirectoryActivityEvent[] = ((activityRows || []) as ActivityRow[]).map((a) => ({
      id: a.id,
      kind: a.kind,
      eventDate: a.event_date,
      isUpcoming: a.is_upcoming,
      headline: a.headline,
      url: a.url,
    }))

    const payload: DirectoryBrandProfile = {
      brand: {
        id: brandRow.id,
        name: brandRow.name,
        logoUrl: brandRow.logo_url,
        domain: brandRow.domain,
        websiteUrl: brandRow.website_url,
        storeLocatorUrl: brandRow.store_locator_url,
        category,
        storeCount: estate.storeCount,
        latestStore: estate.latestStore,
        stores: estate.stores,
      },
      requirement,
      contacts: toInHouseContacts(contactRows),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agents: toAgentContacts(agentRows as any, brandRow.name),
      activity,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching directory brand profile:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
