import { NextRequest, NextResponse } from 'next/server'
import { adminClient, adminError, requireAdminUser } from '@/lib/admin-auth'
import { parseCursor, refreshStep } from '@/lib/brand-matcher-demographics-refresh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * "Refresh Brand Matcher demographics" — the button on /admin/stores/import.
 *
 * After stores are imported, each store's town needs placing before the Brand Matcher's town match
 * reflects them. That is a few minutes of work, so it
 * runs as a series of short steps: the button posts the cursor this route last returned until the
 * route says it is done. See lib/brand-matcher-demographics-refresh.ts.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error

  const cursor = parseCursor(await request.json().catch(() => null))
  if (!cursor) return NextResponse.json({ success: false, error: 'Invalid refresh cursor' }, { status: 400 })

  try {
    const db = adminClient()
    const result = await refreshStep(cursor, {
      listBrandIds: async () => {
        const ids: string[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db.from('brands').select('id').order('id').range(from, from + 999)
          if (error) throw error
          ids.push(...(data ?? []).map((r) => r.id as string))
          if (!data || data.length < 1000) return ids
        }
      },
      // The Brand Matcher now matches towns (migration 20261029000000): the only thing a store
      // import changes is which town each store is in.
      rebuildProfiles: async (brandIds) => {
        const { data, error } = await db.rpc('rebuild_store_buas', { p_brand_ids: brandIds })
        if (error) throw error
        return Number(data ?? 0)
      },
      // Catchment profiles and their backtest are no longer read, so nothing is recorded and the
      // backtest stages end at once.
      recordBacktest: async () => 0,
      now: () => Date.now(),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return adminError('Brand Matcher demographics refresh', error)
  }
}
