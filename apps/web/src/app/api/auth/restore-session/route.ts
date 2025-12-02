import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Use admin client to generate a session token for the user
    const adminSupabase = createAdminClient();

    // Get user from database to verify they exist
    const { data: user, error: userError } = await adminSupabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      console.error('User not found:', userId, userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate a new session token for this user
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.user.email!,
    });

    if (sessionError || !sessionData) {
      console.error('Failed to generate session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to generate session' },
        { status: 500 }
      );
    }

    // Extract the token from the magic link
    const url = new URL(sessionData.properties.action_link);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to extract token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token,
      type
    });

  } catch (error) {
    console.error('Error restoring session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
