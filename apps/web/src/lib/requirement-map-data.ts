export type NormalizedCoordinates = {
  lat: number
  lng: number
}

export type RequirementMapFilters = {
  companyName?: string
  sector?: string[]
  useClass?: string[]
  listingType?: string[]
  sizeMin?: number | null
  sizeMax?: number | null
  acreageMin?: number | null
  acreageMax?: number | null
  dwellingMin?: number | null
  dwellingMax?: number | null
}

export type RequirementMapFeature = {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    id: string
    location_id: string
    company_name: string
    title: string | null
    listing_type: string
    clearbit_logo: string | null
    company_domain: string | null
    logo_url: string | null
    // Raw uploaded logo (never a logo.dev URL). Only the requirements builder
    // populates this; used by /sitematcher-unified assess-area cards.
    uploaded_logo_url?: string | null
    sector: string | null
    use_class: string | null
    site_size_min: number | null
    site_size_max: number | null
    site_acreage_min: number | null
    site_acreage_max: number | null
    dwelling_count_min: number | null
    dwelling_count_max: number | null
    place_name: string | null
    formatted_address: string | null
    brand_id: string | null
  }
}

type ListingLocationRow = {
  id?: string | null
  place_name?: string | null
  formatted_address?: string | null
  coordinates?: unknown
}

type RequirementListingRow = {
  id: string
  company_name?: string | null
  title?: string | null
  listing_type?: string | null
  clearbit_logo?: string | null
  company_domain?: string | null
  site_size_min?: number | null
  site_size_max?: number | null
  site_acreage_min?: number | null
  site_acreage_max?: number | null
  dwelling_count_min?: number | null
  dwelling_count_max?: number | null
  listing_sectors?: Array<{ sector?: { name?: string | null } | null }> | null
  listing_use_classes?: Array<{ use_class?: { name?: string | null } | null }> | null
  listing_locations?: ListingLocationRow[] | null
}

const LISTING_PAGE_SIZE = 1000

export function normalizeRequirementCoordinates(coordinates: unknown): NormalizedCoordinates | null {
  let parsed = coordinates

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }

  let lat: unknown
  let lng: unknown

  if (Array.isArray(parsed)) {
    if (parsed.length !== 2) {
      return null
    }
    lng = parsed[0]
    lat = parsed[1]
  } else if (parsed && typeof parsed === 'object') {
    const coordinateObject = parsed as { lat?: unknown; lng?: unknown }
    lat = coordinateObject.lat
    lng = coordinateObject.lng
  } else {
    return null
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null
  }

  return { lat, lng }
}

export async function getRequirementMapFeatures(
  supabase: any,
  options: {
    isFreeTier: boolean
    filters?: RequirementMapFilters
  }
): Promise<RequirementMapFeature[]> {
  const filters = options.filters || {}
  const validListingIds = await getValidListingIdsForReferenceFilters(supabase, filters)
  const listings = await fetchRequirementListings(supabase, {
    isFreeTier: options.isFreeTier,
    filters,
    validListingIds
  })

  const logoData = await fetchLogoData(supabase, listings.map((listing) => listing.id))

  return listings.flatMap((listing) => {
    const locations = listing.listing_locations || []
    const primarySector = listing.listing_sectors?.[0]?.sector?.name || null
    const primaryUseClass = listing.listing_use_classes?.[0]?.use_class?.name || null

    return locations.flatMap((location) => {
      const coordinates = normalizeRequirementCoordinates(location.coordinates)
      if (!coordinates) {
        return []
      }

      return [{
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [coordinates.lng, coordinates.lat] as [number, number]
        },
        properties: {
          id: listing.id,
          location_id: location.id || `${listing.id}:${coordinates.lng},${coordinates.lat}`,
          company_name: listing.company_name || 'Unknown Company',
          title: listing.title || null,
          listing_type: listing.listing_type || 'commercial',
          clearbit_logo: listing.clearbit_logo || null,
          company_domain: listing.company_domain || null,
          logo_url: logoData[listing.id] || null,
          sector: primarySector,
          use_class: primaryUseClass,
          site_size_min: listing.site_size_min ?? null,
          site_size_max: listing.site_size_max ?? null,
          site_acreage_min: listing.site_acreage_min ?? null,
          site_acreage_max: listing.site_acreage_max ?? null,
          dwelling_count_min: listing.dwelling_count_min ?? null,
          dwelling_count_max: listing.dwelling_count_max ?? null,
          place_name: location.place_name || null,
          formatted_address: location.formatted_address || null,
          brand_id: null
        }
      }]
    })
  })
}

async function getValidListingIdsForReferenceFilters(
  supabase: any,
  filters: RequirementMapFilters
): Promise<string[] | null> {
  let validListingIds: string[] | null = null

  if (filters.sector && filters.sector.length > 0) {
    const { data, error } = await supabase
      .from('listing_sectors')
      .select(`
        listing_id,
        sectors!inner(name)
      `)
      .in('sectors.name', filters.sector)

    validListingIds = error ? [] : (data || []).map((row: { listing_id: string }) => row.listing_id)
  }

  if (filters.useClass && filters.useClass.length > 0) {
    const { data, error } = await supabase
      .from('listing_use_classes')
      .select(`
        listing_id,
        use_classes!inner(name)
      `)
      .in('use_classes.name', filters.useClass)

    const useClassListingIds = error ? [] : (data || []).map((row: { listing_id: string }) => row.listing_id)
    validListingIds = validListingIds !== null
      ? validListingIds.filter((id) => useClassListingIds.includes(id))
      : useClassListingIds
  }

  return validListingIds
}

async function fetchRequirementListings(
  supabase: any,
  options: {
    isFreeTier: boolean
    filters: RequirementMapFilters
    validListingIds: string[] | null
  }
): Promise<RequirementListingRow[]> {
  if (options.validListingIds !== null && options.validListingIds.length === 0) {
    return []
  }

  const listings: RequirementListingRow[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('listings')
      .select(`
        id,
        company_name,
        title,
        listing_type,
        clearbit_logo,
        company_domain,
        site_size_min,
        site_size_max,
        site_acreage_min,
        site_acreage_max,
        dwelling_count_min,
        dwelling_count_max,
        is_featured_free,
        listing_sectors(
          sector:sectors(
            name
          )
        ),
        listing_use_classes(
          use_class:use_classes(
            name
          )
        ),
        listing_locations(
          id,
          place_name,
          formatted_address,
          coordinates
        )
      `)
      .in('status', ['approved', 'pending', 'draft'])
      .range(from, from + LISTING_PAGE_SIZE - 1)

    if (options.isFreeTier) {
      query = query.eq('is_featured_free', true)
    }

    query = applyListingFilters(query, options.filters, options.validListingIds)

    const { data, error } = await query
    if (error) {
      throw error
    }

    const page = (data || []) as RequirementListingRow[]
    listings.push(...page)

    if (page.length < LISTING_PAGE_SIZE) {
      break
    }

    from += LISTING_PAGE_SIZE
  }

  return listings
}

function applyListingFilters(query: any, filters: RequirementMapFilters, validListingIds: string[] | null) {
  if (filters.companyName) {
    query = query.ilike('company_name', `%${filters.companyName}%`)
  }

  if (validListingIds !== null && validListingIds.length > 0) {
    query = query.in('id', validListingIds)
  }

  if (filters.listingType && filters.listingType.length > 0) {
    query = query.in('listing_type', filters.listingType)
  }

  if (filters.sizeMin !== null && filters.sizeMin !== undefined) {
    query = query.or(`site_size_max.gte.${filters.sizeMin},site_size_max.is.null`)
  }

  if (filters.sizeMax !== null && filters.sizeMax !== undefined) {
    query = query.or(`site_size_min.lte.${filters.sizeMax},site_size_min.is.null`)
  }

  const hasResidentialFilters =
    filters.acreageMin !== null && filters.acreageMin !== undefined ||
    filters.acreageMax !== null && filters.acreageMax !== undefined ||
    filters.dwellingMin !== null && filters.dwellingMin !== undefined ||
    filters.dwellingMax !== null && filters.dwellingMax !== undefined

  if (hasResidentialFilters) {
    query = query.neq('listing_type', 'commercial')
  }

  const hasCommercialFilters =
    (filters.sector && filters.sector.length > 0) ||
    (filters.useClass && filters.useClass.length > 0) ||
    filters.sizeMin !== null && filters.sizeMin !== undefined ||
    filters.sizeMax !== null && filters.sizeMax !== undefined

  if (hasCommercialFilters) {
    query = query.neq('listing_type', 'residential')
  }

  if (filters.acreageMin !== null && filters.acreageMin !== undefined) {
    query = query.not('site_acreage_max', 'is', null)
    query = query.gte('site_acreage_max', filters.acreageMin)
  }

  if (filters.acreageMax !== null && filters.acreageMax !== undefined) {
    query = query.not('site_acreage_min', 'is', null)
    query = query.lte('site_acreage_min', filters.acreageMax)
  }

  if (filters.dwellingMin !== null && filters.dwellingMin !== undefined) {
    query = query.not('dwelling_count_max', 'is', null)
    query = query.gte('dwelling_count_max', filters.dwellingMin)
  }

  if (filters.dwellingMax !== null && filters.dwellingMax !== undefined) {
    query = query.not('dwelling_count_min', 'is', null)
    query = query.lte('dwelling_count_min', filters.dwellingMax)
  }

  return query
}

// ---------------------------------------------------------------------------
// requirements-sourced variant (for /sitematcher-unified). Same RequirementMapFeature
// output as getRequirementMapFeatures so UnifiedMap.tsx is unchanged, but reads the
// admin-curated `requirements` tables instead of `listings`.
// ---------------------------------------------------------------------------

type RequirementLocationRow = {
  id?: string | null
  place_name?: string | null
  formatted_address?: string | null
  coordinates?: unknown
}

type RequirementRow = {
  id: string
  brand_id?: string | null
  company_name?: string | null
  title?: string | null
  listing_type?: string | null
  company_domain?: string | null
  clearbit_logo?: boolean | null
  logo_url?: string | null
  site_size_min?: number | null
  site_size_max?: number | null
  site_acreage_min?: number | null
  site_acreage_max?: number | null
  dwelling_count_min?: number | null
  dwelling_count_max?: number | null
  requirement_sectors?: Array<{ sector?: { name?: string | null } | null }> | null
  requirement_use_classes?: Array<{ use_class?: { name?: string | null } | null }> | null
  requirement_locations?: RequirementLocationRow[] | null
}

function requirementLogoUrl(row: RequirementRow): string | null {
  if (row.logo_url) return row.logo_url
  if (!row.clearbit_logo || !row.company_domain) return null
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN
  return token ? `https://img.logo.dev/${row.company_domain}?token=${token}` : null
}

export async function getRequirementMapFeaturesFromRequirements(
  supabase: any,
  options: {
    isFreeTier: boolean
    filters?: RequirementMapFilters
  }
): Promise<RequirementMapFeature[]> {
  const filters = options.filters || {}
  const validRequirementIds = await getValidRequirementIdsForReferenceFilters(supabase, filters)
  const requirements = await fetchRequirements(supabase, {
    isFreeTier: options.isFreeTier,
    filters,
    validRequirementIds,
  })

  return requirements.flatMap((requirement) => {
    const locations = requirement.requirement_locations || []
    const primarySector = requirement.requirement_sectors?.[0]?.sector?.name || null
    const primaryUseClass = requirement.requirement_use_classes?.[0]?.use_class?.name || null
    const logoUrl = requirementLogoUrl(requirement)

    return locations.flatMap((location) => {
      const coordinates = normalizeRequirementCoordinates(location.coordinates)
      if (!coordinates) {
        return []
      }

      return [{
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [coordinates.lng, coordinates.lat] as [number, number],
        },
        properties: {
          id: requirement.id,
          location_id: location.id || `${requirement.id}:${coordinates.lng},${coordinates.lat}`,
          company_name: requirement.company_name || 'Unknown Company',
          title: requirement.title || null,
          listing_type: requirement.listing_type || 'commercial',
          clearbit_logo: null,
          company_domain: requirement.company_domain || null,
          logo_url: logoUrl,
          uploaded_logo_url: requirement.logo_url || null,
          sector: primarySector,
          use_class: primaryUseClass,
          site_size_min: requirement.site_size_min ?? null,
          site_size_max: requirement.site_size_max ?? null,
          site_acreage_min: requirement.site_acreage_min ?? null,
          site_acreage_max: requirement.site_acreage_max ?? null,
          dwelling_count_min: requirement.dwelling_count_min ?? null,
          dwelling_count_max: requirement.dwelling_count_max ?? null,
          place_name: location.place_name || null,
          formatted_address: location.formatted_address || null,
          brand_id: requirement.brand_id || null,
        },
      }]
    })
  })
}

async function getValidRequirementIdsForReferenceFilters(
  supabase: any,
  filters: RequirementMapFilters
): Promise<string[] | null> {
  let validRequirementIds: string[] | null = null

  if (filters.sector && filters.sector.length > 0) {
    const { data, error } = await supabase
      .from('requirement_sectors')
      .select(`
        requirement_id,
        sectors!inner(name)
      `)
      .in('sectors.name', filters.sector)

    validRequirementIds = error ? [] : (data || []).map((row: { requirement_id: string }) => row.requirement_id)
  }

  if (filters.useClass && filters.useClass.length > 0) {
    const { data, error } = await supabase
      .from('requirement_use_classes')
      .select(`
        requirement_id,
        use_classes!inner(name)
      `)
      .in('use_classes.name', filters.useClass)

    const useClassRequirementIds = error ? [] : (data || []).map((row: { requirement_id: string }) => row.requirement_id)
    validRequirementIds = validRequirementIds !== null
      ? validRequirementIds.filter((id) => useClassRequirementIds.includes(id))
      : useClassRequirementIds
  }

  return validRequirementIds
}

async function fetchRequirements(
  supabase: any,
  options: {
    isFreeTier: boolean
    filters: RequirementMapFilters
    validRequirementIds: string[] | null
  }
): Promise<RequirementRow[]> {
  if (options.validRequirementIds !== null && options.validRequirementIds.length === 0) {
    return []
  }

  const requirements: RequirementRow[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('requirements')
      .select(`
        id,
        brand_id,
        company_name,
        title,
        listing_type,
        company_domain,
        clearbit_logo,
        logo_url,
        site_size_min,
        site_size_max,
        site_acreage_min,
        site_acreage_max,
        dwelling_count_min,
        dwelling_count_max,
        is_featured_free,
        requirement_sectors(
          sector:sectors(
            name
          )
        ),
        requirement_use_classes(
          use_class:use_classes(
            name
          )
        ),
        requirement_locations(
          id,
          place_name,
          formatted_address,
          coordinates
        )
      `)
      .eq('status', 'active')
      .range(from, from + LISTING_PAGE_SIZE - 1)

    if (options.isFreeTier) {
      query = query.eq('is_featured_free', true)
    }

    query = applyRequirementFilters(query, options.filters, options.validRequirementIds)

    const { data, error } = await query
    if (error) {
      throw error
    }

    const page = (data || []) as RequirementRow[]
    requirements.push(...page)

    if (page.length < LISTING_PAGE_SIZE) {
      break
    }

    from += LISTING_PAGE_SIZE
  }

  return requirements
}

function applyRequirementFilters(query: any, filters: RequirementMapFilters, validRequirementIds: string[] | null) {
  if (filters.companyName) {
    query = query.ilike('company_name', `%${filters.companyName}%`)
  }

  if (validRequirementIds !== null && validRequirementIds.length > 0) {
    query = query.in('id', validRequirementIds)
  }

  if (filters.listingType && filters.listingType.length > 0) {
    query = query.in('listing_type', filters.listingType)
  }

  if (filters.sizeMin !== null && filters.sizeMin !== undefined) {
    query = query.or(`site_size_max.gte.${filters.sizeMin},site_size_max.is.null`)
  }

  if (filters.sizeMax !== null && filters.sizeMax !== undefined) {
    query = query.or(`site_size_min.lte.${filters.sizeMax},site_size_min.is.null`)
  }

  const hasResidentialFilters =
    filters.acreageMin !== null && filters.acreageMin !== undefined ||
    filters.acreageMax !== null && filters.acreageMax !== undefined ||
    filters.dwellingMin !== null && filters.dwellingMin !== undefined ||
    filters.dwellingMax !== null && filters.dwellingMax !== undefined

  if (hasResidentialFilters) {
    query = query.neq('listing_type', 'commercial')
  }

  const hasCommercialFilters =
    (filters.sector && filters.sector.length > 0) ||
    (filters.useClass && filters.useClass.length > 0) ||
    filters.sizeMin !== null && filters.sizeMin !== undefined ||
    filters.sizeMax !== null && filters.sizeMax !== undefined

  if (hasCommercialFilters) {
    query = query.neq('listing_type', 'residential')
  }

  if (filters.acreageMin !== null && filters.acreageMin !== undefined) {
    query = query.not('site_acreage_max', 'is', null)
    query = query.gte('site_acreage_max', filters.acreageMin)
  }

  if (filters.acreageMax !== null && filters.acreageMax !== undefined) {
    query = query.not('site_acreage_min', 'is', null)
    query = query.lte('site_acreage_min', filters.acreageMax)
  }

  if (filters.dwellingMin !== null && filters.dwellingMin !== undefined) {
    query = query.not('dwelling_count_max', 'is', null)
    query = query.gte('dwelling_count_max', filters.dwellingMin)
  }

  if (filters.dwellingMax !== null && filters.dwellingMax !== undefined) {
    query = query.not('dwelling_count_min', 'is', null)
    query = query.lte('dwelling_count_min', filters.dwellingMax)
  }

  return query
}

async function fetchLogoData(supabase: any, listingIds: string[]): Promise<Record<string, string>> {
  if (listingIds.length === 0) {
    return {}
  }

  const { data } = await supabase
    .from('file_uploads')
    .select('listing_id, file_path, bucket_name')
    .in('listing_id', listingIds)
    .eq('file_type', 'logo')
    .eq('is_primary', true)

  if (!data) {
    return {}
  }

  return Object.fromEntries(
    data.map((file: { listing_id: string; bucket_name: string; file_path: string }) => [
      file.listing_id,
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`
    ])
  )
}
