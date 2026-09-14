/** Fetch for council servers that omit their intermediate certificate.
 *
 * Browsers complete such a chain by downloading the intermediate named in the site certificate's
 * Authority Information Access field. Node's fetch does not, so these councils looked blocked
 * ("fetch failed") although they serve the public normally. This module does what a browser
 * does: read the site certificate, download the named intermediate, check that it really issued
 * the site certificate, then connect again with full TLS verification against Node's root store.
 * The intermediate is never a trust anchor on its own; the chain must still end at a trusted root.
 */
import { X509Certificate } from 'node:crypto'
import https from 'node:https'
import tls from 'node:tls'

const CHAIN_ERRORS = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_GET_ISSUER_CERT'])
const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 5_000_000
const MAX_INTERMEDIATES = 3
const intermediatesByHost = new Map<string, Promise<string[]>>()
let trustedRoots: X509Certificate[] | null = null

function issuedByTrustedRoot(certificate: X509Certificate): boolean {
  trustedRoots ??= tls.rootCertificates.map((pem) => new X509Certificate(pem))
  return trustedRoots.some((root) => certificate.checkIssued(root) && certificate.verify(root.publicKey))
}

/** True when fetch failed only because the server sent an incomplete certificate chain. */
export function isIncompleteChainError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } } | null)?.cause
  return Boolean(cause?.code && CHAIN_ERRORS.has(cause.code))
}

function siteCertificate(host: string, port: number): Promise<X509Certificate | null> {
  return new Promise((resolve) => {
    // Reads the certificate only; nothing is sent or trusted over this connection.
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const raw = socket.getPeerCertificate(false)?.raw
      socket.end()
      resolve(raw ? new X509Certificate(raw) : null)
    })
    socket.on('error', () => resolve(null))
    socket.on('timeout', () => { socket.destroy(); resolve(null) })
  })
}

function issuerUrl(certificate: X509Certificate): URL | null {
  const value = certificate.infoAccess?.match(/CA Issuers - URI:(\S+)/)?.[1]
  try {
    const url = value ? new URL(value) : null
    return url && ['http:', 'https:'].includes(url.protocol) ? url : null
  } catch {
    return null
  }
}

async function issuerOf(certificate: X509Certificate): Promise<X509Certificate | null> {
  const url = issuerUrl(certificate)
  if (!url) return null
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) return null
  try {
    const issuer = new X509Certificate(Buffer.from(await response.arrayBuffer()))
    return issuer.ca && certificate.checkIssued(issuer) && certificate.verify(issuer.publicKey) ? issuer : null
  } catch {
    return null
  }
}

/** Intermediates from the site certificate up to one issued by a trusted root (some chains have two). */
async function loadIntermediates(host: string, port: number): Promise<string[]> {
  let current = await siteCertificate(host, port)
  const chain: string[] = []
  while (current && !issuedByTrustedRoot(current) && chain.length < MAX_INTERMEDIATES) {
    current = await issuerOf(current)
    if (current) chain.push(current.toString())
  }
  return chain
}

function intermediatesFor(url: URL): Promise<string[]> {
  const port = Number(url.port) || 443
  const key = `${url.hostname}:${port}`
  if (!intermediatesByHost.has(key)) {
    intermediatesByHost.set(key, loadIntermediates(url.hostname, port).catch(() => []))
  }
  return intermediatesByHost.get(key)!
}

function headerRecord(headers: RequestInit['headers']): Record<string, string> {
  return Object.fromEntries(new Headers(headers).entries())
}

function request(url: URL, init: RequestInit, ca: string[]): Promise<Response> {
  return new Promise((resolve, reject) => {
    const body = typeof init.body === 'string' || init.body instanceof URLSearchParams ? String(init.body) : undefined
    const headers = headerRecord(init.headers)
    if (init.body instanceof URLSearchParams && !headers['content-type']) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    }
    if (body !== undefined) headers['content-length'] = String(Buffer.byteLength(body))
    const outgoing = https.request(url, {
      method: init.method ?? 'GET', headers, ca, servername: url.hostname, signal: init.signal ?? undefined,
      maxHeaderSize: 64_000,
    }, (incoming) => {
      const chunks: Buffer[] = []
      let size = 0
      incoming.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BODY_BYTES) { incoming.destroy(new Error('Council response too large')); return }
        chunks.push(chunk)
      })
      incoming.on('error', reject)
      incoming.on('end', () => {
        const responseHeaders = new Headers()
        for (const [name, value] of Object.entries(incoming.headers)) {
          for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
            responseHeaders.append(name, item)
          }
        }
        const status = incoming.statusCode ?? 502
        const nullBody = [101, 204, 205, 304].includes(status)
        resolve(new Response(nullBody ? null : Buffer.concat(chunks), {
          status, statusText: incoming.statusMessage, headers: responseHeaders,
        }))
      })
    })
    outgoing.on('error', reject)
    outgoing.end(body)
  })
}

/** Retries a request whose fetch failed on an incomplete chain. Returns null if the chain cannot be completed. */
export async function fetchCompletingChain(url: URL, init: RequestInit = {}): Promise<Response | null> {
  let current = url
  let currentInit = init
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const ca = current.protocol === 'https:' ? [...tls.rootCertificates, ...await intermediatesFor(current)] : []
    const response = current.protocol === 'https:'
      ? await request(current, currentInit, ca).catch((error) => {
        if ((error as { code?: string }).code && CHAIN_ERRORS.has((error as { code: string }).code)) return null
        throw error
      })
      : await fetch(current, currentInit)
    if (!response) return null
    const location = response.headers.get('location')
    if (init.redirect === 'manual' || response.status < 300 || response.status >= 400 || !location) return response
    current = new URL(location, current)
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentInit.method === 'POST')) {
      currentInit = { ...currentInit, method: 'GET', body: undefined }
    }
  }
  throw new Error('Council request redirected too many times')
}
