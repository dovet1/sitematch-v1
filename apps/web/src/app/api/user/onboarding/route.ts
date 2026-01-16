import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/user/onboarding - Check if user has completed onboarding
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Fetch user metadata
    const { data: userData, error } = await supabase.auth.admin.getUserById(user.id);

    if (error || !userData?.user) {
      console.error('Error fetching user metadata:', error);
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    const metadata = userData.user.user_metadata || {};
    const onboardingCompleted = metadata.onboarding_completed === true;
    const completedAt = metadata.onboarding_completed_at;
    const skipped = metadata.onboarding_skipped === true;

    return NextResponse.json({
      completed: onboardingCompleted,
      completed_at: completedAt,
      skipped,
    });
  } catch (error) {
    console.error('Error in GET /api/user/onboarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/user/onboarding - Mark onboarding as completed
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { skipped } = body;

    const supabase = await createServerClient();

    // Update user metadata
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_skipped: skipped === true,
      },
    });

    if (error) {
      console.error('Error updating user metadata:', error);
      return NextResponse.json({ error: 'Failed to update onboarding status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      completed: true,
      skipped: skipped === true,
    });
  } catch (error) {
    console.error('Error in POST /api/user/onboarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
