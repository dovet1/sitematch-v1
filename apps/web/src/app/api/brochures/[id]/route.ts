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
    const targetLocations = body.targetLocations || body.target_locations;
    if (targetLocations && targetLocations.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 target locations allowed' },
        { status: 400 }
      );
    }

    const storeImages = body.storeImages || body.store_images;
    if (storeImages && storeImages.length > 6) {
      return NextResponse.json(
        { error: 'Maximum 6 store images allowed' },
        { status: 400 }
      );
    }

    // Build update object - map camelCase to snake_case
    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      listingId: 'listing_id',
      companyName: 'company_name',
      companyDomain: 'company_domain',
      companyLogoSource: 'company_logo_source',
      companyLogoUrl: 'company_logo_url',
      companyAbout: 'company_about',
      agentName: 'agent_name',
      agentCompany: 'agent_company',
      agentEmail: 'agent_email',
      agentPhone: 'agent_phone',
      agentDomain: 'agent_domain',
      agentLogoSource: 'agent_logo_source',
      agentLogoUrl: 'agent_logo_url',
      requirementsSummary: 'requirements_summary',
      sqftMin: 'sqft_min',
      sqftMax: 'sqft_max',
      useClass: 'use_class',
      useClassLabel: 'use_class_label',
      sector: 'sector',
      sectorLabel: 'sector_label',
      additionalNotes: 'additional_notes',
      targetLocations: 'target_locations',
      storeImages: 'store_images',
      brandColor: 'brand_color',
    };

    // Handle camelCase fields
    for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
      if (body[camelKey] !== undefined) {
        updateData[snakeKey] = body[camelKey];
      }
    }

    // Also handle snake_case fields for backward compatibility
    const allowedFields = Object.values(fieldMap);
    for (const field of allowedFields) {
      if (body[field] !== undefined && updateData[field] === undefined) {
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
