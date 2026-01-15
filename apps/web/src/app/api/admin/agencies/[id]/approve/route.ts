import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(agencyId)) {
      return NextResponse.json({ error: 'Invalid agency ID format' }, { status: 400 });
    }

    const body = await request.json();
    const { status, notes } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Validate notes length if provided
    if (notes && typeof notes === 'string' && notes.length > 1000) {
      return NextResponse.json({ error: 'Review notes too long' }, { status: 400 });
    }

    const supabase = await createServerClient();
    
    // Create admin client with service role to bypass RLS for version updates
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First, verify the agency exists
    const { data: existingAgency, error: fetchError } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single();

    if (fetchError || !existingAgency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Clear the current version reference if approving (since it's no longer pending)
    if (status === 'approved') {
      const { error: agencyError } = await supabase
        .from('agencies')
        .update({ 
          current_version_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', agencyId);

      if (agencyError) {
        console.error('Error updating agency:', agencyError);
        // Don't fail the operation for this
      }
    }

    // Update any pending versions for this agency using admin client to bypass RLS
    const { data: updatedVersions, error: versionError } = await adminClient
      .from('agency_versions')
      .update({ 
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: notes
      })
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .select();

    if (versionError) {
      console.error('Error updating agency versions:', versionError);
      // Don't fail the whole operation if version update fails
      return NextResponse.json({ 
        success: true,
        warning: 'Agency status updated but version history update failed',
        updatedVersions: 0
      });
    }

    // Log admin action for audit trail
    console.log(`[ADMIN ACTION] User ${user.id} (${user.email}) ${status} agency ${agencyId} (${existingAgency.name}) at ${new Date().toISOString()}`);

    return NextResponse.json({ 
      success: true,
      message: `Agency ${status} successfully`,
      updatedVersions: updatedVersions?.length || 0
    });

  } catch (error) {
    console.error('Error in agency approval route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}