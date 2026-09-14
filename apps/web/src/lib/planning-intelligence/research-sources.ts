import { isIP } from 'node:net'
import { TextDecoder } from 'node:util'
import type { PlotaApplication } from './types'

export interface ResearchSource {
  kind: 'council_page' | 'document'
  url: string
  text: string
  title?: string
  mediaType?: string
  /** A scanned PDF that needs OpenRouter's bounded OCR pass. */
  ocrFile?: { filename: string; url: string }
}

export interface CouncilResearchSources {
  sources: ResearchSource[]
  warnings: string[]
}

const USER_AGENT = 'CommercialDirectoryPlanningResearch/1.0 (+https://thecommercialdirectory.co.uk)'
const MAX_COUNCIL_CHARACTERS = 12_000
const MAX_DOCUMENT_CHARACTERS = 24_000
const MAX_DOCUMENT_BYTES = 3_000_000
const MAX_DOCUMENTS = 2
const REQUEST_TIMEOUT_MS = 15_000
const HOST_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000
const nextRequestAt = new Map<string, number>()

function publicHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname.endsWith('.local')) return null
    const ipVersion = isIP(hostname)
    if (ipVersion === 4) {
      const [a, b] = hostname.split('.').map(Number)
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null
    }
    if (ipVersion === 6 && (hostname === '::1' || hostname.startsWith('fc')
      || hostname.startsWith('fd') || hostname.startsWith('fe80:'))) return null
    return url
  } catch {
    return null
  }
}

async function pacedFetch(url: URL, init: RequestInit = {}): Promise<Response> {
  const wait = Math.max(0, (nextRequestAt.get(url.host) ?? 0) - Date.now())
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  nextRequestAt.set(url.host, Date.now() + HOST_INTERVAL_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Council request timed out')), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5', ...init.headers },
      signal: controller.signal,
      redirect: init.redirect ?? 'follow',
    })
  } finally {
    clearTimeout(timeout)
  }
}

interface RobotsRule { allow: boolean; path: string }

function robotsRules(text: string): RobotsRule[] {
  const rules: RobotsRule[] = []
  let applies = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (field === 'user-agent') applies = value === '*'
    else if (applies && (field === 'allow' || field === 'disallow') && value) {
      rules.push({ allow: field === 'allow', path: value })
    }
  }
  return rules
}

function allowedByRobots(url: URL, rules: RobotsRule[]): boolean {
  const path = `${url.pathname}${url.search}`
  const matches = rules.filter((rule) => path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)
  return matches[0]?.allow ?? true
}

function htmlText(html: string, limit: number): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}

interface DocumentCandidate {
  url: URL
  label: string
}

function documentPriority(candidate: DocumentCandidate): number {
  const value = `${candidate.label} ${candidate.url.pathname} ${candidate.url.search}`.toLowerCase()
  if (/application\s*form/.test(value)) return 0
  if (/planning\s*statement|design\s*(?:and|&)\s*access/.test(value)) return 1
  return 2
}

function documentLinks(html: string, base: URL): DocumentCandidate[] {
  const links: DocumentCandidate[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/gi, '&'), base)
      if (!publicHttpUrl(url.toString())) continue
      const label = htmlText(match[2], 300)
      const lowerLabel = label.toLowerCase()
      const lowerUrl = `${url.pathname} ${url.search}`.toLowerCase()
      const labelLooksLikeDocument = /\b(application\s*form|documents?|drawings?|plans?|planning\s*statement|design\s*(?:and|&)\s*access)\b/.test(lowerLabel)
      const urlLooksLikeDocument = /(\.pdf\b|\/(?:documents?|attachments?|files?|download)(?:\/|\b)|[?&](?:document|file|attachment)(?:id)?=)/.test(lowerUrl)
      if (!labelLooksLikeDocument && !urlLooksLikeDocument) continue
      // Council sites frequently send their documents to a separate public portal. Only
      // follow a cross-origin link when its own visible label explicitly says what it is.
      if (url.origin !== base.origin && !labelLooksLikeDocument) continue
      url.hash = ''
      if (!seen.has(url.href)) {
        seen.add(url.href)
        links.push({ url, label })
      }
    } catch {
      // Ignore malformed links on council pages.
    }
  }
  // Northgate portals also use a labelled button containing a literal window.open URL.
  // Parse that URL only; never execute page JavaScript.
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0]
    const label = attribute(tag, 'value') ?? ''
    if (!/\bdocuments?\b/i.test(label)) continue
    const target = tag.match(/window\.open\(\s*['"]([^'"]+)['"]/i)?.[1]
    if (!target) continue
    try {
      const url = new URL(target.replace(/&amp;/gi, '&'), base)
      if (!publicHttpUrl(url.href) || seen.has(url.href)) continue
      seen.add(url.href)
      links.push({ url, label })
    } catch { /* Ignore malformed button URLs. */ }
  }
  return links.sort((a, b) => documentPriority(a) - documentPriority(b))
}

function responseCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = headers.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : [])
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean)
}

function mergeCookies(...groups: string[][]): string {
  const values = new Map<string, string>()
  for (const cookie of groups.flat()) {
    const separator = cookie.indexOf('=')
    if (separator > 0) values.set(cookie.slice(0, separator), cookie.slice(separator + 1))
  }
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ')
}

function attribute(html: string, name: string): string | null {
  const match = html.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))
  return match?.[1] ?? null
}

interface OnlineRegisterDocument {
  module: string
  recordNumber: string
  planId: string
  imageId: string
  storedInDatabase: boolean
  fileName: string
  label: string
}

function onlineRegisterDocumentRows(html: string): OnlineRegisterDocument[] {
  const rows: OnlineRegisterDocument[] = []
  for (const match of html.matchAll(/<tr\b([^>]*\bdata-recordnumber=[^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const attrs = match[1]
    const module = attribute(attrs, 'data-module')
    const recordNumber = attribute(attrs, 'data-recordnumber')
    const planId = attribute(attrs, 'data-planid')
    const imageId = attribute(attrs, 'data-imageid')
    const fileName = attribute(attrs, 'data-filename')
    if (!module || !recordNumber || !planId || !imageId || !fileName) continue
    rows.push({
      module, recordNumber, planId, imageId, fileName,
      storedInDatabase: attribute(attrs, 'data-storedindatabase')?.toLowerCase() === 'true',
      label: `${htmlText(match[2], 500)} ${fileName}`,
    })
  }
  return rows.sort((a, b) => {
    const priority = (document: OnlineRegisterDocument) => {
      if (/application\s*form/.test(document.label.toLowerCase())) return 0
      if (/planning\s*statement|design\s*(?:and|&)\s*access/.test(document.label.toLowerCase())) return 1
      return 2
    }
    return priority(a) - priority(b)
  })
}

async function continueUnsupportedBrowser(input: {
  councilUrl: URL; html: string; response: Response; rules: RobotsRule[]
}): Promise<{ html: string; cookies: string } | null> {
  if (!/<title>\s*UnsupportedWebBrowser\s*<\/title>/i.test(input.html)) return null
  const button = input.html.match(/<button\b[^>]*id=["']ContinueBrowsing["'][^>]*>/i)?.[0]
  const target = button ? attribute(button, 'data-url-ignore') : null
  if (!target) return null
  const action = new URL(target, input.councilUrl)
  if (action.origin !== input.councilUrl.origin || !action.pathname.endsWith('/Home/IgnoreBrowserValidation')
    || !allowedByRobots(action, input.rules)) return null
  // The portal's own Continue Browsing button performs this GET and reloads the page.
  const initial = responseCookies(input.response)
  const response = await pacedFetch(action, { headers: { Cookie: mergeCookies(initial) } })
  if (!response.ok) return null
  const cookies = mergeCookies(initial, responseCookies(response))
  const page = await pacedFetch(input.councilUrl, { headers: { Cookie: cookies } })
  if (!page.ok) return null
  return { html: await page.text(), cookies }
}

async function acceptOnlineRegisterDisclaimer(input: {
  councilUrl: URL
  response: Response
  html: string
  warnings: string[]
}): Promise<{ html: string; cookies: string } | null> {
  const simpleAction = input.html.match(/<form\b[^>]*action=["'](\/Disclaimer\/Accept\?[^"']+)["'][^>]*method=["']post["']/i)?.[1]
  if (!simpleAction && !/\/Disclaimer\/AcceptDisclaimer/i.test(input.html)) return null
  const token = input.html.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i)?.[1]
  if (!token && !simpleAction) {
    input.warnings.push('Online Register disclaimer had no verification token')
    return null
  }
  const initialCookies = responseCookies(input.response)
  const form = new URLSearchParams({
    returnURL: `${input.councilUrl.pathname}${input.councilUrl.search}`,
    ...(token ? { __RequestVerificationToken: token } : {}),
  })
  const acceptResponse = await pacedFetch(new URL(simpleAction?.replace(/&amp;/gi, '&') ?? '/Disclaimer/AcceptDisclaimer', input.councilUrl), {
    method: 'POST', redirect: 'manual', body: form,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: mergeCookies(initialCookies),
      Referer: input.councilUrl.href,
    },
  })
  const cookies = mergeCookies(initialCookies, responseCookies(acceptResponse))
  if (!cookies) {
    input.warnings.push('Online Register disclaimer did not establish a public session')
    return null
  }
  const applicationResponse = await pacedFetch(input.councilUrl, { headers: { Cookie: cookies } })
  if (!applicationResponse.ok) {
    input.warnings.push(`Online Register application page returned ${applicationResponse.status}`)
    return null
  }
  return { html: await applicationResponse.text(), cookies }
}

async function onlineRegisterSources(input: {
  councilUrl: URL
  html: string
  cookies: string
  warnings: string[]
}): Promise<ResearchSource[]> {
  const ranked = onlineRegisterDocumentRows(input.html)
  const forms = ranked.filter((document) => /application\s*form/.test(document.label.toLowerCase()))
  const selected = forms.length > 0
    ? forms.slice(0, MAX_DOCUMENTS)
    : ranked.slice(0, MAX_DOCUMENTS)
  const sources: ResearchSource[] = []
  for (const document of selected) {
    const response = await pacedFetch(new URL('/Document/GetFileBinary', input.councilUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: input.cookies,
        Referer: input.councilUrl.href,
      },
      body: new URLSearchParams({
        module: document.module,
        recordNumber: document.recordNumber,
        planID: String(Math.trunc(Number(document.planId))),
        imageID: String(Math.trunc(Number(document.imageId))),
        isPlan: String(document.storedInDatabase),
      }),
    })
    if (!response.ok) {
      input.warnings.push(`Online Register document returned ${response.status}: ${document.fileName}`)
      continue
    }
    const base64 = await response.json() as unknown
    if (typeof base64 !== 'string') {
      input.warnings.push(`Online Register document was not a PDF payload: ${document.fileName}`)
      continue
    }
    const bytes = Buffer.from(base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64, 'base64')
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
      input.warnings.push(`Skipped oversized document: ${document.fileName}`)
      continue
    }
    const evidenceUrl = new URL(input.councilUrl)
    evidenceUrl.hash = `document=${encodeURIComponent(document.fileName)}`
    const safeFilename = document.fileName.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 100) || 'planning-document.pdf'
    sources.push({
      kind: 'document', url: evidenceUrl.href,
      text: `Planning document requiring OCR: ${document.label}`,
      title: document.label,
      mediaType: 'application/pdf',
      ocrFile: {
        filename: safeFilename.toLowerCase().endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`,
        url: `data:application/pdf;base64,${base64}`,
      },
    })
  }
  return sources
}

async function pdfText(bytes: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
  const parts: string[] = []
  for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 20); pageNumber++) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => 'str' in item ? item.str : '').join(' ').trim()
    if (pageText) parts.push(`[PDF page ${pageNumber}] ${pageText}`)
    if (parts.join(' ').length >= MAX_DOCUMENT_CHARACTERS) break
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_DOCUMENT_CHARACTERS)
}

interface PlanPortalDocument {
  ID_PhysicalDoc?: string
  FileName?: string
  Description?: string
  DocumentType?: string
  ID_AppRef?: string
}

async function rulesFor(url: URL, warnings: string[]): Promise<RobotsRule[]> {
  try {
    const robots = await pacedFetch(new URL('/robots.txt', url))
    return robots.ok ? robotsRules(await robots.text()) : []
  } catch (error) {
    warnings.push(`robots.txt could not be read for ${url.host}: ${error instanceof Error ? error.message : 'unknown error'}`)
    return []
  }
}

async function planPortalDocuments(
  portalUrl: URL,
  warnings: string[]
): Promise<DocumentCandidate[]> {
  const reference = portalUrl.searchParams.get('id')
  if (!reference || !portalUrl.hostname.toLowerCase().endsWith('.planportal.co.uk')) return []
  const serviceUrl = new URL('/services/DirectService.ashx', portalUrl)
  const response = await pacedFetch(serviceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      action: 'DirectService', method: 'GetPagedRelatedDocuments',
      data: [reference, 0, 200, null, null, '', 1], type: 'rpc', tid: 1,
    }]),
  })
  if (!response.ok) {
    warnings.push(`Plan Portal document list returned ${response.status}`)
    return []
  }
  const payload = await response.json() as {
    result?: { NewDataSet?: { data1?: PlanPortalDocument[] | PlanPortalDocument } }
  }
  const raw = payload.result?.NewDataSet?.data1
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : []
  const candidates = rows.flatMap((row): DocumentCandidate[] => {
    if (!row.ID_PhysicalDoc) return []
    const url = new URL('/view.aspx', portalUrl)
    url.searchParams.set('id', row.ID_AppRef || reference)
    url.searchParams.set('docid', row.ID_PhysicalDoc)
    return [{
      url,
      label: `${row.Description ?? ''} ${row.DocumentType ?? ''} ${row.FileName ?? ''}`.trim(),
    }]
  }).sort((a, b) => documentPriority(a) - documentPriority(b))
  const applicationForms = candidates.filter((candidate) => documentPriority(candidate) === 0)
  const supportingStatements = candidates.filter((candidate) => documentPriority(candidate) === 1)
  // When the form exists it is the primary structured source. Do not spend bandwidth and
  // model context on arbitrary mining reports or drawings merely to fill the second slot.
  return applicationForms.length > 0
    ? [...applicationForms, ...supportingStatements].slice(0, MAX_DOCUMENTS)
    : candidates.slice(0, MAX_DOCUMENTS)
}

async function readDocument(
  candidate: DocumentCandidate,
  rules: RobotsRule[],
  warnings: string[],
  cookies = ''
): Promise<(ResearchSource & { linkedDocuments?: DocumentCandidate[] }) | null> {
  if (!allowedByRobots(candidate.url, rules)) return null
  try {
    const response = await pacedFetch(candidate.url, cookies ? { headers: { Cookie: cookies } } : {})
    if (!response.ok) {
      warnings.push(`Document returned ${response.status}: ${candidate.url.href}`)
      return null
    }
    const length = Number(response.headers.get('content-length'))
    if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES) {
      warnings.push(`Skipped oversized document: ${candidate.url.href}`)
      return null
    }
    const contentType = response.headers.get('content-type') ?? ''
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
      warnings.push(`Skipped oversized document: ${candidate.url.href}`)
      return null
    }
    const signature = new TextDecoder().decode(bytes.slice(0, 5))
    const isPdf = contentType.includes('pdf') || candidate.url.pathname.toLowerCase().endsWith('.pdf')
      || signature === '%PDF-'
    const text = isPdf
      ? await pdfText(bytes)
      : htmlText(new TextDecoder().decode(bytes), MAX_DOCUMENT_CHARACTERS)
    if (!text && !isPdf) return null
    const safeFilename = `${candidate.label || 'planning-document'}`
      .replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'planning-document'
    return {
      kind: 'document', url: candidate.url.href,
      text: text || `Scanned planning document: ${candidate.label}`,
      title: candidate.label,
      ...(!isPdf ? { linkedDocuments: documentLinks(new TextDecoder().decode(bytes), candidate.url) } : {}),
      mediaType: isPdf ? 'application/pdf' : contentType || 'text/html',
      ...(isPdf && text.length < 100
        ? { ocrFile: { filename: safeFilename.toLowerCase().endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`, url: cookies ? `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}` : candidate.url.href } }
        : {}),
    }
  } catch (error) {
    warnings.push(`Document could not be read: ${error instanceof Error ? error.message : 'unknown error'}`)
    return null
  }
}

export async function collectCouncilResearchSources(
  application: PlotaApplication
): Promise<CouncilResearchSources> {
  const councilUrl = publicHttpUrl(application.links?.council ?? '')
  if (!councilUrl) return { sources: [], warnings: ['No safe public council URL was supplied'] }

  const warnings: string[] = []
  const rules = await rulesFor(councilUrl, warnings)
  if (!allowedByRobots(councilUrl, rules)) {
    return { sources: [], warnings: [...warnings, 'Council page is disallowed by robots.txt'] }
  }

  try {
    const response = await pacedFetch(councilUrl)
    if (!response.ok) return { sources: [], warnings: [...warnings, `Council page returned ${response.status}`] }
    let html = await response.text()
    let onlineRegisterCookies = ''
    const continued = await continueUnsupportedBrowser({ councilUrl, html, response, rules })
    if (continued) { html = continued.html; onlineRegisterCookies = continued.cookies }
    const accepted = await acceptOnlineRegisterDisclaimer({ councilUrl, response, html, warnings })
    if (accepted) {
      html = accepted.html
      onlineRegisterCookies = accepted.cookies
    }
    if (/<title>\s*UnsupportedWebBrowser\s*<\/title>/i.test(html)) {
      return { sources: [], warnings: [...warnings, 'Council portal returned an unsupported-browser page, not an application record'] }
    }
    if (/<form\b[^>]*action=["']\/Disclaimer\/Accept/i.test(html)) {
      return { sources: [], warnings: [...warnings, 'Council disclaimer remains; application record was not retrieved'] }
    }
    const sources: ResearchSource[] = [{
      kind: 'council_page', url: councilUrl.href, text: htmlText(html, MAX_COUNCIL_CHARACTERS),
      mediaType: 'text/html',
    }]

    if (onlineRegisterDocumentRows(html).length > 0) {
      sources.push(...await onlineRegisterSources({
        councilUrl, html, cookies: onlineRegisterCookies, warnings,
      }))
      return { sources, warnings }
    }

    const candidates: DocumentCandidate[] = []
    for (const link of documentLinks(html, councilUrl)) {
      if (link.url.origin === councilUrl.origin) candidates.push(link)
      else {
        const externalRules = await rulesFor(link.url, warnings)
        if (!allowedByRobots(link.url, externalRules)) {
          warnings.push(`Document portal is disallowed by robots.txt: ${link.url.host}`)
          continue
        }
        const portalCandidates = await planPortalDocuments(link.url, warnings)
        if (portalCandidates.length > 0) {
          for (const portalCandidate of portalCandidates) {
            if (sources.length - 1 >= MAX_DOCUMENTS) break
            const source = await readDocument(portalCandidate, externalRules, warnings)
            if (source) sources.push(source)
          }
        } else {
          candidates.push(link)
        }
      }
      if (sources.length - 1 + candidates.length >= MAX_DOCUMENTS) break
    }
    for (const candidate of candidates.sort((a, b) => documentPriority(a) - documentPriority(b))) {
      if (sources.length - 1 >= MAX_DOCUMENTS) break
      const candidateRules = candidate.url.origin === councilUrl.origin
        ? rules : await rulesFor(candidate.url, warnings)
      const source = await readDocument(candidate, candidateRules, warnings, candidate.url.origin === councilUrl.origin ? onlineRegisterCookies : '')
      if (!source) continue
      // A Documents link often opens a listing rather than a PDF. Follow one bounded
      // level and prioritise forms/statements instead of treating the menu as evidence.
      const children = (source.linkedDocuments ?? []).filter(link => link.url.href !== candidate.url.href)
      if (children.length > 0) {
        for (const child of children.slice(0, MAX_DOCUMENTS)) {
          if (sources.length - 1 >= MAX_DOCUMENTS) break
          const childRules = child.url.origin === candidate.url.origin
            ? candidateRules : await rulesFor(child.url, warnings)
          const document = await readDocument(child, childRules, warnings, child.url.origin === councilUrl.origin ? onlineRegisterCookies : '')
          if (document) {
            const { linkedDocuments: ignored, ...evidence } = document
            sources.push(evidence)
          }
        }
      } else {
        const { linkedDocuments: ignored, ...evidence } = source
        sources.push(evidence)
      }
    }
    if (!sources.some(source => source.mediaType === 'application/pdf')) {
      warnings.push('No application PDF retrieved; floor area and site area may be missing')
    }
    return { sources, warnings }
  } catch (error) {
    return {
      sources: [],
      warnings: [...warnings, `Council page could not be read: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}
