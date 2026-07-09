import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPlusAccess } from '@/lib/subscription-utils';
import { isServerAdmin } from '@/lib/admin';
import { createServerClient } from '@/lib/supabase';

// GET /api/sitesketcher-v2/shared-cads
// Returns the admin-maintained shared CAD library. Plus-gated to match the
// unified workspace surface (admins are always allowed).
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = (await hasPlusAccess(user.id)) || (await isServerAdmin(user.id));
    if (!allowed) {
      return NextResponse.json(
        { error: 'CAD library requires Plus tier.' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('shared_cads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch shared CADs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CAD library' },
        { status: 500 }
      );
    }

    const cads = (data || []).map((row) => ({
      id: row.id,
      userId: row.created_by,
      name: row.name,
      fileName: row.file_name,
      url: row.url,
      storagePath: row.storage_path,
      metresPerPixel: parseFloat(row.metres_per_pixel),
      imageWidthPx: row.image_width_px,
      imageHeightPx: row.image_height_px,
      calibrationPoints: row.calibration_points,
      brand: row.brand,
      format: row.format,
      sourceStore: row.source_store,
      surveyYear: row.survey_year,
      gia: row.gia_sqm != null ? parseFloat(row.gia_sqm) : undefined,
      dims: row.dims_label ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ cads });
  } catch (error) {
    console.error('Shared CAD library fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
