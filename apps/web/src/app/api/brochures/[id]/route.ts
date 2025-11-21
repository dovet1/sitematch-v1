import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/brochures/[id] - Get a single brochure
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Brochure ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: brochure, error } = await supabase
      .from('brochures')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Brochure not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching brochure:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brochure' },
        { status: 500 }
      );
    }

    return NextResponse.json(brochure);
  } catch (error) {
    console.error('Unexpected error in GET /api/brochures/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/brochures/[id] - Update a brochure
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Brochure ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate array limits if provided
    if (body.target_locations && body.target_locations.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 target locations allowed' },
        { status: 400 }
      );
    }

    if (body.store_images && body.store_images.length > 6) {
      return NextResponse.json(
        { error: 'Maximum 6 store images allowed' },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'listing_id',
      'company_name',
      'company_domain',
      'company_logo_source',
      'company_logo_url',
      'agent_name',
      'agent_company',
      'agent_email',
      'agent_phone',
      'agent_domain',
      'agent_logo_source',
      'agent_logo_url',
      'requirements_summary',
      'sqft_min',
      'sqft_max',
      'use_class',
      'sector',
      'additional_notes',
      'target_locations',
      'store_images',
      'brand_color',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data: brochure, error } = await supabase
      .from('brochures')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Brochure not found' },
          { status: 404 }
        );
      }
      console.error('Error updating brochure:', error);
      return NextResponse.json(
        { error: 'Failed to update brochure' },
        { status: 500 }
      );
    }

    return NextResponse.json(brochure);
  } catch (error) {
    console.error('Unexpected error in PUT /api/brochures/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/brochures/[id] - Delete a brochure
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Brochure ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('brochures')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting brochure:', error);
      return NextResponse.json(
        { error: 'Failed to delete brochure' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/brochures/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
