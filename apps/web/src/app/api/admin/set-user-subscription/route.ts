import { NextRequest, NextResponse } from 'next/server'
import { updateUserSubscriptionStatus } from '@/lib/subscription'

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to manually set user subscription status
 * Usage: POST /api/admin/set-user-subscription with:
 * {
 *   userId: "uuid",
 *   status: "active" | "trialing" | "canceled" | etc.
 *   stripeCustomerId?: "cus_xxx",
 *   stripeSubscriptionId?: "sub_xxx"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, status, stripeCustomerId, stripeSubscriptionId } = await request.json()

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'userId and status are required' },
        { status: 400 }
      )
    }

    console.log('[Admin Set] Setting subscription for user:', userId, 'to status:', status);

    const updates: any = {};
    if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
    if (stripeSubscriptionId) updates.stripe_subscription_id = stripeSubscriptionId;

    // For active subscriptions, set payment method added
    if (status === 'active') {
      updates.payment_method_added = true;
    }

    const success = await updateUserSubscriptionStatus(userId, status, updates);

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Subscription updated to ${status}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Update failed - check server logs' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[Admin Set] Error:', error);
    return NextResponse.json(
      { error: 'Set failed', details: error.message },
      { status: 500 }
    );
  }
}
