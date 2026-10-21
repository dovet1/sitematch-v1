import { NextRequest, NextResponse } from 'next/server'
import { isBrandMatcherEnabled } from '@/lib/feature-flags'
import { signalSummaries, sortMatches, turnoverValue } from '@/app/sitematcher-unified/lib/brand-matcher'
import type {
  BrandMatch,
  BrandMatcherPreviewList,
  BrandMatcherPreviewResponse,
  BrandMatcherPreviewUseClass,
  BrandMatcherQuery,
  BrandMatcherUseClass,
} from '@/app/sitematcher-unified/types/brand-matcher'
import { HOME_CLASS_CODES } from '@/lib/brand-matcher-link'
import { matchSite, parseQuery } from '../engine'

export const dynamic = 'force-dynamic'

// Brand Matcher preview for logged-out visitors (docs/design_handoff_homepage_trial). No sign-in:
// it is what the homepage search lands on. So everything that identifies a brand is stripped
// here, before the response leaves the server: no id, name, logo, domain or contact details, and
// only the top VISIBLE rows carry their signals. The rest of the list is a count.
//
// The match runs once with every use class; each use class's list is cut from it,
// so the preview's use-class dropdown never refetches.

const VISIBLE = 3

// Best-effort abuse limits for an unauthenticated, fairly heavy query. Per server instance, so
// they bound a burst rather than enforce a global quota.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 20
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 200

const hits = new Map<string, number[]>()
const cache = new Map<string, { at: number; payload: BrandMatcherPreviewResponse }>()

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

function limited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > MAX_PER_WINDOW
}

// A brand with no stated use class is never excluded on use class, as in the member list.
function inClass(m: BrandMatch, code: BrandMatcherUseClass): boolean {
  return !m.useClass || m.useClass.codes.includes(code)
}

function toList(matches: BrandMatch[], query: Pick<BrandMatcherQuery, 'useClass'>): BrandMatcherPreviewList {
  const ranked = sortMatches(matches, 'best')
  return {
    total: ranked.length,
    rows: ranked.slice(0, VISIBLE).map((m) => ({
      score: m.score,
      category: m.category,
      storeCount: m.storeCount,
      signals: signalSummaries(m, query),
      turnover: m.tradingFacts ? turnoverValue(m.tradingFacts) : null,
      contactCount: m.contacts.total,
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isBrandMatcherEnabled())) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const query = parseQuery(body ? { ...body, useClass: 'All', widen: false } : null)
    if (typeof query === 'string') return NextResponse.json({ error: query }, { status: 400 })

    const key = `${query.postcode}|${query.sqft}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return NextResponse.json(hit.payload)

    if (limited(clientIp(request))) {
      return NextResponse.json(
        { error: 'Too many searches. Start a free trial to keep matching, or try again in a few minutes.' },
        { status: 429 }
      )
    }

    const result = await matchSite(query)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const { site, matches, considered } = result.payload

    const payload: BrandMatcherPreviewResponse = {
      site: { postcode: site.postcode, centre: site.centre?.name ?? null },
      sqft: query.sqft,
      considered,
      lists: {
        all: toList(matches, { useClass: 'All' }),
        ...(Object.fromEntries(
          Object.entries(HOME_CLASS_CODES).map(([id, code]) => [
            id,
            toList(matches.filter((m) => inClass(m, code)), { useClass: code }),
          ])
        ) as Record<Exclude<BrandMatcherPreviewUseClass, 'all'>, BrandMatcherPreviewList>),
      },
    }

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(key, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Brand matcher preview failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
