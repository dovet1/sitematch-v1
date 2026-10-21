import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess } from '@/lib/directory'
import { isBrandMatcherEnabled } from '@/lib/feature-flags'
import { brandMatcherStats, matchSite, parseQuery } from './engine'

export const dynamic = 'force-dynamic'

// Brand Matcher for members (Plus-gated). The matching itself lives in ./engine.

async function gate(): Promise<NextResponse | null> {
  if (!(await isBrandMatcherEnabled())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const access = await requirePlusAccess()
  return access.error
}

// Hero stat: brands we can match at all (an estate size profile or a live requirement).
export async function GET() {
  try {
    const denied = await gate()
    if (denied) return denied
    return NextResponse.json(await brandMatcherStats())
  } catch (error) {
    console.error('Brand matcher stats failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await gate()
    if (denied) return denied

    const query = parseQuery(await request.json().catch(() => null))
    if (typeof query === 'string') return NextResponse.json({ error: query }, { status: 400 })

    const result = await matchSite(query)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.payload)
  } catch (error) {
    console.error('Brand matcher failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
