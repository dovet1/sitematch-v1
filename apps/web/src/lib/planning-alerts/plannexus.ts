import type { MonthlyPeriod } from './period'
import type { PlanningAlertApplication } from './types'

const DEFAULT_BASE_URL = 'https://api.plannexus.io/v1'
const PAGE_SIZE = 100
const DEFAULT_MAX_PAGES_PER_PREFIX = 25
const MAX_RETRY_AFTER_SECONDS = 60

interface PlanNexusEnvelope {
  data?: unknown[]
  meta?: {
    page?: number
    /** Name shown in the public docs. */
    pages?: number
    /** Name currently returned by the live API. */
    total_pages?: number
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function httpUrl(value: unknown): string | null {
  const candidate = stringValue(value)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function mapPlanNexusApplication(raw: unknown): PlanningAlertApplication | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const location = row.location && typeof row.location === 'object'
    ? row.location as Record<string, unknown>
    : {}
  const id = stringValue(row.id) ?? stringValue(row.application_id)
  const reference = stringValue(row.reference)
  const lat = numberValue(row.latitude) ?? numberValue(row.lat) ?? numberValue(location.lat)
  const lng = numberValue(row.longitude) ?? numberValue(row.lng) ?? numberValue(location.lng)
  const dateReceived = stringValue(row.date_received)
  if (!id || !reference || lat === null || lng === null || !dateReceived) return null

  const authority = row.authority && typeof row.authority === 'object'
    ? row.authority as Record<string, unknown>
    : {}

  return {
    id,
    reference,
    address: stringValue(row.address) ?? 'Address unavailable',
    postcode: stringValue(row.postcode),
    description: stringValue(row.description) ?? 'No description supplied.',
    status: stringValue(row.status) ?? 'Unknown',
    applicationType: stringValue(row.application_type),
    authorityName: stringValue(row.authority_name) ?? stringValue(authority.name),
    dateReceived,
    lat,
    lng,
    sourceUrl: httpUrl(row.url) ?? httpUrl(row.source_url),
    nearestStore: null,
  }
}

function inclusiveEnd(period: MonthlyPeriod): string {
  const date = new Date(`${period.end}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

async function requestPage(url: string, apiKey: string): Promise<PlanNexusEnvelope> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    let response: Response
    try {
      response = await fetch(url, {
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (response.ok) return response.json() as Promise<PlanNexusEnvelope>

    const retryAfter = response.headers.get('retry-after')
    if (response.status === 429 && attempt === 0) {
      const seconds = Math.min(
        MAX_RETRY_AFTER_SECONDS,
        Math.max(1, Number.parseInt(retryAfter ?? '5', 10) || 5)
      )
      console.info(`[planning-alerts] PlanNexus rate limit reached; retrying in ${seconds}s`)
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
      continue
    }
    throw new Error(
      `PlanNexus request failed (${response.status})${retryAfter ? `; retry after ${retryAfter}s` : ''}`
    )
  }
  throw new Error('PlanNexus request failed after retry')
}

export async function fetchPlanNexusApplications(options: {
  period: MonthlyPeriod
  postcodePrefixes: string[]
  apiKey?: string
  baseUrl?: string
  maxPagesPerPrefix?: number
}): Promise<PlanningAlertApplication[]> {
  const apiKey = options.apiKey ?? process.env.PLANNEXUS_API_KEY
  if (!apiKey) throw new Error('PLANNEXUS_API_KEY is not configured')

  const prefixes = Array.from(new Set(options.postcodePrefixes.map((p) => p.trim().toUpperCase()).filter(Boolean)))
  if (prefixes.length === 0) {
    throw new Error('At least one PlanNexus postcode prefix is required; refusing a national query')
  }

  const baseUrl = (options.baseUrl ?? process.env.PLANNEXUS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const maxPages = options.maxPagesPerPrefix ?? DEFAULT_MAX_PAGES_PER_PREFIX
  const found = new Map<string, PlanningAlertApplication>()

  for (const prefix of prefixes) {
    let requestedPages = 0
    for (let page = 1; page <= maxPages; page++) {
      const query = new URLSearchParams({
        postcode: prefix,
        date_received_from: options.period.start,
        date_received_to: inclusiveEnd(options.period),
        sort: 'date_received',
        order: 'desc',
        page: String(page),
        per_page: String(PAGE_SIZE),
      })
      const envelope = await requestPage(`${baseUrl}/applications?${query}`, apiKey)
      requestedPages++
      for (const raw of envelope.data ?? []) {
        const application = mapPlanNexusApplication(raw)
        if (application) found.set(application.id, application)
      }

      const reportedPages = envelope.meta?.pages ?? envelope.meta?.total_pages
      const pages = reportedPages ?? page
      if (page >= pages || (reportedPages === undefined && (envelope.data?.length ?? 0) < PAGE_SIZE)) break
      if (page === maxPages) {
        throw new Error(`PlanNexus result exceeded ${maxPages} pages for ${prefix}; narrow the query prefixes`)
      }
    }
    console.info(
      `[planning-alerts] PlanNexus ${prefix}: ${requestedPages} page${requestedPages === 1 ? '' : 's'}; ${found.size} unique candidates so far`
    )
  }

  return Array.from(found.values())
}
