import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Records every brand's store estate into brand_store_snapshots.
 *
 * Runs daily rather than monthly even though the grain is monthly. A monthly job that
 * fails leaves a permanent hole — the estate it would have captured is gone, because
 * store counts are derived live and nothing else remembers them. A daily job overwrites
 * the current month in place, so a failed day costs nothing and the month closes on
 * whatever the last successful run saw.
 *
 * Each run refreshes the previous month as well as the current one. Without that, a month
 * would be frozen at 03:00 on its final day and lose its last 21 hours; the previous
 * month is only rewritten while it is still the most recent one, so the cost is one extra
 * aggregate per day and never a rewrite of settled history.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase service credentials are not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const now = new Date()
  // UTC throughout: the snapshot month has to agree with the database's own
  // date_trunc('month', current_date), and a local-time month boundary would disagree
  // with it for part of every day under British Summer Time.
  const currentMonth = firstOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth())
  const previousMonth = firstOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth() - 1)

  const results: { month: string; status: 'ok' | 'failed'; rows?: number; error?: string }[] = []

  // Previous month first, so if the run is cut short it is the month still accepting
  // corrections that got written rather than the one about to be sealed.
  for (const month of [previousMonth, currentMonth]) {
    const { data, error } = await supabase.rpc('snapshot_brand_stores', { p_month: month })
    if (error) {
      console.error(`[brand-snapshots] Failed to snapshot ${month}`, error)
      results.push({ month, status: 'failed', error: error.message })
    } else {
      results.push({ month, status: 'ok', rows: typeof data === 'number' ? data : 0 })
    }
  }

  const failed = results.filter((r) => r.status === 'failed')
  return NextResponse.json(
    { success: failed.length === 0, results },
    { status: failed.length === results.length ? 500 : 200 }
  )
}

/** Month index may be -1 for January's predecessor; Date normalises it into the prior year. */
function firstOfMonthUTC(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)
}
