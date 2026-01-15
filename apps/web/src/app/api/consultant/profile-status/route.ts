import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    // Check if user is a consultant (user_type is now available from getCurrentUser)
    if (user.user_type !== 'Consultant') {
      return NextResponse.json({
        success: true,
        data: {
          is_consultant: false,
          profile_completed: false,
          profile_exists: false
        }
      }, { status: 200 });
    }

    const supabase = await createServerClient();
    
    // Check if consultant profile exists and is completed
    const { data: profileData, error: profileError } = await supabase
      .from('consultant_profiles')
      .select('id, profile_completed')
      .eq('user_id', user.id)
      .single();

    console.log('Profile status check:', {
      userId: user.id,
      profileData,
      profileError: profileError?.code || 'none'
    });

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking consultant profile:', profileError);
      return NextResponse.json({
        success: false,
        message: 'Error checking profile status'
      }, { status: 500 });
    }

    const profileExists = !!profileData;
    const profileCompleted = profileData?.profile_completed || false;
    
    console.log('Profile status result:', {
      profileExists,
      profileCompleted,
      rawProfileCompleted: profileData?.profile_completed
    });

    return NextResponse.json({
      success: true,
      data: {
        is_consultant: true,
        profile_completed: profileCompleted,
        profile_exists: profileExists
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in profile-status endpoint:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}