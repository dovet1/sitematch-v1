import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for consultant profile data
const consultantProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100, 'Full name must be less than 100 characters'),
  job_title: z.string().min(1, 'Job title is required').max(100, 'Job title must be less than 100 characters'),
  phone_number: z.string().min(1, 'Phone number is required').regex(/^(\+44|0)[1-9]\d{8,9}$/, 'Invalid UK phone number format'),
  professional_bio: z.string().max(500, 'Professional bio must be less than 500 characters').optional().or(z.literal('')),
  headshot_url: z.string().url('Invalid headshot URL').optional().or(z.literal('')),
  company_name: z.string().min(1, 'Company name is required').max(100, 'Company name must be less than 100 characters'),
  company_website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  company_logo_url: z.string().url('Invalid logo URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid LinkedIn URL').regex(/^https:\/\/(www\.)?linkedin\.com\/.*$/, 'Must be a valid LinkedIn URL').optional().or(z.literal('')),
  years_experience: z.number().int().min(0).max(50).optional(),
  specializations: z.array(z.string()).min(1, 'At least one specialization is required'),
  service_areas: z.array(z.string()).min(1, 'At least one service area is required'),
  primary_services: z.array(z.string()).optional(),
});

// GET - Retrieve consultant profile
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
        success: false,
        message: 'Access denied. Only consultants can access profiles.'
      }, { status: 403 });
    }

    const supabase = await createServerClient();

    // Get consultant profile
    const { data: profileData, error: profileError } = await supabase
      .from('consultant_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching consultant profile:', profileError);
      return NextResponse.json({
        success: false,
        message: 'Error fetching profile'
      }, { status: 500 });
    }

    // Profile doesn't exist yet
    if (!profileData) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Profile not found'
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      data: profileData
    }, { status: 200 });

  } catch (error) {
    console.error('Error in GET consultant profile:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create consultant profile
export async function POST(request: NextRequest) {
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
        success: false,
        message: 'Access denied. Only consultants can create profiles.'
      }, { status: 403 });
    }

    const supabase = await createServerClient();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = consultantProfileSchema.parse(body);

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('consultant_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', checkError);
      return NextResponse.json({
        success: false,
        message: 'Error checking existing profile'
      }, { status: 500 });
    }

    if (existingProfile) {
      return NextResponse.json({
        success: false,
        message: 'Profile already exists. Use PUT to update.'
      }, { status: 409 });
    }

    // Create new consultant profile
    const { data: profileData, error: profileError } = await supabase
      .from('consultant_profiles')
      .insert({
        user_id: user.id,
        ...validatedData,
        profile_completed: true
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating consultant profile:', profileError);
      return NextResponse.json({
        success: false,
        message: 'Error creating profile'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: profileData,
      message: 'Profile created successfully'
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      }, { status: 400 });
    }

    console.error('Error in POST consultant profile:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// PUT - Update consultant profile
export async function PUT(request: NextRequest) {
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
        success: false,
        message: 'Access denied. Only consultants can update profiles.'
      }, { status: 403 });
    }

    const supabase = await createServerClient();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = consultantProfileSchema.parse(body);

    // Update consultant profile
    const { data: profileData, error: profileError } = await supabase
      .from('consultant_profiles')
      .update({
        ...validatedData,
        profile_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating consultant profile:', profileError);
      return NextResponse.json({
        success: false,
        message: 'Error updating profile'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: profileData,
      message: 'Profile updated successfully'
    }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      }, { status: 400 });
    }

    console.error('Error in PUT consultant profile:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}