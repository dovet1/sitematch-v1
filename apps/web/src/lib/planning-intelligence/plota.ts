import type { PlotaPage, SearchSpec } from './types'

export const PLOTA_BASE_URL = 'https://api.plota.co.uk/v1'
export const PLOTA_INTERNAL_MONTHLY_LIMIT = 15_000
export const PLOTA_REQUEST_RESERVE = 5_000

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
 */
export function buildSearchSpecs(input: {
  scope: CensusScope
  dateFrom: string
  dateTo: string
  pageSize: number
  nations?: string[]
}): SearchSpec[] {
  const nations = input.nations ?? ['england', 'scotland', 'wales', 'northern-ireland']
  const common = {
    date_from: input.dateFrom,
    date_to: input.dateTo,
    limit: String(input.pageSize),
  }
  const specs: SearchSpec[] = []
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
      {
        key: `${nation}:brand-evidence-routes`,
        params: { ...common, nation, procedure: 'advert-consent,listed-building' },
      }
    )
  }
  return specs
}

export function maySpendPlotaRequest(monthlyRemaining: number | null): boolean {
  // Unknown on the first request is unavoidable. After a response exposes the allowance,
  // the worker stops optional/backfill work before the protected reserve is touched.
  return monthlyRemaining === null || monthlyRemaining > PLOTA_REQUEST_RESERVE
}
