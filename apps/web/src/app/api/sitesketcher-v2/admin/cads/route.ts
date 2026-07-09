import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isServerAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import sharp from 'sharp';

function toCamel(row: any) {
  return {
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
  };
}

// GET /api/sitesketcher-v2/admin/cads - list every shared library CAD (admin).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isServerAdmin(user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('shared_cads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list shared CADs:', error);
      return NextResponse.json({ error: 'Failed to list CAD library' }, { status: 500 });
    }

    return NextResponse.json({ cads: (data || []).map(toCamel) });
  } catch (error) {
    console.error('Admin CAD list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sitesketcher-v2/admin/cads - promote a calibrated tmp upload into
// the shared library, with provenance metadata (admin only).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isServerAdmin(user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      metresPerPixel,
      imageWidthPx,
      imageHeightPx,
      tmpStoragePath,
      fileName,
      calibrationPoints,
      brand,
      format,
      sourceStore,
      surveyYear,
      gia,
      dims,
    } = body;

    const requireStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    if (!requireStr(name)) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!requireStr(brand) || !requireStr(format) || !requireStr(sourceStore)) {
      return NextResponse.json(
        { error: 'Brand, format and source store are required' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(surveyYear)) {
      return NextResponse.json({ error: 'Survey year is required' }, { status: 400 });
    }
    if (!metresPerPixel || metresPerPixel <= 0) {
      return NextResponse.json({ error: 'metresPerPixel must be positive' }, { status: 400 });
    }
    if (!imageWidthPx || imageWidthPx <= 0 || !imageHeightPx || imageHeightPx <= 0) {
      return NextResponse.json({ error: 'Image dimensions must be positive' }, { status: 400 });
    }
    if (!requireStr(tmpStoragePath)) {
      return NextResponse.json({ error: 'tmpStoragePath is required' }, { status: 400 });
    }
    if (!requireStr(fileName)) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    // Admin uploads land under {adminUserId}/tmp/ via /upload-cad.
    const tmpPathRegex = new RegExp(`^${user.id}/tmp/`);
    if (!tmpPathRegex.test(tmpStoragePath)) {
      return NextResponse.json(
        { error: 'tmpStoragePath must be a temporary path for the authenticated admin' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: tmpFile, error: downloadError } = await supabase.storage
      .from('cad-images')
      .download(tmpStoragePath);
    if (downloadError || !tmpFile) {
      console.error('Failed to download tmp file:', downloadError);
      return NextResponse.json({ error: 'Temporary file not found' }, { status: 400 });
    }

    const buffer = Buffer.from(await tmpFile.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const extension = metadata.format === 'jpeg' ? 'jpg' : 'png';

    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const permanentStoragePath = `shared/${timestamp}-${uuid}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('cad-images')
      .upload(permanentStoragePath, buffer, {
        contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        upsert: false,
      });
    if (uploadError) {
      console.error('Failed to copy to shared storage:', uploadError);
      return NextResponse.json({ error: 'Failed to save CAD image' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('cad-images')
      .getPublicUrl(permanentStoragePath);

    const { data: insertData, error: insertError } = await (supabase.from('shared_cads') as any)
      .insert({
        created_by: user.id,
        name: name.trim(),
        file_name: fileName,
        url: publicUrl,
        storage_path: permanentStoragePath,
        metres_per_pixel: metresPerPixel,
        image_width_px: imageWidthPx,
        image_height_px: imageHeightPx,
        calibration_points: calibrationPoints || null,
        brand: brand.trim(),
        format: format.trim(),
        source_store: sourceStore.trim(),
        survey_year: surveyYear,
        gia_sqm: gia ?? null,
        dims_label: dims ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert shared CAD:', insertError);
      await supabase.storage.from('cad-images').remove([permanentStoragePath]);
      return NextResponse.json({ error: 'Failed to save CAD to library' }, { status: 500 });
    }

    await supabase.storage.from('cad-images').remove([tmpStoragePath]);

    return NextResponse.json({ cad: toCamel(insertData) });
  } catch (error) {
    console.error('Admin CAD create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
