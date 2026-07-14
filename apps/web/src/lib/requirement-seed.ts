// Helper A: turn an approved `listings` row into a normalized requirement seed, sourced
// from the live version content (falling back to base child tables), mirroring
// /api/public/listings/[id]/detailed. Used by the backfill script only. The caller
// resolves brand_id and passes the seed to the upsert_requirement_from_seed RPC.

export interface RequirementSeedLocation {
  place_name: string | null
  formatted_address: string | null
  coordinates: unknown
  region: string | null
  country: string | null
}

export interface RequirementSeedContact {
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_area: string | null
  contact_org: string | null
  contact_kind: 'in-house' | 'agency' | null
  headshot_url: string | null
  is_primary_contact: boolean
}

export interface RequirementSeed {
  source_listing_id: string
  brand_id: string | null
  company_name: string
  title: string | null
  description: string | null
  listing_type: string | null
  site_size_min: number | null
  site_size_max: number | null
  site_acreage_min: number | null
  site_acreage_max: number | null
  dwelling_count_min: number | null
  dwelling_count_max: number | null
  brochure_url: string | null
  property_page_link: string | null
  company_domain: string | null
  clearbit_logo: boolean
  is_featured_free: boolean
  verified_at: string | null
  status: string
  locations: RequirementSeedLocation[]
  contacts: RequirementSeedContact[]
  sectors: string[]
  use_classes: string[]
}

const LISTING_BASE_COLUMNS = `
  id, company_name, company_domain, clearbit_logo, title, description, listing_type,
  site_size_min, site_size_max, site_acreage_min, site_acreage_max,
  dwelling_count_min, dwelling_count_max, property_page_link, verified_at,
  is_featured_free, live_version_id
`

function brochureUrlFromFiles(files: any[]): string | null {
  const brochure = files.find((f) => f?.file_type === 'brochure')
  if (!brochure) return null
  if (typeof brochure.external_url === 'string' && brochure.external_url) {
    return brochure.external_url
  }
  if (typeof brochure.file_path === 'string' && brochure.file_path.startsWith('http')) {
    return brochure.file_path
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base || !brochure.bucket_name || !brochure.file_path) return null
  return `${base}/storage/v1/object/public/${brochure.bucket_name}/${brochure.file_path}`
}

function mapContact(c: any): RequirementSeedContact {
  return {
    contact_name: c?.contact_name ?? null,
    contact_title: c?.contact_title ?? null,
    contact_email: c?.contact_email ?? null,
    contact_phone: c?.contact_phone ?? null,
    contact_area: c?.contact_area ?? null,
    contact_org: c?.contact_org ?? null,
    contact_kind:
      c?.contact_kind === 'in-house' || c?.contact_kind === 'agency'
        ? c.contact_kind
        : null,
    headshot_url: c?.headshot_url ?? null,
    is_primary_contact: Boolean(c?.is_primary_contact),
  }
}

function mapLocation(l: any): RequirementSeedLocation {
  return {
    place_name: l?.place_name ?? null,
    formatted_address: l?.formatted_address ?? null,
    coordinates: l?.coordinates ?? null,
    region: l?.region ?? null,
    country: l?.country ?? null,
  }
}

async function loadLiveVersionContent(supabase: any, listing: any): Promise<any | null> {
  let versionRow: any = null

  if (listing.live_version_id) {
    const { data } = await supabase
      .from('listing_versions')
      .select('content')
      .eq('id', listing.live_version_id)
      .eq('status', 'approved')
      .single()
    versionRow = data ?? null
  }

  if (!versionRow) {
    const { data } = await supabase
      .from('listing_versions')
      .select('content')
      .eq('listing_id', listing.id)
      .eq('status', 'approved')
      .order('version_number', { ascending: false })
      .limit(1)
      .single()
    versionRow = data ?? null
  }

  if (!versionRow) return null
  return typeof versionRow.content === 'string'
    ? JSON.parse(versionRow.content)
    : versionRow.content
}

function seedFromVersion(listing: any, content: any): RequirementSeed {
  const listingData = content.listing || {}
  const locations = (content.locations || []) as any[]
  const contacts = (content.contacts || []) as any[]
  const files = (content.files || []) as any[]
  const sectors = (content.sectors || [])
    .map((s: any) => s?.sector?.id)
    .filter((id: any): id is string => Boolean(id))
  const useClasses = (content.use_classes || [])
    .map((uc: any) => uc?.use_class?.id)
    .filter((id: any): id is string => Boolean(id))

  return {
    source_listing_id: listing.id,
    brand_id: null,
    company_name: listingData.company_name ?? listing.company_name,
    title: listingData.title ?? null,
    description: listingData.description ?? null,
    listing_type: listingData.listing_type ?? null,
    site_size_min: listingData.site_size_min ?? null,
    site_size_max: listingData.site_size_max ?? null,
    site_acreage_min: listingData.site_acreage_min ?? null,
    site_acreage_max: listingData.site_acreage_max ?? null,
    dwelling_count_min: listingData.dwelling_count_min ?? null,
    dwelling_count_max: listingData.dwelling_count_max ?? null,
    brochure_url: brochureUrlFromFiles(files),
    property_page_link: listingData.property_page_link ?? null,
    company_domain: listingData.company_domain ?? null,
    clearbit_logo: Boolean(listingData.clearbit_logo),
    // is_featured_free lives only on the base listings table, not in version content.
    is_featured_free: Boolean(listing.is_featured_free),
    verified_at: listing.verified_at ?? null,
    status: 'active',
    locations: locations.map(mapLocation),
    contacts: contacts.map(mapContact),
    sectors,
    use_classes: useClasses,
  }
}

async function seedFromBaseTables(supabase: any, listing: any): Promise<RequirementSeed> {
  const [
    { data: locations },
    { data: contacts },
    { data: files },
    { data: listingSectors },
    { data: listingUseClasses },
  ] = await Promise.all([
    supabase
      .from('listing_locations')
      .select('place_name, formatted_address, coordinates, region, country')
      .eq('listing_id', listing.id),
    supabase
      .from('listing_contacts')
      .select('contact_name, contact_title, contact_email, contact_phone, contact_area, headshot_url, is_primary_contact')
      .eq('listing_id', listing.id),
    supabase
      .from('file_uploads')
      .select('file_type, file_path, bucket_name, external_url')
      .eq('listing_id', listing.id),
    supabase.from('listing_sectors').select('sector_id').eq('listing_id', listing.id),
    supabase.from('listing_use_classes').select('use_class_id').eq('listing_id', listing.id),
  ])

  return {
    source_listing_id: listing.id,
    brand_id: null,
    company_name: listing.company_name,
    title: listing.title ?? null,
    description: listing.description ?? null,
    listing_type: listing.listing_type ?? null,
    site_size_min: listing.site_size_min ?? null,
    site_size_max: listing.site_size_max ?? null,
    site_acreage_min: listing.site_acreage_min ?? null,
    site_acreage_max: listing.site_acreage_max ?? null,
    dwelling_count_min: listing.dwelling_count_min ?? null,
    dwelling_count_max: listing.dwelling_count_max ?? null,
    brochure_url: brochureUrlFromFiles(files || []),
    property_page_link: listing.property_page_link ?? null,
    company_domain: listing.company_domain ?? null,
    clearbit_logo: Boolean(listing.clearbit_logo),
    is_featured_free: Boolean(listing.is_featured_free),
    verified_at: listing.verified_at ?? null,
    status: 'active',
    locations: (locations || []).map(mapLocation),
    contacts: (contacts || []).map(mapContact),
    sectors: (listingSectors || [])
      .map((s: any) => s.sector_id)
      .filter((id: any): id is string => Boolean(id)),
    use_classes: (listingUseClasses || [])
      .map((uc: any) => uc.use_class_id)
      .filter((id: any): id is string => Boolean(id)),
  }
}

export async function listingToRequirementSeed(
  supabase: any,
  listingId: string
): Promise<RequirementSeed | null> {
  const { data: listing } = await supabase
    .from('listings')
    .select(LISTING_BASE_COLUMNS)
    .eq('id', listingId)
    .single()

  if (!listing) return null

  const content = await loadLiveVersionContent(supabase, listing)
  return content ? seedFromVersion(listing, content) : seedFromBaseTables(supabase, listing)
}
