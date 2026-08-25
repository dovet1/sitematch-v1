import { createClient } from '@supabase/supabase-js'
import { geometryBounds, pointInGeometry } from '@/app/sitematcher-unified/lib/geo'
import { classifyPlanningApplications } from './classify'
import { fetchPlanNexusApplications } from './plannexus'
import type { MonthlyPeriod } from './period'
import { withCommercialRelevance } from './relevance'
import type {
  PlanningAlertApplication,
  PlanningAlertBoundary,
  PlanningAlertDigest,
  PlanningAlertReportState,
  PlanningAlertStore,
  PlanningAlertSubscription,
  PlanningAlertSubscriptionOption,
} from './types'

const INTERACTIVE_PREFIX_BATCH_SIZE = 5

function adminClient() {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function assertBoundary(value: unknown): PlanningAlertBoundary {
  if (!value || typeof value !== 'object') throw new Error('Alert patch is missing')
  const geometry = value as { type?: string; coordinates?: unknown }
  if (
    (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') ||
    !Array.isArray(geometry.coordinates)
  ) {
    throw new Error('Alert patch must be a GeoJSON Polygon or MultiPolygon')
  }
  return geometry as PlanningAlertBoundary
}

async function loadSubscription(subscriptionId: string): Promise<{
  subscription: PlanningAlertSubscription
  recipient: PlanningAlertDigest['recipient']
  brand: PlanningAlertDigest['brand']
  stores: PlanningAlertStore[]
}> {
  const db = adminClient()
  const { data: row, error } = await db
    .from('planning_alert_subscriptions')
    .select('id, user_id, brand_id, patch_name, patch_geojson, plannexus_postcode_prefixes, radius_meters, enabled')
    .eq('id', subscriptionId)
    .single()
  if (error || !row) throw new Error('Planning alert subscription not found')
  const patchGeometry = assertBoundary(row.patch_geojson)

  const [{ data: user, error: userError }, { data: brand, error: brandError }, storesResult] =
    await Promise.all([
      db.from('users').select('email, user_company_name').eq('id', row.user_id).single(),
      db.from('brands').select('id, name, logo_url').eq('id', row.brand_id).single(),
      db.from('stores')
        .select('id, name, town, postcode, lat, lon')
        .eq('brand_id', row.brand_id)
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .limit(5000),
    ])
  if (userError || !user?.email) throw new Error('Alert recipient could not be loaded')
  if (brandError || !brand) throw new Error('Alert brand could not be loaded')
  if (storesResult.error) throw new Error('Brand estate could not be loaded')

  return {
    subscription: {
      id: row.id,
      userId: row.user_id,
      brandId: row.brand_id,
      patchName: row.patch_name,
      patchGeometry,
      postcodePrefixes: row.plannexus_postcode_prefixes ?? [],
      radiusMeters: row.radius_meters ?? 5000,
      enabled: row.enabled,
    },
    recipient: { name: user.user_company_name ?? null, email: user.email },
    brand: { id: brand.id, name: brand.name, logoUrl: brand.logo_url },
    stores: (storesResult.data ?? [])
      .map((store: any): PlanningAlertStore => ({
        id: store.id,
        name: store.name ?? store.town ?? 'Store',
        town: store.town,
        postcode: store.postcode,
        lat: Number(store.lat),
        lng: Number(store.lon),
      }))
      .filter((store: PlanningAlertStore) =>
        pointInGeometry(store.lng, store.lat, patchGeometry)
      ),
  }
}

async function refreshPostcodeCoverage(subscriptionId: string): Promise<void> {
  const { data, error } = await adminClient().rpc('refresh_planning_alert_postcode_prefixes', {
    p_subscription_id: subscriptionId,
    p_edge_padding_meters: 2000,
  })
  if (error) throw new Error(`Could not refresh planning alert postcode coverage: ${error.message}`)
  const count = Array.isArray(data) ? data.length : 0
  console.info(`[planning-alerts] Refreshed ${count} PlanNexus postcode prefixes for ${subscriptionId}`)
}

function mockApplications(
  period: MonthlyPeriod,
  stores: PlanningAlertStore[],
  patch: PlanningAlertBoundary,
  radiusMeters: number
): PlanningAlertApplication[] {
  const day = (index: number) => `${period.start.slice(0, 8)}${String(4 + index * 4).padStart(2, '0')}`
  const near = stores.slice(0, 4).map((store, index): PlanningAlertApplication => ({
    id: `mock-near-${store.id}`,
    reference: `POC/${period.start.slice(0, 4)}/${String(index + 1).padStart(3, '0')}`,
    address: `${store.town ?? store.name} commercial quarter`,
    postcode: store.postcode,
    description: index % 2 === 0
      ? 'Flexible retail and food-and-beverage floorspace with new shopfronts and servicing.'
      : 'Redevelopment of an existing commercial unit with associated public realm improvements.',
    status: index % 2 === 0 ? 'Validated' : 'Consultation',
    applicationType: 'Full',
    authorityName: store.town ? `${store.town} Council` : null,
    dateReceived: day(index),
    lat: store.lat + 0.008,
    lng: store.lng + 0.008,
    sourceUrl: 'https://plannexus.io/',
    nearestStore: null,
  }))

  const [minLng, minLat, maxLng, maxLat] = geometryBounds(patch)
  const patchOnly: PlanningAlertApplication[] = []
  outer: for (let y = 1; y < 5; y++) {
    for (let x = 1; x < 5; x++) {
      const lng = minLng + ((maxLng - minLng) * x) / 5
      const lat = minLat + ((maxLat - minLat) * y) / 5
      if (!pointInGeometry(lng, lat, patch)) continue
      const classified = classifyPlanningApplications([
        {
          id: 'mock-patch-1', reference: `POC/${period.start.slice(0, 4)}/101`,
          address: 'Strategic development site within the configured patch', postcode: null,
          description: 'Outline mixed-use proposal including retail, leisure and employment floorspace.',
          status: 'Validated', applicationType: 'Outline', authorityName: null,
          dateReceived: day(5), lat, lng, sourceUrl: 'https://plannexus.io/', nearestStore: null,
        },
      ], stores, patch, radiusMeters)
      if (classified.inPatch.length > 0) {
        patchOnly.push(classified.inPatch[0])
        break outer
      }
    }
  }
  return [...near, ...patchOnly]
}

function hydrateDigest(value: PlanningAlertDigest): PlanningAlertDigest {
  return {
    ...value,
    nearStoreApplications: value.nearStoreApplications.map(withCommercialRelevance),
    patchApplications: value.patchApplications.map(withCommercialRelevance),
  }
}

function emptyDigest(options: {
  subscription: PlanningAlertSubscription
  recipient: PlanningAlertDigest['recipient']
  brand: PlanningAlertDigest['brand']
  stores: PlanningAlertStore[]
  period: MonthlyPeriod
  provider: PlanningAlertDigest['provider']
}): PlanningAlertDigest {
  return {
    subscriptionId: options.subscription.id,
    recipient: options.recipient,
    brand: options.brand,
    period: options.period,
    patch: {
      name: options.subscription.patchName,
      geometry: options.subscription.patchGeometry,
    },
    radiusKm: options.subscription.radiusMeters / 1000,
    stores: options.stores,
    nearStoreApplications: [],
    patchApplications: [],
    generatedAt: new Date().toISOString(),
    provider: options.provider,
    summary: null,
  }
}

function mergeApplications(
  current: PlanningAlertApplication[],
  additions: PlanningAlertApplication[]
): PlanningAlertApplication[] {
  const merged = new Map(current.map((application) => [application.id, application]))
  for (const application of additions) merged.set(application.id, application)
  return Array.from(merged.values()).sort(
    (a, b) => b.dateReceived.localeCompare(a.dateReceived) || a.reference.localeCompare(b.reference)
  )
}

function stateFromRun(row: any): PlanningAlertReportState {
  return {
    digest: hydrateDigest(row.digest_payload as PlanningAlertDigest),
    generation: {
      status: row.status,
      processedPrefixes: row.processed_prefix_count ?? 0,
      totalPrefixes: row.total_prefix_count ?? 0,
      error: row.error_message ?? null,
    },
  }
}

async function insertPrefixWork(runId: string, prefixes: string[]): Promise<void> {
  const db = adminClient()
  for (let offset = 0; offset < prefixes.length; offset += 500) {
    const rows = prefixes.slice(offset, offset + 500).map((postcodePrefix) => ({
      run_id: runId,
      postcode_prefix: postcodePrefix,
    }))
    const { error } = await db
      .from('planning_alert_run_prefixes')
      .upsert(rows, { onConflict: 'run_id,postcode_prefix', ignoreDuplicates: true })
    if (error) throw new Error(`Could not initialise planning alert prefix work: ${error.message}`)
  }
}

export async function getPlanningAlertReportState(
  subscriptionId: string,
  period: MonthlyPeriod
): Promise<PlanningAlertReportState> {
  const db = adminClient()
  const { data: existing, error: existingError } = await db
    .from('planning_alert_runs')
    .select('id, digest_payload, status, processed_prefix_count, total_prefix_count, error_message')
    .eq('subscription_id', subscriptionId)
    .eq('period_start', period.start)
    .maybeSingle()
  if (existingError) throw new Error(`Could not load planning alert run: ${existingError.message}`)
  if (existing?.digest_payload) return stateFromRun(existing)

  const useMock = process.env.PLANNING_ALERT_DATA_SOURCE === 'mock'
  if (!useMock && process.env.PLANNING_ALERT_POSTCODE_SOURCE === 'onspd') {
    await refreshPostcodeCoverage(subscriptionId)
  }
  const loaded = await loadSubscription(subscriptionId)
  const digest = emptyDigest({ ...loaded, period, provider: useMock ? 'mock' : 'plannexus' })

  if (useMock) {
    const applications = mockApplications(
      period,
      loaded.stores,
      loaded.subscription.patchGeometry,
      loaded.subscription.radiusMeters
    )
    const classified = classifyPlanningApplications(
      applications.map(withCommercialRelevance),
      loaded.stores,
      loaded.subscription.patchGeometry,
      loaded.subscription.radiusMeters
    )
    digest.nearStoreApplications = classified.nearStore
    digest.patchApplications = classified.inPatch
    const { data: run, error } = await db.from('planning_alert_runs').upsert({
      subscription_id: subscriptionId,
      period_start: period.start,
      period_end: period.end,
      provider: 'mock',
      source_application_count: applications.length,
      digest_payload: digest,
      status: 'generated',
      processed_prefix_count: 0,
      total_prefix_count: 0,
      generated_at: digest.generatedAt,
      error_message: null,
    }, { onConflict: 'subscription_id,period_start' }).select('id, digest_payload, status, processed_prefix_count, total_prefix_count, error_message').single()
    if (error || !run) throw new Error(`Could not save planning alert run: ${error?.message ?? 'unknown error'}`)
    return stateFromRun(run)
  }

  const prefixes = Array.from(new Set(
    loaded.subscription.postcodePrefixes.map((prefix) => prefix.trim().toUpperCase()).filter(Boolean)
  ))
  if (prefixes.length === 0) throw new Error('At least one PlanNexus postcode prefix is required')

  const { data: run, error } = await db.from('planning_alert_runs').upsert({
    subscription_id: subscriptionId,
    period_start: period.start,
    period_end: period.end,
    provider: 'plannexus',
    source_application_count: 0,
    digest_payload: digest,
    status: 'processing',
    processed_prefix_count: 0,
    total_prefix_count: prefixes.length,
    generated_at: digest.generatedAt,
    last_progress_at: new Date().toISOString(),
    error_message: null,
  }, { onConflict: 'subscription_id,period_start' }).select('id, digest_payload, status, processed_prefix_count, total_prefix_count, error_message').single()
  if (error || !run) throw new Error(`Could not initialise planning alert run: ${error?.message ?? 'unknown error'}`)
  await insertPrefixWork(run.id, prefixes)
  return stateFromRun(run)
}

export async function processPlanningAlertBatch(
  subscriptionId: string,
  period: MonthlyPeriod,
  batchSize = INTERACTIVE_PREFIX_BATCH_SIZE
): Promise<PlanningAlertReportState> {
  let state = await getPlanningAlertReportState(subscriptionId, period)
  if (state.generation.status !== 'processing') return state

  const db = adminClient()
  const [{ data: run, error: runError }, loaded] = await Promise.all([
    db.from('planning_alert_runs')
      .select('id')
      .eq('subscription_id', subscriptionId)
      .eq('period_start', period.start)
      .single(),
    loadSubscription(subscriptionId),
  ])
  if (runError || !run) throw new Error(`Could not load planning alert work: ${runError?.message ?? 'unknown error'}`)

  for (let index = 0; index < Math.max(1, Math.min(batchSize, 20)); index++) {
    const { data: prefix, error: claimError } = await db.rpc('claim_planning_alert_run_prefix', {
      p_run_id: run.id,
    })
    if (claimError) throw new Error(`Could not claim planning alert work: ${claimError.message}`)
    if (!prefix) break

    let checkpointSaved = false
    try {
      const applications = await fetchPlanNexusApplications({
        period,
        postcodePrefixes: [prefix],
      })
      const classified = classifyPlanningApplications(
        applications.map(withCommercialRelevance),
        loaded.stores,
        loaded.subscription.patchGeometry,
        loaded.subscription.radiusMeters
      )
      const digest: PlanningAlertDigest = {
        ...state.digest,
        nearStoreApplications: mergeApplications(
          state.digest.nearStoreApplications,
          classified.nearStore
        ),
        patchApplications: mergeApplications(
          state.digest.patchApplications,
          classified.inPatch
        ),
        generatedAt: new Date().toISOString(),
      }
      const { data: saved, error: saveError } = await db.rpc('complete_planning_alert_run_prefix', {
        p_run_id: run.id,
        p_postcode_prefix: prefix,
        p_application_count: applications.length,
        p_digest_payload: digest,
      })
      if (saveError) throw new Error(`Could not checkpoint planning alert work: ${saveError.message}`)
      checkpointSaved = Boolean(saved)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PlanNexus error'
      await db.rpc('fail_planning_alert_run_prefix', {
        p_run_id: run.id,
        p_postcode_prefix: prefix,
        p_error_message: message,
      })
      return getPlanningAlertReportState(subscriptionId, period)
    }
    if (checkpointSaved) state = await getPlanningAlertReportState(subscriptionId, period)
  }

  return getPlanningAlertReportState(subscriptionId, period)
}

export async function getOrCreatePlanningAlertDigest(
  subscriptionId: string,
  period: MonthlyPeriod
): Promise<PlanningAlertDigest> {
  let state = await getPlanningAlertReportState(subscriptionId, period)
  while (state.generation.status === 'processing') {
    const before = state.generation.processedPrefixes
    state = await processPlanningAlertBatch(subscriptionId, period, 20)
    if (
      state.generation.status === 'processing' &&
      state.generation.processedPrefixes === before
    ) {
      throw new Error(
        state.generation.error ?? 'Planning alert generation is already being processed'
      )
    }
  }
  if (state.generation.status === 'failed') {
    throw new Error(state.generation.error ?? 'Planning alert generation failed')
  }
  return state.digest
}

export async function listEnabledPlanningAlertSubscriptionIds(): Promise<string[]> {
  const { data, error } = await adminClient()
    .from('planning_alert_subscriptions')
    .select('id')
    .eq('enabled', true)
  if (error) throw new Error(`Could not list planning alerts: ${error.message}`)
  return (data ?? []).map((row: { id: string }) => row.id)
}

/**
 * Lists the reports an authenticated user may open from `/planning-alerts`.
 * Occupiers can only see their own subscriptions; admins can preview any enabled
 * subscription so the setup can be checked before a recipient is emailed.
 */
export async function listAccessiblePlanningAlertSubscriptions(options: {
  userId: string
  isAdmin: boolean
}): Promise<PlanningAlertSubscriptionOption[]> {
  const db = adminClient()
  let query = db
    .from('planning_alert_subscriptions')
    .select('id, user_id, brand_id, patch_name, created_at')
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (!options.isAdmin) query = query.eq('user_id', options.userId)

  const { data: rows, error } = await query
  if (error) throw new Error(`Could not list planning alert subscriptions: ${error.message}`)
  if (!rows?.length) return []

  const brandIds = Array.from(new Set(rows.map((row: any) => row.brand_id)))
  const userIds = Array.from(new Set(rows.map((row: any) => row.user_id)))
  const [{ data: brands, error: brandError }, { data: users, error: userError }] =
    await Promise.all([
      db.from('brands').select('id, name').in('id', brandIds),
      db.from('users').select('id, email').in('id', userIds),
    ])

  if (brandError) throw new Error(`Could not load alert brands: ${brandError.message}`)
  if (userError) throw new Error(`Could not load alert recipients: ${userError.message}`)

  const brandNames = new Map((brands ?? []).map((brand: any) => [brand.id, brand.name]))
  const recipientEmails = new Map((users ?? []).map((user: any) => [user.id, user.email]))

  return rows
    .map((row: any): PlanningAlertSubscriptionOption => ({
      id: row.id,
      userId: row.user_id,
      brandName: brandNames.get(row.brand_id) ?? 'Unknown brand',
      patchName: row.patch_name,
      recipientEmail: recipientEmails.get(row.user_id) ?? null,
    }))
    .sort((a: PlanningAlertSubscriptionOption, b: PlanningAlertSubscriptionOption) =>
      a.brandName.localeCompare(b.brandName) || a.patchName.localeCompare(b.patchName)
    )
}

export async function planningAlertWasSent(subscriptionId: string, periodStart: string): Promise<boolean> {
  const { data } = await adminClient()
    .from('planning_alert_runs')
    .select('email_sent_at')
    .eq('subscription_id', subscriptionId)
    .eq('period_start', periodStart)
    .maybeSingle()
  return Boolean(data?.email_sent_at)
}

export async function markPlanningAlertSent(subscriptionId: string, periodStart: string): Promise<void> {
  const { error } = await adminClient()
    .from('planning_alert_runs')
    .update({ email_sent_at: new Date().toISOString(), status: 'sent' })
    .eq('subscription_id', subscriptionId)
    .eq('period_start', periodStart)
  if (error) throw new Error(`Could not mark planning alert as sent: ${error.message}`)
}
