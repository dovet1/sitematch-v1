import { NextRequest, NextResponse } from 'next/server';
import { hasProAccess } from '@/lib/subscription-utils';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Pro check
    const isProUser = await hasProAccess(user.id);
    if (!isProUser) {
      return NextResponse.json({
        error: 'CAD uploads require Pro or Plus tier.',
      }, { status: 403 });
    }

    // 3. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 4. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: 'Only PNG and JPG images allowed',
      }, { status: 400 });
    }

    // 5. Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File too large (max 20MB)',
      }, { status: 400 });
    }

    // 6. Validate extension against MIME type
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExts: Record<string, string[]> = {
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/jpg': ['jpg', 'jpeg'],
    };
    const validExts = allowedExts[file.type] || [];
    if (!ext || !validExts.includes(ext)) {
      return NextResponse.json({
        error: 'File extension does not match MIME type',
      }, { status: 400 });
    }

    // 7. Generate unique filename
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const storagePath = `${user.id}/${timestamp}-${uuid}.${ext}`;

    // 8. Upload to Supabase storage
    const supabase = await createServerClient();
    const { error: uploadError } = await supabase.storage
      .from('cad-images')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // 9. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cad-images')
      .getPublicUrl(storagePath);

    // 10. Get image dimensions (basic - client can also do this)
    // For now, returning 0 - proper image dimension extraction would require
    // additional library like sharp or image-size
    const imageWidthPx = 0;
    const imageHeightPx = 0;

    // 11. Return upload result
    return NextResponse.json({
      id: uuid,
      fileName: file.name,
      url: publicUrl,
      storagePath: storagePath, // CRITICAL for cleanup
      imageWidthPx,
      imageHeightPx,
      metresPerPixel: 0, // Will be set during calibration
      anchor: [0, 0] as [number, number], // Will be set on map placement
      rotation: 0,
      opacity: 0.7, // Default opacity
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('CAD upload error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}
