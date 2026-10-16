import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { queueCacheRebuild } from '@/lib/cache-rebuild-queue'
import type { RebuildResponse } from '@/types/store-import'

export const runtime = 'nodejs'

// Queues a rebuild rather than running it: called through PostgREST,
// rebuild_all_bua_summaries is cancelled by the 8s statement_timeout. The pg_cron job
// process-cache-rebuild-queue runs it within 5 minutes.
export async function POST() {
  try {
    await requireAdmin()

    const queued = await queueCacheRebuild('manual')
    if (!queued.queued) {
      console.error('Failed to queue rebuild:', queued.error)
      return NextResponse.json({
        success: false,
        progress: [],
        error: queued.error || 'Failed to queue rebuild'
      } as RebuildResponse, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      progress: [],
      message: 'BUA summary rebuild queued; it starts within 5 minutes'
    } as RebuildResponse, { status: 202 })

  } catch (error: any) {
    console.error('Rebuild endpoint error:', error)
    return NextResponse.json({
      success: false,
      progress: [],
      error: error.message || 'Failed to queue rebuild'
    } as RebuildResponse, { status: 500 })
  }
}
