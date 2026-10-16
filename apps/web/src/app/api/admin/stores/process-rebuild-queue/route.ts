import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-auth';
import { requireAdmin } from '@/lib/auth';
import { queueCacheRebuild } from '@/lib/cache-rebuild-queue';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint: request a BUA summary rebuild
 *
 * Queues a 'manual' rebuild (a no-op if one is already pending) and returns the
 * most recent queue entries. The rebuild runs in the database: the pg_cron job
 * process-cache-rebuild-queue claims the oldest pending entry every 5 minutes and
 * records rebuild_completed_at or error on it.
 *
 * Authentication: Requires admin user
 */
export async function POST() {
  try {
    await requireAdmin();

    const queued = await queueCacheRebuild('manual');
    if (!queued.queued) {
      console.error('❌ ADMIN: Failed to queue cache rebuild:', queued.error);
      return NextResponse.json({ error: 'Failed to queue rebuild' }, { status: 500 });
    }

    const { data: recent, error: recentError } = await adminClient()
      .from('cache_rebuild_queue')
      .select('id, reason, created_at, rebuild_started_at, rebuild_completed_at, error')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('⚠️  ADMIN: Failed to read rebuild queue:', recentError);
    }

    return NextResponse.json({
      success: true,
      message: 'Rebuild queued; it starts within 5 minutes',
      queue: recent ?? []
    }, { status: 202 });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Admin access required'
      }, { status: 401 });
    }

    console.error('❌ ADMIN: Fatal error queueing cache rebuild:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
