import { NextRequest, NextResponse } from 'next/server'
import { adminClient, adminError, requireAdminUser } from '@/lib/admin-auth'
import { parseCursor, refreshStep } from '@/lib/brand-matcher-demographics-refresh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * "Refresh Brand Matcher demographics" — the button on /admin/stores/import.
 *
 * After stores are imported, each brand's town profile and its backtest score need rebuilding
 * before the Brand Matcher's demographic pill reflects them. That is a few minutes of work, so it
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
      rebuildProfiles: async (brandIds) => {
        const { data, error } = await db.rpc('rebuild_brand_demographic_profiles', { p_brand_ids: brandIds })
        if (error) throw error
        return Number(data ?? 0)
      },
      recordBacktest: async (level, from, to) => {
        const { data, error } = await db.rpc('record_brand_demographic_backtest', {
          p_level: level,
          p_unit_from: from,
          p_unit_to: to,
        })
        if (error) throw error
        return Number(data ?? 0)
      },
      now: () => Date.now(),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return adminError('Brand Matcher demographics refresh', error)
  }
}
