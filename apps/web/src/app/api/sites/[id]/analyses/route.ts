import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { checkSubscriptionAccess } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

// GET /api/sites/[id]/analyses - List saved analyses for site (Pro only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Pro status
    const hasPro = await checkSubscriptionAccess(user.id);
    if (!hasPro) {
      return NextResponse.json(
        { error: 'Pro subscription required' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('user_sites')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Fetch analyses
    const { data: analyses, error } = await supabase
      .from('site_demographic_analyses')
      .select('*')
      .eq('site_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching analyses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analyses' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analyses: analyses || [] });
  } catch (error) {
    console.error('Error in GET /api/sites/[id]/analyses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/analyses - Save a new analysis (Pro only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Pro status
    const hasPro = await checkSubscriptionAccess(user.id);
    if (!hasPro) {
      return NextResponse.json(
        { error: 'Pro subscription required to save analyses' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const supabase = createServerClient();

    // Check if this is a link request (has analysis_id) or a create request
    if (body.analysis_id) {
      // LINK EXISTING ANALYSIS
      // Verify the analysis exists and belongs to the user
      const { data: analysis, error: analysisError } = await supabase
        .from('site_demographic_analyses')
        .select('id, user_id, site_id')
        .eq('id', body.analysis_id)
        .eq('user_id', user.id)
        .single();

      if (analysisError || !analysis) {
        return NextResponse.json(
          { error: 'Analysis not found' },
          { status: 404 }
        );
      }

      // If already linked to this site, return success
      if (analysis.site_id === params.id) {
        return NextResponse.json({
          success: true,
          message: 'Analysis already linked to this site'
        });
      }

      // Link the analysis to the site
      const { error: updateError } = await supabase
        .from('site_demographic_analyses')
        .update({ site_id: params.id })
        .eq('id', body.analysis_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error linking analysis:', updateError);
        return NextResponse.json(
          { error: 'Failed to link analysis' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Analysis linked successfully'
      });
    }

    // CREATE NEW ANALYSIS
    // Validation
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Analysis name is required' },
        { status: 400 }
      );
    }

    if (!body.lng || !body.lat) {
      return NextResponse.json(
        { error: 'Location coordinates are required' },
        { status: 400 }
      );
    }

    if (!body.location_name) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      );
    }

    if (!body.measurement_mode || !['distance', 'drive_time', 'walk_time'].includes(body.measurement_mode)) {
      return NextResponse.json(
        { error: 'Valid measurement mode is required' },
        { status: 400 }
      );
    }

    if (!body.measurement_value || body.measurement_value <= 0) {
      return NextResponse.json(
        { error: 'Valid measurement value is required' },
        { status: 400 }
      );
    }

    if (!body.selected_lsoa_codes || !Array.isArray(body.selected_lsoa_codes) || body.selected_lsoa_codes.length === 0) {
      return NextResponse.json(
        { error: 'LSOA codes are required' },
        { status: 400 }
      );
    }

    if (!body.demographics_data) {
      return NextResponse.json(
        { error: 'Demographics data is required' },
        { status: 400 }
      );
    }

    if (!body.national_averages) {
      return NextResponse.json(
        { error: 'National averages data is required' },
        { status: 400 }
      );
    }

    // If site_id provided (params.id !== 'standalone'), verify site ownership
    let site_id = null;
    if (params.id !== 'standalone') {
      const { data: site, error: siteError } = await supabase
        .from('user_sites')
        .select('id')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (siteError || !site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
      site_id = params.id;
    }

    // Create the analysis
    const { data: newAnalysis, error: insertError } = await supabase
      .from('site_demographic_analyses')
      .insert({
        site_id,
        user_id: user.id,
        name: body.name.trim(),
        location: `POINT(${body.lng} ${body.lat})`,
        location_name: body.location_name,
        measurement_mode: body.measurement_mode,
        measurement_value: body.measurement_value,
        selected_lsoa_codes: body.selected_lsoa_codes,
        demographics_data: body.demographics_data,
        national_averages: body.national_averages,
        isochrone_geometry: body.isochrone_geometry || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating analysis:', insertError);
      return NextResponse.json(
        { error: 'Failed to create analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis: newAnalysis }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/sites/[id]/analyses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id]/analyses - Delete an analysis (Pro only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Pro status
    const hasPro = await checkSubscriptionAccess(user.id);
    if (!hasPro) {
      return NextResponse.json(
        { error: 'Pro subscription required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const analysis_id = searchParams.get('analysis_id');

    if (!analysis_id) {
      return NextResponse.json(
        { error: 'analysis_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // First, verify the analysis exists and belongs to the user
    const { data: analysis, error: fetchError } = await supabase
      .from('site_demographic_analyses')
      .select('id, site_id')
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !analysis) {
      console.error('Error fetching analysis:', fetchError);
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // If already unlinked, return success
    if (analysis.site_id === null) {
      return NextResponse.json({ success: true, message: 'Analysis already unlinked' });
    }

    // If linked to a different site, return error
    if (analysis.site_id !== params.id) {
      return NextResponse.json(
        { error: 'Analysis is linked to a different site' },
        { status: 400 }
      );
    }

    // Unlink the analysis from the site
    const { data: updatedData, error: updateError } = await supabase
      .from('site_demographic_analyses')
      .update({ site_id: null })
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .select();

    if (updateError) {
      console.error('Error unlinking analysis:', updateError);
      return NextResponse.json(
        { error: 'Failed to unlink analysis' },
        { status: 500 }
      );
    }

    console.log('Unlinked analysis:', analysis_id, 'Updated rows:', updatedData?.length);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sites/[id]/analyses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
