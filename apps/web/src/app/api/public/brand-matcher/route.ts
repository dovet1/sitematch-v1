import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess, directoryAdminClient, formatCategory } from '@/lib/directory'
import { isBrandMatcherEnabled } from '@/lib/feature-flags'
import { sqFtFromM2 } from '@/app/sitematcher-unified/lib/size-filter'
import { factsRowToTradingFacts } from '@/lib/companies-house/facts'
import type { CompanyFactsRow } from '@/lib/companies-house/types'
import {
  assembleMatches,
  LOCATION_TYPE_RADIUS_MILES,
  METERS_PER_MILE,
  normalisePostcode,
  shortCentreName,
  type EstateRange,
  type RawBrand,
  type RawBrandGeo,
  type RawNewsItem,
  type RawRequirement,
} from '@/app/sitematcher-unified/lib/brand-matcher'
import {
  BRAND_MATCHER_USE_CLASSES,
  type BrandMatcherCentre,
  type BrandMatcherContact,
  type BrandMatcherQuery,
  type BrandMatcherResponse,
  type BrandMatcherSite,
  type BrandMatcherStats,
  type BrandMatcherUseClass,
  type TradingFacts,
} from '@/app/sitematcher-unified/types/brand-matcher'

export const dynamic = 'force-dynamic'

// Brand Matcher: "who should I call about my empty site?" (docs/design_handoff_contact_brands).
//
// Everything here is read from live tables — requirements, EPC floor-area profiles, stores,
// GeoDS retail centres, curated brand activity, approved planning brand signals and contacts.
// Nothing is synthesised: a signal with no source is left out of the card, not filled in.
// Companies House facts come only from an admin-confirmed brand -> company link.

const MIN_SQFT = 100
const MAX_SQFT = 500_000
const NEWS_WINDOW_DAYS = 90
const PAGE = 1000

type Db = ReturnType<typeof directoryAdminClient>

async function gate(): Promise<NextResponse | null> {
  if (!(await isBrandMatcherEnabled())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const access = await requirePlusAccess()
  return access.error
}

// PostgREST caps a response at 1000 rows; page so a growing table is never silently cut.
async function selectAll<T>(build: () => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return rows
  }
}

interface ProfileRow {
  brand_id: string
  p25_m2: number
  p75_m2: number
  min_m2: number
  max_m2: number
}

interface RequirementRow {
  brand_id: string
  site_size_min: number | null
  site_size_max: number | null
  requirement_locations: { place_name: string | null; coordinates: unknown }[] | null
  requirement_use_classes: { use_classes: { code: string } | null }[] | null
  requirement_contacts: ContactRow[] | null
}

interface ContactRow {
  id: string
  brand_id?: string
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_area: string | null
  is_primary_contact: boolean | null
}

function toContact(r: ContactRow): BrandMatcherContact {
  return {
    id: r.id,
    name: r.contact_name?.trim() || null,
    title: r.contact_title?.trim() || null,
    area: r.contact_area?.trim() || null,
    email: r.contact_email?.trim() || null,
    phone: r.contact_phone?.trim() || null,
    isPrimary: !!r.is_primary_contact,
  }
}

// requirement_locations.coordinates is "[lon,lat]" text on older rows and jsonb on newer.
function parseLonLat(raw: unknown): { lat: number | null; lon: number | null } {
  let v = raw
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return { lat: null, lon: null }
    }
  }
  if (Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])) {
    return { lon: Number(v[0]), lat: Number(v[1]) }
  }
  return { lat: null, lon: null }
}

async function loadEstateRanges(db: Db): Promise<Map<string, EstateRange[]>> {
  const rows = await selectAll<ProfileRow>(() =>
    db.from('brand_floor_area_profiles').select('brand_id, p25_m2, p75_m2, min_m2, max_m2').order('brand_id')
  )
  const map = new Map<string, EstateRange[]>()
  for (const r of rows) {
    const range = {
      p25: sqFtFromM2(r.p25_m2),
      p75: sqFtFromM2(r.p75_m2),
      min: sqFtFromM2(r.min_m2),
      max: sqFtFromM2(r.max_m2),
    }
    const list = map.get(r.brand_id)
    if (list) list.push(range)
    else map.set(r.brand_id, [range])
  }
  return map
}

async function loadRequirements(db: Db): Promise<RawRequirement[]> {
  const rows = await selectAll<RequirementRow>(() =>
    db
      .from('requirements')
      .select(
        'brand_id, site_size_min, site_size_max, ' +
          'requirement_locations(place_name, coordinates), ' +
          'requirement_use_classes(use_classes(code)), ' +
          'requirement_contacts(id, contact_name, contact_title, contact_email, contact_phone, contact_area, is_primary_contact)'
      )
      .eq('status', 'active')
      .not('brand_id', 'is', null)
      .order('id')
  )
  return rows.map((r) => ({
    brandId: r.brand_id,
    sizeMin: r.site_size_min,
    sizeMax: r.site_size_max,
    useClasses: Array.from(
      new Set(
        (r.requirement_use_classes ?? [])
          .map((u) => u.use_classes?.code)
          .filter((c): c is string => !!c)
      )
    ),
    locations: (r.requirement_locations ?? [])
      .filter((l) => l.place_name)
      .map((l) => ({ name: l.place_name as string, ...parseLonLat(l.coordinates) })),
    contacts: (r.requirement_contacts ?? []).map(toContact),
  }))
}

async function loadBrandContacts(db: Db): Promise<Map<string, BrandMatcherContact[]>> {
  const rows = await selectAll<ContactRow>(() =>
    db
      .from('brand_contacts')
      .select('id, brand_id, contact_name, contact_title, contact_email, contact_phone, contact_area, is_primary_contact')
      .order('id')
  )
  const map = new Map<string, BrandMatcherContact[]>()
  for (const r of rows) {
    if (!r.brand_id) continue
    const list = map.get(r.brand_id)
    if (list) list.push(toContact(r))
    else map.set(r.brand_id, [toContact(r)])
  }
  return map
}

async function loadNews(db: Db): Promise<RawNewsItem[]> {
  const since = new Date(Date.now() - NEWS_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const rows = await selectAll<{
    brand_id: string
    headline: string
    url: string | null
    event_date: string
    is_upcoming: boolean
  }>(() =>
    db
      .from('brand_activity')
      .select('brand_id, headline, url, event_date, is_upcoming')
      .eq('kind', 'opening')
      .or(`event_date.gte.${since},is_upcoming.eq.true`)
      .order('id')
  )
  return rows.map((r) => ({
    brandId: r.brand_id,
    headline: r.headline,
    url: r.url,
    date: r.event_date,
    upcoming: r.is_upcoming,
  }))
}

// Approved proposed-occupier/operator signals only — pending model guesses never reach a
// brand surface (same rule as brand_development_quarterly).
async function loadPlanningCounts(db: Db): Promise<Map<string, number>> {
  const rows = await selectAll<{ brand_id: string; development_id: string }>(() =>
    db
      .from('development_brand_signals')
      .select('brand_id, development_id')
      .eq('review_state', 'approved')
      .in('role', ['proposed_occupier', 'proposed_operator'])
      .not('brand_id', 'is', null)
      .order('id')
  )
  const devs = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = devs.get(r.brand_id) ?? new Set<string>()
    set.add(r.development_id)
    devs.set(r.brand_id, set)
  }
  return new Map(Array.from(devs, ([id, set]) => [id, set.size]))
}

// Companies House facts for brands whose trading company an admin has confirmed. Never scored.
async function loadTradingFacts(db: Db): Promise<Map<string, TradingFacts>> {
  const rows = await selectAll<{
    brand_id: string
    company_facts: CompanyFactsRow | null
  }>(() =>
    db
      .from('brand_companies')
      .select(
        'brand_id, company_facts(company_number, company_name, company_status, registered_office, ' +
          'last_accounts_made_up_to, last_accounts_type, accounts_overdue, turnover, turnover_status, ' +
          'net_assets, net_assets_status, fetched_at)'
      )
      .order('brand_id')
  )
  const map = new Map<string, TradingFacts>()
  for (const r of rows) {
    if (r.company_facts) map.set(r.brand_id, factsRowToTradingFacts(r.company_facts))
  }
  return map
}

async function loadBrands(db: Db): Promise<RawBrand[]> {
  const { data, error } = await db.rpc('directory_brand_cards')
  if (error) throw error
  return (
    (data ?? []) as {
      id: string
      name: string
      logo_url: string | null
      domain: string | null
      category_child: string | null
      category_parent: string | null
      store_count: number
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    logoUrl: r.logo_url,
    domain: r.domain,
    category: formatCategory(r.category_child, r.category_parent),
    storeCount: Number(r.store_count),
  }))
}

async function loadSite(db: Db, postcode: string): Promise<BrandMatcherSite | null> {
  const { data, error } = await db.rpc('brand_matcher_site', { p_postcode: postcode })
  if (error) throw error
  const row = (data ?? [])[0] as
    | {
        postcode: string
        lat: number
        lon: number
        rc_id: string | null
        rc_name: string | null
        rc_classification: string | null
        rc_form: BrandMatcherCentre['form'] | null
        region_name: string | null
        country: string | null
      }
    | undefined
  if (!row) return null
  return {
    postcode: row.postcode,
    lat: row.lat,
    lon: row.lon,
    centre:
      row.rc_id && row.rc_name && row.rc_classification && row.rc_form
        ? {
            id: row.rc_id,
            name: shortCentreName(row.rc_name),
            classification: row.rc_classification,
            form: row.rc_form,
          }
        : null,
    region: row.region_name,
    country: row.country,
  }
}

async function loadGeo(db: Db, site: BrandMatcherSite): Promise<Map<string, RawBrandGeo>> {
  const { data, error } = await db.rpc('brand_matcher_brand_geo', {
    p_lat: site.lat,
    p_lon: site.lon,
    p_form: site.centre?.form ?? null,
    p_exclude_rc_id: site.centre?.id ?? null,
    p_radius_m: Math.round(LOCATION_TYPE_RADIUS_MILES * METERS_PER_MILE),
  })
  if (error) throw error
  const map = new Map<string, RawBrandGeo>()
  for (const r of (data ?? []) as {
    brand_id: string
    store_count: number
    nearest_distance_m: number
    nearest_store_name: string | null
    nearest_store_town: string | null
    same_form_count: number | null
    same_form_names: string[] | null
    same_form_nearest_m: number | null
  }[]) {
    map.set(r.brand_id, {
      storeCount: Number(r.store_count),
      nearestMeters: r.nearest_distance_m,
      nearestName: r.nearest_store_name,
      nearestTown: r.nearest_store_town,
      sameFormCount: r.same_form_count == null ? null : Number(r.same_form_count),
      sameFormNames: r.same_form_names ?? [],
      sameFormNearestMeters: r.same_form_nearest_m,
    })
  }
  return map
}

function parseQuery(body: unknown): BrandMatcherQuery | string {
  if (!body || typeof body !== 'object') return 'Invalid request'
  const b = body as Record<string, unknown>
  const sqft = Number(b.sqft)
  if (!Number.isFinite(sqft) || sqft < MIN_SQFT || sqft > MAX_SQFT) {
    return `Size must be between ${MIN_SQFT.toLocaleString('en-GB')} and ${MAX_SQFT.toLocaleString('en-GB')} sq ft`
  }
  if (!BRAND_MATCHER_USE_CLASSES.includes(b.useClass as BrandMatcherUseClass)) return 'Unknown use class'
  const postcode = typeof b.postcode === 'string' ? normalisePostcode(b.postcode) : null
  if (!postcode) return 'Enter a full UK postcode'
  return { sqft: Math.round(sqft), useClass: b.useClass as BrandMatcherUseClass, postcode, widen: b.widen === true }
}

// Hero stat: brands we can match at all (an estate size profile or a live requirement).
export async function GET() {
  try {
    const denied = await gate()
    if (denied) return denied
    const db = directoryAdminClient()
    const [estate, reqs] = await Promise.all([loadEstateRanges(db), loadRequirements(db)])
    const ids = new Set<string>(estate.keys())
    for (const r of reqs) ids.add(r.brandId)
    const payload: BrandMatcherStats = { brandsTracked: ids.size }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Brand matcher stats failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await gate()
    if (denied) return denied

    const query = parseQuery(await request.json().catch(() => null))
    if (typeof query === 'string') return NextResponse.json({ error: query }, { status: 400 })

    const db = directoryAdminClient()
    const site = await loadSite(db, query.postcode)
    if (!site) {
      return NextResponse.json(
        { error: `We couldn't find ${query.postcode}. Check the postcode and try again.` },
        { status: 422 }
      )
    }

    const [brands, estateRanges, requirements, brandContacts, news, planningCounts, geo, tradingFacts] =
      await Promise.all([
        loadBrands(db),
        loadEstateRanges(db),
        loadRequirements(db),
        loadBrandContacts(db),
        loadNews(db),
        loadPlanningCounts(db),
        loadGeo(db, site),
        loadTradingFacts(db),
      ])

    const { matches, considered } = assembleMatches({
      query,
      site,
      brands,
      estateRanges,
      requirements,
      brandContacts,
      news,
      planningCounts,
      geo,
      tradingFacts,
    })

    const payload: BrandMatcherResponse = { site, query, matches, considered }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Brand matcher failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
