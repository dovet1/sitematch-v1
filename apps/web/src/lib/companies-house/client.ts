// Server-only Companies House Public Data API client. Auth is HTTP Basic with the API key as
// the username and an empty password. The limit is 600 requests per 5 minutes per key.

import type { ChCompanyProfile, ChDocumentMetadata, ChFilingItem, ChSearchItem, ChSearchResponse } from './types'

const BASE = 'https://api.company-information.service.gov.uk'
const DOCUMENT_HOST = 'https://document-api.company-information.service.gov.uk/'
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

// null on 404 — "no such company" is an answer, not a failure. `path` may be a full
// document-API URL (filing links point there).
async function get<T>(path: string, retried = false): Promise<T | null> {
  const res = await fetch(path.startsWith('https://') ? path : `${BASE}${path}`, {
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

export async function getAccountsFilings(companyNumber: string): Promise<ChFilingItem[]> {
  const body = await get<{ items?: ChFilingItem[] }>(
    `/company/${encodeURIComponent(companyNumber)}/filing-history?category=accounts&items_per_page=10`
  )
  return body?.items ?? []
}

export function getDocumentMetadata(metadataUrl: string): Promise<ChDocumentMetadata | null> {
  if (!metadataUrl.startsWith(DOCUMENT_HOST)) throw new CompaniesHouseError(`Unexpected document URL ${metadataUrl}`, 400)
  return get<ChDocumentMetadata>(metadataUrl)
}

// The content endpoint answers with a redirect to a signed storage URL, which must be fetched
// without our Authorization header.
async function fetchDocument(metadataUrl: string, contentType: string): Promise<Response> {
  if (!metadataUrl.startsWith(DOCUMENT_HOST)) throw new CompaniesHouseError(`Unexpected document URL ${metadataUrl}`, 400)
  const res = await fetch(`${metadataUrl}/content`, {
    headers: { Authorization: authHeader(), Accept: contentType },
    redirect: 'manual',
    cache: 'no-store',
  })
  const location = res.headers.get('location')
  const body = location ? await fetch(location, { cache: 'no-store' }) : res
  if (!body.ok) throw new CompaniesHouseError(`Companies House document failed (${body.status})`, body.status)
  return body
}

export async function getDocumentContent(metadataUrl: string, contentType: string): Promise<string> {
  return (await fetchDocument(metadataUrl, contentType)).text()
}

export async function getDocumentBytes(metadataUrl: string, contentType: string): Promise<Buffer> {
  return Buffer.from(await (await fetchDocument(metadataUrl, contentType)).arrayBuffer())
}
