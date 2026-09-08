import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job: Process GapFinder cache rebuild queue
 *
 * Runs every 30 minutes via Vercel Cron
 *
 * Process:
 * 1. Check for pending rebuild requests in cache_rebuild_queue
 * 2. Check if rebuild already running (via is_rebuild_running())
 * 3. If clear, run the rebuild with the service-role client
 * 4. Mark the queue entry processed only after the database reports completion
 *
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ CRON: Unauthorized request - invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ CRON: Starting cache rebuild queue processing');
    const startTime = Date.now();

    const supabase = adminClient();

    // Check for pending rebuilds (oldest first)
    const { data: pending, error: queueError } = await supabase
      .from('cache_rebuild_queue')
      .select('id, reason, created_at')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queueError) {
      console.error('❌ CRON: Failed to read rebuild queue:', queueError);
      return NextResponse.json({ error: 'Failed to read rebuild queue' }, { status: 500 });
    }

    if (!pending) {
      console.log('ℹ️  CRON: No pending cache rebuilds');
      return NextResponse.json({
        success: true,
        message: 'No pending rebuilds'
      });
    }

    console.log(`📦 CRON: Found pending rebuild request (id: ${pending.id}, reason: ${pending.reason})`);

    // Check if rebuild already running
    const { data: isRunning, error: lockError } = await supabase.rpc('is_rebuild_running');

    if (lockError) {
      console.error('❌ CRON: Error checking rebuild lock:', lockError);
      return NextResponse.json(
        { error: 'Failed to check rebuild lock' },
        { status: 500 }
      );
    }

    if (isRunning) {
      console.log('⏳ CRON: Rebuild already in progress - skipping');
      return NextResponse.json({
        success: true,
        message: 'Rebuild already in progress',
        skipped: true
      });
    }

    console.log('🚀 CRON: Starting cache rebuild...');

    // Keep processed_at NULL until the rebuild has actually completed, so a timeout
    // or failure remains retryable and still blocks duplicate pending queue rows.
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('cache_rebuild_queue')
      .update({
        rebuild_started_at: now,
        error: null
      })
      .eq('id', pending.id);

    if (updateError) {
      console.error('❌ CRON: Error marking queue entry as started:', updateError);
      return NextResponse.json({ error: 'Failed to mark rebuild as started' }, { status: 500 });
    }

    const { data: rebuildData, error: rebuildError } = await supabase.rpc('rebuild_all_bua_summaries', {
      p_user_id: null  // System-triggered
    });

    if (rebuildError) {
      // Log error in queue table
      console.error('❌ CRON: Rebuild failed:', rebuildError);
      await supabase
        .from('cache_rebuild_queue')
        .update({ error: rebuildError.message })
        .eq('id', pending.id);

      return NextResponse.json({
        success: false,
        error: rebuildError.message,
        queue_id: pending.id
      }, { status: 500 });
    }

    const progress = ((rebuildData || []) as Array<{ progress?: string }>)
      .map((row) => row.progress)
      .filter((message): message is string => Boolean(message));

    if (progress.some((message) => message.includes('already in progress'))) {
      await supabase
        .from('cache_rebuild_queue')
        .update({ rebuild_started_at: null })
        .eq('id', pending.id)
        .is('processed_at', null);

      return NextResponse.json({
        success: true,
        message: 'Rebuild already in progress; queue item left pending',
        skipped: true,
        queue_id: pending.id
      });
    }

    const completedAt = new Date().toISOString();
    const { error: completeError } = await supabase
      .from('cache_rebuild_queue')
      .update({
        processed_at: completedAt,
        rebuild_completed_at: completedAt,
        error: null
      })
      .eq('id', pending.id);

    if (completeError) {
      console.error('❌ CRON: Rebuild completed but queue finalization failed:', completeError);
      return NextResponse.json({
        success: false,
        error: 'Rebuild completed but queue finalization failed',
        queue_id: pending.id
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ CRON: Rebuild completed successfully (duration: ${duration}ms)`);

    return NextResponse.json({
      success: true,
      message: 'Rebuild completed',
      queue_id: pending.id,
      reason: pending.reason,
      duration_ms: duration,
      progress
    });

  } catch (error) {
    console.error('❌ CRON: Fatal error processing cache rebuilds:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
