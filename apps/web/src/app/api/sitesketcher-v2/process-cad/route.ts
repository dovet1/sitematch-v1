import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess } from '@/lib/subscription-utils';
import { createServerClient } from '@/lib/supabase';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    // Auth check (MATCH existing upload-cad pattern)
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tier check (MATCH existing upload-cad pattern)
    const isProUser = await hasProAccess(user.id);
    if (!isProUser) {
      return NextResponse.json(
        { error: 'CAD import requires Pro or Plus tier' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const originalStoragePath = formData.get('originalStoragePath') as string;

    // CRITICAL: Validate required fields exist
    if (!file || !originalStoragePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // CRITICAL: Validate file type - only PNG (cleanup always outputs PNG with transparency)
    if (file.type !== 'image/png') {
      return NextResponse.json(
        { error: 'Invalid file type. Processed files must be PNG.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    // CRITICAL: Verify path ownership - ensure originalStoragePath belongs to this user
    // Must be tmp path: {userId}/tmp/{filename}
    const tmpPathRegex = new RegExp(`^${user.id}/tmp/`);
    if (!tmpPathRegex.test(originalStoragePath)) {
      return NextResponse.json({
        error: 'Invalid storage path. Must be a temporary path.'
      }, { status: 403 });
    }

    // CRITICAL: Create NEW tmp storage path (preserves tmp lifecycle)
    // Format: {userId}/tmp/{timestamp}-{uuid}.png
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const processedStoragePath = `${user.id}/tmp/${timestamp}-${uuid}.png`;

    const buffer = await file.arrayBuffer();
    const supabase = await createServerClient();

    // Upload processed file to new .png path
    const { data, error: uploadError } = await supabase.storage
      .from('cad-images')
      .upload(processedStoragePath, buffer, {
        contentType: 'image/png', // Always PNG after cleanup
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload processed image:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload processed image' },
        { status: 500 }
      );
    }

    // Delete original file (cleanup successful)
    const { error: deleteError } = await supabase.storage
      .from('cad-images')
      .remove([originalStoragePath]);

    if (deleteError) {
      console.error('Failed to delete original file:', deleteError);
      // Non-blocking: processed file uploaded successfully, continue
    }

    const { data: { publicUrl } } = supabase.storage
      .from('cad-images')
      .getPublicUrl(processedStoragePath);

    // Extract new dimensions (SERVER-AUTHORITATIVE)
    const metadata = await sharp(Buffer.from(buffer)).metadata();

    return NextResponse.json({
      url: publicUrl,
      storagePath: processedStoragePath, // NEW: Return updated storage path
      imageWidthPx: metadata.width || 0,
      imageHeightPx: metadata.height || 0,
    });
  } catch (error) {
    console.error('CAD processing error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}
