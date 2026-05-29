import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess } from '@/lib/subscription-utils';
import { createServerClient } from '@/lib/supabase';
import sharp from 'sharp';

// GET /api/sitesketcher-v2/cads - List user's saved CADs
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pro check
    const isProUser = await hasProAccess(user.id);
    if (!isProUser) {
      return NextResponse.json({
        error: 'CAD library requires Pro or Plus tier.',
      }, { status: 403 });
    }

    // Fetch saved CADs from database
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('saved_cads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch saved CADs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CAD library' },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase for frontend
    const cads = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      fileName: row.file_name,
      url: row.url,
      storagePath: row.storage_path,
      metresPerPixel: parseFloat(row.metres_per_pixel),
      imageWidthPx: row.image_width_px,
      imageHeightPx: row.image_height_px,
      calibrationPoints: row.calibration_points,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ cads });
  } catch (error) {
    console.error('CAD library fetch error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}

// POST /api/sitesketcher-v2/cads - Create saved CAD (after calibration)
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pro check
    const isProUser = await hasProAccess(user.id);
    if (!isProUser) {
      return NextResponse.json({
        error: 'CAD library requires Pro or Plus tier.',
      }, { status: 403 });
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
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be non-empty' },
        { status: 400 }
      );
    }

    if (!metresPerPixel || metresPerPixel <= 0) {
      return NextResponse.json(
        { error: 'metresPerPixel is required and must be positive' },
        { status: 400 }
      );
    }

    if (!imageWidthPx || imageWidthPx <= 0 || !imageHeightPx || imageHeightPx <= 0) {
      return NextResponse.json(
        { error: 'imageWidthPx and imageHeightPx must be positive' },
        { status: 400 }
      );
    }

    if (!tmpStoragePath || typeof tmpStoragePath !== 'string') {
      return NextResponse.json(
        { error: 'tmpStoragePath is required' },
        { status: 400 }
      );
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { error: 'fileName is required' },
        { status: 400 }
      );
    }

    // Validate tmpStoragePath format: must be {userId}/tmp/...
    const tmpPathRegex = new RegExp(`^${user.id}/tmp/`);
    if (!tmpPathRegex.test(tmpStoragePath)) {
      return NextResponse.json(
        { error: 'tmpStoragePath must be a temporary path for authenticated user' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Download tmp file to determine correct extension
    const { data: tmpFile, error: downloadError } = await supabase.storage
      .from('cad-images')
      .download(tmpStoragePath);

    if (downloadError || !tmpFile) {
      console.error('Failed to download tmp file:', downloadError);
      return NextResponse.json(
        { error: 'Temporary file not found or download failed' },
        { status: 400 }
      );
    }

    // Determine extension from file content (not from fileName)
    const buffer = Buffer.from(await tmpFile.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    let extension = 'png';
    if (metadata.format === 'jpeg') {
      extension = 'jpg';
    } else if (metadata.format === 'png') {
      extension = 'png';
    }

    // Generate permanent storage path
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const permanentStoragePath = `${user.id}/${timestamp}-${uuid}.${extension}`;

    // Copy to permanent location
    const { error: uploadError } = await supabase.storage
      .from('cad-images')
      .upload(permanentStoragePath, buffer, {
        contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to copy to permanent storage:', uploadError);
      return NextResponse.json(
        { error: 'Failed to save CAD to permanent storage' },
        { status: 500 }
      );
    }

    // Verify permanent file exists
    const { data: verifyData, error: verifyError } = await supabase.storage
      .from('cad-images')
      .list(user.id, {
        search: `${timestamp}-${uuid}.${extension}`,
      });

    if (verifyError || !verifyData || verifyData.length === 0) {
      console.error('Failed to verify permanent file:', verifyError);
      // Rollback: delete permanent file
      await supabase.storage.from('cad-images').remove([permanentStoragePath]);
      return NextResponse.json(
        { error: 'Failed to verify permanent storage' },
        { status: 500 }
      );
    }

    // Generate public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cad-images')
      .getPublicUrl(permanentStoragePath);

    // Insert into database
    const { data: insertData, error: insertError } = await supabase
      .from('saved_cads')
      .insert({
        user_id: user.id,
        name: name.trim(),
        file_name: fileName,
        url: publicUrl,
        storage_path: permanentStoragePath,
        metres_per_pixel: metresPerPixel,
        image_width_px: imageWidthPx,
        image_height_px: imageHeightPx,
        calibration_points: calibrationPoints || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert CAD into database:', insertError);
      // Rollback: delete permanent file
      await supabase.storage.from('cad-images').remove([permanentStoragePath]);
      return NextResponse.json(
        { error: 'Failed to save CAD to database' },
        { status: 500 }
      );
    }

    // Delete tmp file (best effort, log if fails)
    const { error: deleteTmpError } = await supabase.storage
      .from('cad-images')
      .remove([tmpStoragePath]);

    if (deleteTmpError) {
      console.warn('Failed to delete tmp file (non-blocking):', deleteTmpError);
    }

    // Transform snake_case to camelCase for response
    const savedCad = {
      id: insertData.id,
      userId: insertData.user_id,
      name: insertData.name,
      fileName: insertData.file_name,
      url: insertData.url,
      storagePath: insertData.storage_path,
      metresPerPixel: parseFloat(insertData.metres_per_pixel),
      imageWidthPx: insertData.image_width_px,
      imageHeightPx: insertData.image_height_px,
      calibrationPoints: insertData.calibration_points,
      createdAt: insertData.created_at,
      updatedAt: insertData.updated_at,
    };

    return NextResponse.json({ cad: savedCad });
  } catch (error) {
    console.error('CAD create error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}
