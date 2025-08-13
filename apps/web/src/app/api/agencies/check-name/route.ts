// =====================================================
// Agency Name Check API - Story 18.2
// Check if agency name is available
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface CheckNameRequest {
  name: string;
}

// =====================================================
// POST /api/agencies/check-name - Check name availability
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CheckNameRequest = await request.json();

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check for existing agency with similar name (case insensitive)
    const { data: existingAgency, error } = await supabase
      .from('agencies')
      .select('id, name')
      .ilike('name', body.name.trim())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking agency name:', error);
      return NextResponse.json(
        { success: false, error: 'Database error while checking name' },
        { status: 500 }
      );
    }

    const available = !existingAgency;

    return NextResponse.json({
      success: true,
      available,
      name: body.name.trim(),
      ...(existingAgency && { 
        message: 'An agency with this name already exists',
        suggestion: `${body.name.trim()} Agency` // Simple suggestion
      })
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/agencies/check-name:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}