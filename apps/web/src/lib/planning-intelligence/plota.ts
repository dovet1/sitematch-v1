import type { PlotaFamily, PlotaPage, SearchSpec } from './types'

export const PLOTA_BASE_URL = 'https://api.plota.co.uk/v1'
export const PLOTA_INTERNAL_MONTHLY_LIMIT = 15_000
// Only discovery may spend below this. The user approved lowering it from 5,000 to 3,500 on
// 13 Sep 2026, and reconfirmed on 14 Sep after it was reverted as an unexplained change:
// measured discovery use is ~160 requests a day, so 3,500 covers the rest of a month with
// headroom for provider errors and retries. Do not change it without the user's approval.
export const PLOTA_REQUEST_RESERVE = 3_500

/**
 * Plota's derived filters -- commercial_work and dmin -- are documented as live-only, and a
 * reduced-scope search of an earlier window returns an incomplete answer rather than an
 * error. Both the backfill and refresh paths refuse to search before this date under reduced
 * scope, because reading fewer records than we already hold and reporting success is worse
 * than not running.
 *
 * This is a fact about the provider, so it sits here rather than in the ingest driver: the
 * cron routes that enforce it mock the driver in their tests and would otherwise be
 * comparing against undefined.
 */
export const REDUCED_SCOPE_ARCHIVE_FLOOR = '2026-01-01'

/**
 * Plota filters on receipt date but only lists an application once the council has validated
 * it, so a record can appear long after the dates discovery is reading. In Oct 2025-Feb 2026
 * records, 23.6% of intelligence-tier applications were validated more than 14 days after
 * receipt, 5.5% more than 60 days and 0.9% more than 120 days.
 *
 * Main discovery therefore reads only the latest week, which a 20-page run finishes in about a
 * day. A late lane re-reads receipt dates from one to seventeen weeks ago, and a slower deep
 * lane reads from seventeen weeks to a year: large schemes are validated late far more often,
 * with 3.6% of those with 10+ homes or 1,000+ sqm validated more than 180 days after receipt.
 * Adjacent windows share their boundary day so a record validated on it cannot fall between.
 */
export const DISCOVERY_LOOKBACK_DAYS = 7
export const LATE_DISCOVERY_OLDEST_DAYS = 120
export const DEEP_DISCOVERY_OLDEST_DAYS = 365

function utcDaysAgo(now: Date, days: number): string {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export function discoveryWindow(now = new Date()): { dateFrom: string; dateTo: string } {
  return { dateFrom: utcDaysAgo(now, DISCOVERY_LOOKBACK_DAYS), dateTo: utcDaysAgo(now, 0) }
}

/**
 * The lanes are reduced scope, so neither reads before the live-only filter floor. A lane whose
 * whole window predates the floor has nothing it can read correctly and returns null.
 */
function reducedWindow(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } | null {
  const floored = dateFrom < REDUCED_SCOPE_ARCHIVE_FLOOR ? REDUCED_SCOPE_ARCHIVE_FLOOR : dateFrom
  return floored > dateTo ? null : { dateFrom: floored, dateTo }
}

export function lateDiscoveryWindow(now = new Date()): { dateFrom: string; dateTo: string } | null {
  return reducedWindow(utcDaysAgo(now, LATE_DISCOVERY_OLDEST_DAYS), utcDaysAgo(now, DISCOVERY_LOOKBACK_DAYS))
}

export function deepDiscoveryWindow(now = new Date()): { dateFrom: string; dateTo: string } | null {
  return reducedWindow(utcDaysAgo(now, DEEP_DISCOVERY_OLDEST_DAYS), utcDaysAgo(now, LATE_DISCOVERY_OLDEST_DAYS))
}

export class PlotaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null,
    readonly retryAfterSeconds: number | null
  ) {
    super(message)
    this.name = 'PlotaError'
  }
}

export interface PlotaUsageHeaders {
  requestId: string | null
  monthlyLimit: number | null
  monthlyRemaining: number | null
}

export interface PlotaSearchResult {
  page: PlotaPage
  usage: PlotaUsageHeaders
}

function integerHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name)
  if (!raw) return null
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : null
}

export class PlotaClient {
  private readonly baseUrl: string

  constructor(
    private readonly apiKey: string,
    options: { baseUrl?: string } = {}
  ) {
    if (!apiKey) throw new Error('PLOTA_API_KEY is not configured')
    this.baseUrl = options.baseUrl ?? PLOTA_BASE_URL
  }

  /**
   * The whole family of related applications for one application: the principal, every member with
   * its parent, and the condition ledger. One request, whatever the family's size.
   */
  async associated(id: string, options: { signal?: AbortSignal } = {}): Promise<{ family: PlotaFamily; usage: PlotaUsageHeaders }> {
    const { body, usage } = await this.get(`/applications/${encodeURIComponent(id)}/associated`, options)
    const family = ((body as { data?: unknown }).data ?? body) as PlotaFamily
    if (!family || !family.principal || !Array.isArray(family.applications)) {
      throw new PlotaError('Plota returned an invalid family shape', 502, usage.requestId, null)
    }
    return { family, usage }
  }

  private async get(path: string, options: { signal?: AbortSignal }): Promise<{ body: unknown; usage: PlotaUsageHeaders }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        'User-Agent': 'CommercialDirectory/1.0 planning-intelligence',
      },
      signal: options.signal,
    })
    const usage: PlotaUsageHeaders = {
      requestId: response.headers.get('x-request-id'),
      monthlyLimit: integerHeader(response.headers, 'x-ratelimit-limit-month'),
      monthlyRemaining: integerHeader(response.headers, 'x-ratelimit-remaining-month'),
    }
    if (!response.ok) {
      let message = `Plota request failed (${response.status})`
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        if (body.error?.message) message = body.error.message
      } catch {
        // Keep the status-only message; never include the request URL or API key.
      }
      throw new PlotaError(message, response.status, usage.requestId, integerHeader(response.headers, 'retry-after'))
    }
    return { body: await response.json(), usage }
  }

  async search(
    params: Record<string, string>,
    options: { signal?: AbortSignal } = {}
  ): Promise<PlotaSearchResult> {
    const query = new URLSearchParams({ ...params, include_contact: 'false' })
    const response = await fetch(`${this.baseUrl}/applications?${query}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        'User-Agent': 'CommercialDirectory/1.0 planning-intelligence',
      },
      signal: options.signal,
    })

    const usage: PlotaUsageHeaders = {
      requestId: response.headers.get('x-request-id'),
      monthlyLimit: integerHeader(response.headers, 'x-ratelimit-limit-month'),
      monthlyRemaining: integerHeader(response.headers, 'x-ratelimit-remaining-month'),
    }

    if (!response.ok) {
      let message = `Plota request failed (${response.status})`
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        if (body.error?.message) message = body.error.message
      } catch {
        // Keep the status-only message; never include the request URL or API key.
      }
      throw new PlotaError(
        message,
        response.status,
        usage.requestId,
        integerHeader(response.headers, 'retry-after')
      )
    }

    const body = (await response.json()) as PlotaPage
    if (!Array.isArray(body.data) || !body.meta || typeof body.meta !== 'object') {
      throw new PlotaError('Plota returned an invalid response shape', 502, usage.requestId, null)
    }
    return { page: body, usage }
  }
}

export type CensusScope = 'full' | 'reduced'

/**
 * Search specs are intentionally overlapping; upsert by Plota ID removes duplicates.
 * With reduced scope, advert/listed routes preserve brand-opening evidence that often
 * has no change-of-use application.
 *
 * `dmin` only returns records with a stated dwelling count, so a housing scheme described
 * without one ("Residential development with access") never reached the uncounted-housing
 * limb under reduced scope. Measured on six weeks of the full census (May-June 2026), those
 * were 5.0% of the intelligence tier and every tier record the reduced specs missed. Most
 * were amendments and condition discharges quoting a parent permission; of the 71 real
 * proposals, `category=new-homes` returned 63 for about 266 extra records a week nationally.
 * Plota matches `category` against any of a record's categories, not only the primary one
 * (verified on Wiltshire, March 2026), and does not document it as live-only.
 */
export function buildSearchSpecs(input: {
  scope: CensusScope
  dateFrom: string
  dateTo: string
  pageSize: number
  nations?: string[]
  councils?: string[]
}): SearchSpec[] {
  const nations = input.nations ?? ['england', 'scotland', 'wales', 'northern-ireland']
  const common = {
    date_from: input.dateFrom,
    date_to: input.dateTo,
    limit: String(input.pageSize),
  }
  const specs: SearchSpec[] = []
  // Council-scoped archive paging was verified live. Independent cursors allow a
  // measured pilot to expand to the national catalogue without repeating its councils.
  if (input.councils) {
    if (input.scope !== 'full' || input.councils.length === 0) {
      throw new Error('Council-scoped ingestion requires a non-empty full census')
    }
    return [...new Set(input.councils)].sort().map(council => ({
      key: `council:${council}:all`, params: { ...common, council },
    }))
  }
  for (const nation of nations) {
    if (input.scope === 'full') {
      specs.push({ key: `${nation}:all`, params: { ...common, nation } })
      continue
    }
    specs.push(
      {
        key: `${nation}:commercial`,
        params: {
          ...common,
          nation,
          commercial_work: 'new,extension,to-commercial,between,loss,minor',
        },
      },
      { key: `${nation}:residential`, params: { ...common, nation, dmin: '1' } },
      { key: `${nation}:new-homes`, params: { ...common, nation, category: 'new-homes' } },
      {
        key: `${nation}:brand-evidence-routes`,
        params: { ...common, nation, procedure: 'advert-consent,listed-building' },
      }
    )
  }
  return specs
}

export function maySpendPlotaRequest(monthlyRemaining: number | null, useDiscoveryReserve = false): boolean {
  // Unknown on the first request is unavoidable. After a response exposes the allowance,
  // the worker stops optional/backfill work before the protected reserve is touched.
  return monthlyRemaining === null || monthlyRemaining > (useDiscoveryReserve ? 0 : PLOTA_REQUEST_RESERVE)
}
