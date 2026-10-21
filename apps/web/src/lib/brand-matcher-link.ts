// The homepage search hands a site to Brand Matcher through the URL:
//   /brand-matcher?site=<address>&pc=<postcode>&sqft=<n>&uc=<E|SG>
// `uc` is left out for "All use classes". Logged-out visitors get the gated preview at that URL;
// members are sent on to the workspace with the same params plus mode=brand-matcher.

import type { BrandMatcherQueryUseClass } from '@/app/sitematcher-unified/types/brand-matcher'

export type HomeUseClass = 'all' | 'E' | 'SG'

export const HOME_USE_CLASSES: { id: HomeUseClass; label: string }[] = [
  { id: 'all', label: 'All use classes' },
  { id: 'E', label: 'Class E' },
  { id: 'SG', label: 'Sui generis' },
]

export interface BrandMatcherSiteParams {
  site: string
  postcode: string
  sqft: number | null
  useClass: HomeUseClass
}

// Full UK postcode, with or without the space.
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i

export function extractPostcode(text: string): string | null {
  const m = text.match(POSTCODE_RE)
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : null
}

export function parseSqft(raw: string | null | undefined): number | null {
  const n = Number((raw ?? '').replace(/[^0-9]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseHomeUseClass(raw: string | null | undefined): HomeUseClass {
  return raw === 'E' || raw === 'SG' ? raw : 'all'
}

export function toQueryUseClass(uc: HomeUseClass): BrandMatcherQueryUseClass {
  if (uc === 'E') return 'E'
  if (uc === 'SG') return 'Sui Generis'
  return 'All'
}

export function fromQueryUseClass(uc: string): HomeUseClass {
  if (uc === 'E') return 'E'
  if (uc === 'Sui Generis') return 'SG'
  return 'all'
}

export function siteSearchParams(p: BrandMatcherSiteParams): URLSearchParams {
  const q = new URLSearchParams()
  q.set('site', p.site)
  q.set('pc', p.postcode)
  if (p.sqft) q.set('sqft', String(p.sqft))
  if (p.useClass !== 'all') q.set('uc', p.useClass)
  return q
}

export function readSiteParams(params: URLSearchParams | Record<string, string | string[] | undefined>): BrandMatcherSiteParams | null {
  const get = (k: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(k)
    const v = params[k]
    return Array.isArray(v) ? v[0] ?? null : v ?? null
  }
  const site = (get('site') ?? '').trim()
  const postcode = extractPostcode(get('pc') ?? '') ?? extractPostcode(site)
  if (!postcode) return null
  return {
    site: site || postcode,
    postcode,
    sqft: parseSqft(get('sqft')),
    useClass: parseHomeUseClass(get('uc')),
  }
}

export function previewHref(p: BrandMatcherSiteParams): string {
  return `/brand-matcher?${siteSearchParams(p).toString()}`
}

export function workspaceHref(p: BrandMatcherSiteParams | null, extra?: Record<string, string>): string {
  const q = p ? siteSearchParams(p) : new URLSearchParams()
  q.set('mode', 'brand-matcher')
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v)
  return `/sitematcher-unified?${q.toString()}`
}
