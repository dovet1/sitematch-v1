import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { checkSubscriptionAccess } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

// GET /api/demographic-analyses/[id] - Get full saved analysis data (Pro only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const supabase = await createServerClient();

    // Fetch the analysis with location extracted as lat/lng
    // Use a raw query to extract coordinates from the geography point
    const { data, error } = await supabase
      .rpc('get_demographic_analysis_with_location', { p_analysis_id: (await params).id });

    if (error) {
      // Fallback: try regular query if RPC doesn't exist
      console.log('RPC not available, using fallback query');
      const { data: analysisData, error: queryError } = await supabase
        .from('site_demographic_analyses')
        .select('*')
        .eq('id', (await params).id)
        .eq('user_id', user.id)
        .single();

      if (queryError || !analysisData) {
        return NextResponse.json(
          { error: 'Analysis not found' },
          { status: 404 }
        );
      }

      // Parse the geography point from WKT format
      // PostGIS returns geography as GeoJSON when selected with ST_AsGeoJSON
      // But if we get WKT format like "0101000020E6100000...", we need to extract it differently
      // For now, make another query to get just the coordinates
      const { data: coordData } = await supabase
        .from('site_demographic_analyses')
        .select('location')
        .eq('id', (await params).id)
        .single();

      // Convert PostGIS geography to { lat, lng }
      let location = { lat: 0, lng: 0 };
      if (coordData?.location) {
        // Try to parse if it's in text format
        const locStr = String(coordData.location);
        const pointMatch = locStr.match(/POINT\s*\(\s*([^\s]+)\s+([^\s]+)\s*\)/i);
        if (pointMatch) {
          location = {
            lng: parseFloat(pointMatch[1]),
            lat: parseFloat(pointMatch[2])
          };
        }
      }

      const analysis = {
        ...analysisData,
        location
      };

      return NextResponse.json({ analysis });
    }

    // Check if we got data and the user owns it
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const analysis = data[0];

    // Verify user ownership
    if (analysis.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error in GET /api/demographic-analyses/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/demographic-analyses/[id] - Delete saved analysis (Pro only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const supabase = await createServerClient();

    // Delete the analysis
    const { error } = await supabase
      .from('site_demographic_analyses')
      .delete()
      .eq('id', (await params).id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting analysis:', error);
      return NextResponse.json(
        { error: 'Failed to delete analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/demographic-analyses/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
