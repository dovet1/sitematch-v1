import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Admin endpoint: Manually process cache rebuild queue
 *
 * Allows admins to immediately trigger rebuild processing
 * instead of waiting for the next cron cycle.
 *
 * Process:
 * 1. Check for pending rebuild requests in cache_rebuild_queue
 * 2. Check if rebuild already running (via is_rebuild_running())
 * 3. If clear, trigger rebuild and mark queue entry as processed
 * 4. Fire-and-forget: rebuild continues in database after request timeout
 *
 * Authentication: Requires admin user
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const user = await requireAdmin();

    console.log(`✅ ADMIN: Processing cache rebuild queue (user: ${user.id})`);
    const startTime = Date.now();

    const supabase = await createServerClient();

    // Check for pending rebuilds (oldest first)
    const { data: pending, error: queueError } = await supabase
      .from('cache_rebuild_queue')
      .select('id, reason, created_at')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (queueError || !pending) {
      console.log('ℹ️  ADMIN: No pending cache rebuilds');
      return NextResponse.json({
        success: true,
        message: 'No pending rebuilds'
      });
    }

    console.log(`📦 ADMIN: Found pending rebuild request (id: ${pending.id}, reason: ${pending.reason})`);

    // Check if rebuild already running
    const { data: isRunning, error: lockError } = await supabase.rpc('is_rebuild_running');

    if (lockError) {
      console.error('❌ ADMIN: Error checking rebuild lock:', lockError);
      return NextResponse.json(
        { error: 'Failed to check rebuild lock' },
        { status: 500 }
      );
    }

    if (isRunning) {
      console.log('⏳ ADMIN: Rebuild already in progress - skipping');
      return NextResponse.json({
        success: true,
        message: 'Rebuild already in progress',
        skipped: true
      });
    }

    console.log('🚀 ADMIN: Starting cache rebuild...');

    // Mark as processed (starting rebuild)
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('cache_rebuild_queue')
      .update({
        processed_at: now,
        rebuild_started_at: now
      })
      .eq('id', pending.id);

    if (updateError) {
      console.error('⚠️  ADMIN: Error marking queue entry as processed:', updateError);
    }

    // Trigger rebuild (fire-and-forget)
    // Rebuild continues in database even after request timeout
    const { error: rebuildError } = await supabase.rpc('rebuild_all_bua_summaries', {
      p_user_id: user.id  // Admin-triggered
    });

    if (rebuildError) {
      // Log error in queue table
      console.error('❌ ADMIN: Rebuild failed:', rebuildError);
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

    const duration = Date.now() - startTime;
    console.log(`✅ ADMIN: Rebuild started successfully (duration: ${duration}ms)`);

    return NextResponse.json({
      success: true,
      message: 'Rebuild started',
      queue_id: pending.id,
      reason: pending.reason,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ ADMIN: Fatal error processing cache rebuilds:', error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Admin access required'
      }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
