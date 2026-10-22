import { directoryAdminClient, formatCategory } from '@/lib/directory'
import { isBrandMatcherDemographicsEnabled } from '@/lib/feature-flags'
import { sqFtFromM2 } from '@/app/sitematcher/lib/size-filter'
import { factsRowToTradingFacts } from '@/lib/companies-house/facts'
import type { CompanyFactsRow } from '@/lib/companies-house/types'
import {
  assembleMatches,
  sortStoreTowns,
  townBand,
  TOP_STORE_TOWNS,
  TOWN_REACH_M,
  LOCATION_TYPE_RADIUS_MILES,
  METERS_PER_MILE,
  normalisePostcode,
  NEWS_WINDOW_DAYS,
  shortCentreName,
  type EstateRange,
  type RawBrand,
  type RawBrandGeo,
  type RawNewsItem,
  type RawRequirement,
} from '@/app/sitematcher/lib/brand-matcher'
import {
  BRAND_MATCHER_ALL_USE_CLASSES,
  BRAND_MATCHER_USE_CLASSES,
  type BrandMatcherCentre,
  type BrandMatcherContact,
  type BrandMatcherQuery,
  type BrandMatcherResponse,
  type BrandMatcherSite,
  type BrandMatcherStats,
  type BrandMatcherQueryUseClass,
  type BrandStoreTown,
  type BrandStoreTownsResponse,
  type TownFigures,
  type TownMatch,
  type TradingFacts,
} from '@/app/sitematcher/types/brand-matcher'

// Brand Matcher: "who should I call about my empty site?" (docs/design_handoff_contact_brands).
//
// Everything here is read from live tables — requirements, EPC floor-area profiles, stores,
// GeoDS retail centres, curated brand activity, approved planning brand signals and contacts.
// Nothing is synthesised: a signal with no source is left out of the card, not filled in.
// Companies House facts come only from an admin-confirmed brand -> company link.

const MIN_SQFT = 100
const MAX_SQFT = 500_000
const PAGE = 1000

type Db = ReturnType<typeof directoryAdminClient>

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
  fascia_id: string | null
  p25_m2: number
  p75_m2: number
  min_m2: number
  max_m2: number
}

interface RequirementRow {
  brand_id: string
  site_size_min: number | null
  site_size_max: number | null
  created_at: string | null
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
    db
      .from('brand_floor_area_profiles')
      .select('brand_id, fascia_id, p25_m2, p75_m2, min_m2, max_m2')
      .order('brand_id')
      .order('fascia_key')
  )
  const map = new Map<string, EstateRange[]>()
  for (const r of rows) {
    const range = {
      p25: sqFtFromM2(r.p25_m2),
      p75: sqFtFromM2(r.p75_m2),
      min: sqFtFromM2(r.min_m2),
      max: sqFtFromM2(r.max_m2),
      fasciaId: r.fascia_id,
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
        'brand_id, site_size_min, site_size_max, created_at, ' +
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
    createdAt: r.created_at,
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

// Every rated article in the news window, of any kind: a closure counts against a brand as an
// opening counts for it (newsScore in brand-matcher.ts).
async function loadNews(db: Db): Promise<RawNewsItem[]> {
  const since = new Date(Date.now() - NEWS_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const rows = await selectAll<{
    brand_id: string
    kind: RawNewsItem['kind']
    headline: string
    url: string | null
    event_date: string
    is_upcoming: boolean
    signal_rating: number
  }>(() =>
    db
      .from('brand_activity')
      .select('brand_id, kind, headline, url, event_date, is_upcoming, signal_rating')
      .or(`event_date.gte.${since},is_upcoming.eq.true`)
      .order('id')
  )
  return rows.map((r) => ({
    brandId: r.brand_id,
    kind: r.kind,
    headline: r.headline,
    url: r.url,
    date: r.event_date,
    upcoming: r.is_upcoming,
    rating: r.signal_rating,
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
          'net_assets, net_assets_status, turnover_page, net_assets_page, fetched_at)'
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

// How far apart each brand's stores usually are (migration 20261103000000). Never takes the
// matcher down: without it, distance is scored as it was before spacing existed.
async function loadSpacing(db: Db): Promise<Map<string, number | null>> {
  try {
    const rows = await selectAll<{ brand_id: string; p90_gap_m: number | null }>(() =>
      db.from('brand_store_spacing').select('brand_id, p90_gap_m').order('brand_id')
    )
    return new Map(rows.map((r) => [r.brand_id, r.p90_gap_m]))
  } catch (error) {
    console.error('Brand matcher store spacing failed:', error)
    return new Map()
  }
}

async function loadGeo(db: Db, site: BrandMatcherSite): Promise<Map<string, RawBrandGeo>> {
  const [{ data, error }, spacing] = await Promise.all([
    db.rpc('brand_matcher_brand_geo', {
      p_lat: site.lat,
      p_lon: site.lon,
      p_form: site.centre?.form ?? null,
      p_exclude_rc_id: site.centre?.id ?? null,
      p_radius_m: Math.round(LOCATION_TYPE_RADIUS_MILES * METERS_PER_MILE),
    }),
    loadSpacing(db),
  ])
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
    // Added by migration 20261025000000; absent until it is applied.
    nearest_stores?: { name: string | null; town: string | null; distance_m: number }[] | null
  }[]) {
    map.set(r.brand_id, {
      storeCount: Number(r.store_count),
      nearestMeters: r.nearest_distance_m,
      nearestName: r.nearest_store_name,
      nearestTown: r.nearest_store_town,
      sameFormCount: r.same_form_count == null ? null : Number(r.same_form_count),
      sameFormNames: r.same_form_names ?? [],
      sameFormNearestMeters: r.same_form_nearest_m,
      nearestStores: (r.nearest_stores ?? []).map((x) => ({ name: x.name, town: x.town, meters: x.distance_m })),
      ...(spacing.has(r.brand_id) ? { spacingMeters: spacing.get(r.brand_id) } : {}),
    })
  }
  return map
}

// The site's town and, per brand, how its stores' towns compare with it (migration
// 20261029000000). No town (outside England and Wales, or in open country) means no read.
async function loadTownMatches(
  db: Db,
  site: BrandMatcherSite
): Promise<{ town: TownFigures | null; matches: Map<string, TownMatch> }> {
  const [siteTown, rows] = await Promise.all([
    // A site just outside a town takes the largest town within TOWN_REACH_M (migration 20261101000000).
    db.rpc('brand_matcher_site_bua', { p_lat: site.lat, p_lon: site.lon, p_max_distance_m: TOWN_REACH_M }),
    db.rpc('brand_matcher_town_matches', { p_lat: site.lat, p_lon: site.lon }),
  ])
  if (siteTown.error) throw siteTown.error
  if (rows.error) throw rows.error
  const t = (siteTown.data ?? [])[0] as
    | { bua_gsscode: string; bua_name: string; signals: Record<string, number> | null }
    | undefined
  const population = t?.signals?.population
  const affluence = t?.signals?.affluence_high
  const town =
    t && population != null && affluence != null
      ? { code: t.bua_gsscode, name: t.bua_name, population: Number(population), affluence: Number(affluence) }
      : null
  const matches = new Map<string, TownMatch>()
  if (!town) return { town, matches }
  for (const r of (rows.data ?? []) as {
    brand_id: string
    town_stores: number
    close_stores: number | null
    towns: number
    close_towns: number | null
    best_bua_name: string | null
    best_gap: number | null
  }[]) {
    const band = townBand(r.best_gap)
    if (!band) continue
    matches.set(r.brand_id, {
      band,
      bestTown: r.best_bua_name,
      townStores: Number(r.town_stores),
      closeStores: Number(r.close_stores ?? 0),
      towns: Number(r.towns),
      closeTowns: Number(r.close_towns ?? 0),
    })
  }
  return { town, matches }
}

export function parseQuery(body: unknown): BrandMatcherQuery | string {
  if (!body || typeof body !== 'object') return 'Invalid request'
  const b = body as Record<string, unknown>
  const sqft = Number(b.sqft)
  if (!Number.isFinite(sqft) || sqft < MIN_SQFT || sqft > MAX_SQFT) {
    return `Size must be between ${MIN_SQFT.toLocaleString('en-GB')} and ${MAX_SQFT.toLocaleString('en-GB')} sq ft`
  }
  const useClasses: readonly string[] = [...BRAND_MATCHER_USE_CLASSES, BRAND_MATCHER_ALL_USE_CLASSES]
  if (typeof b.useClass !== 'string' || !useClasses.includes(b.useClass)) return 'Unknown use class'
  const postcode = typeof b.postcode === 'string' ? normalisePostcode(b.postcode) : null
  if (!postcode) return 'Enter a full UK postcode'
  return { sqft: Math.round(sqft), useClass: b.useClass as BrandMatcherQueryUseClass, postcode, widen: b.widen === true }
}

// Brands we can match at all (an estate size profile or a live requirement): the hero stat.
export async function brandMatcherStats(): Promise<BrandMatcherStats> {
  const db = directoryAdminClient()
  const [estate, reqs] = await Promise.all([loadEstateRanges(db), loadRequirements(db)])
  const ids = new Set<string>(estate.keys())
  for (const r of reqs) ids.add(r.brandId)
  return { brandsTracked: ids.size }
}

export type MatchSiteResult =
  | { ok: true; payload: BrandMatcherResponse }
  | { ok: false; status: number; error: string }

// The ranked list for one site. Shared by the member route and the logged-out preview, which
// redacts it (preview/route.ts).
export async function matchSite(query: BrandMatcherQuery): Promise<MatchSiteResult> {
  const db = directoryAdminClient()
  const site = await loadSite(db, query.postcode)
  if (!site) {
    return { ok: false, status: 422, error: `We couldn't find ${query.postcode}. Check the postcode and try again.` }
  }

  const [brands, estateRanges, requirements, brandContacts, news, planningCounts, geo, tradingFacts, towns] =
    await Promise.all([
      loadBrands(db),
      loadEstateRanges(db),
      loadRequirements(db),
      loadBrandContacts(db),
      loadNews(db),
      loadPlanningCounts(db),
      loadGeo(db, site),
      loadTradingFacts(db),
      // Never lets a demographic problem take the matcher down: no read rather than no results.
      isBrandMatcherDemographicsEnabled().then((on) =>
        on
          ? loadTownMatches(db, site).catch((error) => {
              console.error('Brand matcher demographics failed:', error)
              return undefined
            })
          : undefined
      ),
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
    townMatches: towns?.matches,
  })

  return {
    ok: true,
    payload: {
      site: towns ? { ...site, town: towns.town } : site,
      query,
      matches,
      considered,
    },
  }
}

// One brand's best-matching stores (top TOP_STORE_TOWNS) with their towns' population and
// affluence and how close each town is to the site's town (migration 20261029000000). Shared by
// the Demographics panel's towns route and the brand report.
export async function brandStoreTowns(brandId: string, lat: number, lon: number): Promise<BrandStoreTownsResponse> {
  const { data, error } = await directoryAdminClient().rpc('brand_matcher_brand_towns', {
    p_brand_id: brandId,
    p_lat: lat,
    p_lon: lon,
  })
  if (error) throw error

  const stores: BrandStoreTown[] = (
    (data ?? []) as {
      store_name: string | null
      store_town: string | null
      distance_m: number
      bua_gsscode: string | null
      bua_name: string | null
      population: number | null
      affluence: number | null
      gap: number | null
    }[]
  ).map((r) => ({
    name: r.store_name,
    town: r.store_town,
    miles: r.distance_m / METERS_PER_MILE,
    bua:
      r.bua_gsscode && r.bua_name && r.population != null && r.affluence != null
        ? { code: r.bua_gsscode, name: r.bua_name, population: Number(r.population), affluence: Number(r.affluence) }
        : null,
    band: townBand(r.gap),
    gap: r.gap,
  }))

  return {
    stores: sortStoreTowns(stores.filter((s) => s.bua)).slice(0, TOP_STORE_TOWNS),
    total: stores.length,
  }
}
