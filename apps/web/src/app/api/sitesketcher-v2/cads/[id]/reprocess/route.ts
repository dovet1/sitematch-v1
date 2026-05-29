import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess } from '@/lib/subscription-utils';
import { createServerClient } from '@/lib/supabase';
import sharp from 'sharp';

// PATCH /api/sitesketcher-v2/cads/:id/reprocess - Image reprocess endpoint (for cleanup)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Parse form data (processed image blob from client)
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type - must be PNG (cleanup outputs PNG)
    if (file.type !== 'image/png') {
      return NextResponse.json(
        { error: 'Invalid file type. Processed files must be PNG.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 50MB)' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch existing CAD record to get old storage path
    const { data: existingCad, error: fetchError } = await supabase
      .from('saved_cads')
      .select('storage_path, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingCad) {
      console.error('Failed to fetch existing CAD:', fetchError);
      return NextResponse.json(
        { error: 'CAD not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existingCad.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const processedBuffer = Buffer.from(await file.arrayBuffer());

    // Extract new dimensions
    const metadata = await sharp(processedBuffer).metadata();
    const imageWidthPx = metadata.width || 0;
    const imageHeightPx = metadata.height || 0;

    // Upload processed blob to tmp path
    const tmpTimestamp = Date.now();
    const tmpUuid = crypto.randomUUID();
    const tmpStoragePath = `${user.id}/tmp/${tmpTimestamp}-${tmpUuid}.png`;

    const { error: tmpUploadError } = await supabase.storage
      .from('cad-images')
      .upload(tmpStoragePath, processedBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (tmpUploadError) {
      console.error('Failed to upload tmp file:', tmpUploadError);
      return NextResponse.json(
        { error: 'Failed to upload processed image' },
        { status: 500 }
      );
    }

    // Download from tmp to copy to permanent
    const { data: tmpFile, error: tmpDownloadError } = await supabase.storage
      .from('cad-images')
      .download(tmpStoragePath);

    if (tmpDownloadError || !tmpFile) {
      console.error('Failed to download tmp file:', tmpDownloadError);
      // Cleanup tmp
      await supabase.storage.from('cad-images').remove([tmpStoragePath]);
      return NextResponse.json(
        { error: 'Failed to process uploaded file' },
        { status: 500 }
      );
    }

    // Generate new permanent storage path
    const permanentTimestamp = Date.now();
    const permanentUuid = crypto.randomUUID();
    const permanentStoragePath = `${user.id}/${permanentTimestamp}-${permanentUuid}.png`;

    // Copy to permanent path
    const permanentBuffer = Buffer.from(await tmpFile.arrayBuffer());
    const { error: permanentUploadError } = await supabase.storage
      .from('cad-images')
      .upload(permanentStoragePath, permanentBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (permanentUploadError) {
      console.error('Failed to copy to permanent storage:', permanentUploadError);
      // Cleanup tmp
      await supabase.storage.from('cad-images').remove([tmpStoragePath]);
      return NextResponse.json(
        { error: 'Failed to save processed image' },
        { status: 500 }
      );
    }

    // Generate public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cad-images')
      .getPublicUrl(permanentStoragePath);

    // Update database with new image data
    const { data: updatedCad, error: updateError } = await supabase
      .from('saved_cads')
      .update({
        url: publicUrl,
        storage_path: permanentStoragePath,
        image_width_px: imageWidthPx,
        image_height_px: imageHeightPx,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update CAD in database:', updateError);
      // Rollback: delete new permanent file
      await supabase.storage.from('cad-images').remove([permanentStoragePath]);
      // Cleanup tmp
      await supabase.storage.from('cad-images').remove([tmpStoragePath]);
      return NextResponse.json(
        { error: 'Failed to update CAD record' },
        { status: 500 }
      );
    }

    // Delete old permanent storage file (best effort, non-blocking)
    if (existingCad.storage_path) {
      const { error: deleteOldError } = await supabase.storage
        .from('cad-images')
        .remove([existingCad.storage_path]);

      if (deleteOldError) {
        console.warn('Failed to delete old storage file (non-blocking):', deleteOldError);
      }
    }

    // Delete tmp file (best effort, non-blocking)
    const { error: deleteTmpError } = await supabase.storage
      .from('cad-images')
      .remove([tmpStoragePath]);

    if (deleteTmpError) {
      console.warn('Failed to delete tmp file (non-blocking):', deleteTmpError);
    }

    // Transform snake_case to camelCase for response
    const savedCad = {
      id: updatedCad.id,
      userId: updatedCad.user_id,
      name: updatedCad.name,
      fileName: updatedCad.file_name,
      url: updatedCad.url,
      storagePath: updatedCad.storage_path,
      metresPerPixel: parseFloat(updatedCad.metres_per_pixel),
      imageWidthPx: updatedCad.image_width_px,
      imageHeightPx: updatedCad.image_height_px,
      calibrationPoints: updatedCad.calibration_points,
      createdAt: updatedCad.created_at,
      updatedAt: updatedCad.updated_at,
    };

    return NextResponse.json({ cad: savedCad });
  } catch (error) {
    console.error('CAD reprocess error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}
