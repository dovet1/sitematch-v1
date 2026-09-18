// Server-only Companies House Public Data API client. Auth is HTTP Basic with the API key as
// the username and an empty password. The limit is 600 requests per 5 minutes per key.

import type { ChCompanyProfile, ChSearchItem, ChSearchResponse } from './types'

const BASE = 'https://api.company-information.service.gov.uk'
// On a 429, wait at most this long before one retry; a caller that needs more backs off itself.
const MAX_RETRY_WAIT_MS = 10_000

export class CompaniesHouseConfigError extends Error {}

export class CompaniesHouseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export function isCompaniesHouseConfigured(): boolean {
  return !!process.env.COMPANIES_HOUSE_KEY
}

function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_KEY
  if (!key) throw new CompaniesHouseConfigError('COMPANIES_HOUSE_KEY is not set')
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// null on 404 — "no such company" is an answer, not a failure.
async function get<T>(path: string, retried = false): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (res.status === 429 && !retried) {
    const retryAfter = Number(res.headers.get('retry-after'))
    await sleep(Math.min(MAX_RETRY_WAIT_MS, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000))
    return get<T>(path, true)
  }
  if (!res.ok) {
    throw new CompaniesHouseError(`Companies House ${path} failed (${res.status})`, res.status)
  }
  return (await res.json()) as T
}

export async function searchCompanies(query: string, itemsPerPage = 20): Promise<ChSearchItem[]> {
  const q = encodeURIComponent(query.trim())
  const body = await get<ChSearchResponse>(`/search/companies?q=${q}&items_per_page=${itemsPerPage}`)
  return body?.items ?? []
}

export function getCompanyProfile(companyNumber: string): Promise<ChCompanyProfile | null> {
  return get<ChCompanyProfile>(`/company/${encodeURIComponent(companyNumber)}`)
}
