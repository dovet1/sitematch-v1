import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess } from '@/lib/subscription-utils';
import { createServerClient } from '@/lib/supabase';

// PATCH /api/sitesketcher-v2/cads/:id - Update CAD (rename, recalibrate)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { name, metresPerPixel, calibrationPoints } = body;

    // Validate at least one field is being updated
    if (!name && !metresPerPixel && !calibrationPoints) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }

    // Build update object dynamically
    const updates: any = {};

    // Validate and add name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    // Validate and add metresPerPixel if provided
    if (metresPerPixel !== undefined) {
      if (typeof metresPerPixel !== 'number' || metresPerPixel <= 0) {
        return NextResponse.json(
          { error: 'metresPerPixel must be a positive number' },
          { status: 400 }
        );
      }
      updates.metres_per_pixel = metresPerPixel;
    }

    // Add calibrationPoints if provided
    if (calibrationPoints !== undefined) {
      updates.calibration_points = calibrationPoints;
    }

    const supabase = await createServerClient();

    // Update database (RLS ensures user ownership)
    const { data, error } = await supabase
      .from('saved_cads')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update CAD:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'CAD not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update CAD' },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase for response
    const savedCad = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      fileName: data.file_name,
      url: data.url,
      storagePath: data.storage_path,
      metresPerPixel: parseFloat(data.metres_per_pixel),
      imageWidthPx: data.image_width_px,
      imageHeightPx: data.image_height_px,
      calibrationPoints: data.calibration_points,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ cad: savedCad });
  } catch (error) {
    console.error('CAD update error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}

// DELETE /api/sitesketcher-v2/cads/:id - Delete CAD row + cleanup storage (orphans instances)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const supabase = await createServerClient();

    // Delete DB row and get storage_path using RETURNING
    const { data, error: deleteError } = await supabase
      .from('saved_cads')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select('storage_path')
      .single();

    if (deleteError) {
      console.error('Failed to delete CAD from database:', deleteError);
      if (deleteError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'CAD not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to delete CAD' },
        { status: 500 }
      );
    }

    // Delete storage file (best effort, non-blocking)
    if (data?.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('cad-images')
        .remove([data.storage_path]);

      if (storageError) {
        console.error('Failed to delete storage file (non-blocking):', storageError);
        // Continue - DB row is deleted, which is the critical operation
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CAD delete error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}
