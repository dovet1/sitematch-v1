import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getUserSubscriptionStatus } from '@/lib/subscription'

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to check and diagnose user subscription issues
 * Usage: POST /api/admin/check-user-subscription with { userId: "uuid" }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    console.log('[Admin Check] Checking subscription for user:', userId);

    // Get subscription using the service
    const subscription = await getUserSubscriptionStatus(userId);

    console.log('[Admin Check] Subscription from service:', subscription);

    // Also query directly to compare
    const supabase = createAdminClient();
    const { data: directData, error: directError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('[Admin Check] Direct query result:', { data: directData, error: directError });

    return NextResponse.json({
      subscription,
      directQuery: {
        data: directData,
        error: directError
      }
    });

  } catch (error: any) {
    console.error('[Admin Check] Error:', error);
    return NextResponse.json(
      { error: 'Check failed', details: error.message },
      { status: 500 }
    );
  }
}
