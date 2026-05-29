import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess } from '@/lib/subscription-utils';
import { createServerClient } from '@/lib/supabase';

// DELETE /api/sitesketcher-v2/cad-uploads - Cleanup abandoned tmp uploads
export async function DELETE(request: NextRequest) {
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
        error: 'CAD uploads require Pro or Plus tier.',
      }, { status: 403 });
    }

    const body = await request.json();
    const { storagePath } = body;

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json(
        { error: 'storagePath is required' },
        { status: 400 }
      );
    }

    // SAFETY: Only delete paths under {userId}/tmp/
    const tmpPathRegex = new RegExp(`^${user.id}/tmp/`);
    if (!tmpPathRegex.test(storagePath)) {
      return NextResponse.json(
        { error: 'Can only delete temporary files (must be under {userId}/tmp/)' },
        { status: 400 }
      );
    }

    // Validate path belongs to authenticated user
    if (!storagePath.startsWith(user.id + '/')) {
      return NextResponse.json(
        { error: 'Invalid storage path' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();

    // Delete storage file
    const { error: deleteError } = await supabase.storage
      .from('cad-images')
      .remove([storagePath]);

    if (deleteError) {
      console.error('Failed to delete tmp file:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete temporary file' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CAD upload cleanup error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}
