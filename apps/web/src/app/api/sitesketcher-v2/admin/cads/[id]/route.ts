import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isServerAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

// PATCH /api/sitesketcher-v2/admin/cads/:id - edit name/provenance metadata (admin).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isServerAdmin(user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, brand, format, sourceStore, surveyYear, gia, dims } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name must be non-empty' }, { status: 400 });
      }
      updates.name = name.trim();
    }
    if (brand !== undefined) updates.brand = String(brand).trim();
    if (format !== undefined) updates.format = String(format).trim();
    if (sourceStore !== undefined) updates.source_store = String(sourceStore).trim();
    if (surveyYear !== undefined) {
      if (!Number.isInteger(surveyYear)) {
        return NextResponse.json({ error: 'surveyYear must be an integer' }, { status: 400 });
      }
      updates.survey_year = surveyYear;
    }
    if (gia !== undefined) updates.gia_sqm = gia;
    if (dims !== undefined) updates.dims_label = dims;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('shared_cads') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'CAD not found' }, { status: 404 });
      }
      console.error('Failed to update shared CAD:', error);
      return NextResponse.json({ error: 'Failed to update CAD' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Admin CAD update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/sitesketcher-v2/admin/cads/:id - remove from library + storage (admin).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isServerAdmin(user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('shared_cads') as any)
      .delete()
      .eq('id', id)
      .select('storage_path')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'CAD not found' }, { status: 404 });
      }
      console.error('Failed to delete shared CAD:', error);
      return NextResponse.json({ error: 'Failed to delete CAD' }, { status: 500 });
    }

    if (data?.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('cad-images')
        .remove([data.storage_path]);
      if (storageError) {
        console.error('Failed to delete shared storage file (non-blocking):', storageError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin CAD delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
