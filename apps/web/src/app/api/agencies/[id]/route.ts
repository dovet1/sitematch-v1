// =====================================================
// Agency Update API - Story 18.3
// Handle updating agency settings and information
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface UpdateAgencyRequest {
  name?: string;
  coverageAreas?: string;
  specialisms?: string[];
  logoFile?: File;
}

// =====================================================
// PUT /api/agencies/[id] - Update agency information
// =====================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to update agencies' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const agencyId = params.id;

    // Verify user is admin of this agency
    const { data: membership, error: membershipError } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You must be an admin of this agency to update it' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const coverageAreas = formData.get('coverageAreas') as string;
    const specialismsJson = formData.get('specialisms') as string;
    const logoFile = formData.get('logoFile') as File | null;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Agency name is required' },
        { status: 400 }
      );
    }

    if (!coverageAreas?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Coverage areas are required' },
        { status: 400 }
      );
    }

    let specialisms: string[] = [];
    try {
      specialisms = specialismsJson ? JSON.parse(specialismsJson) : [];
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid specialisms format' },
        { status: 400 }
      );
    }

    if (!Array.isArray(specialisms) || specialisms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one specialism is required' },
        { status: 400 }
      );
    }

    // Check if another agency already has this name (excluding current agency)
    const { data: existingAgency } = await supabase
      .from('agencies')
      .select('id')
      .eq('name', name.trim())
      .neq('id', agencyId)
      .single();

    if (existingAgency) {
      return NextResponse.json(
        { success: false, error: 'An agency with this name already exists' },
        { status: 409 }
      );
    }

    // Handle logo upload if provided
    let logoUrl: string | undefined;
    if (logoFile && logoFile.size > 0) {
      try {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `agencies/${agencyId}/logo-${Date.now()}.${fileExt}`;
        
        // Convert File to ArrayBuffer then to Buffer
        const arrayBuffer = await logoFile.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, fileBuffer, {
            contentType: logoFile.type,
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(uploadData.path);

        logoUrl = urlData.publicUrl;
      } catch (error) {
        console.error('Error uploading logo:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to upload logo' },
          { status: 500 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      name: name.trim(),
      coverage_areas: coverageAreas.trim(),
      specialisms,
      updated_at: new Date().toISOString(),
    };

    // Only update logo_url if a new logo was uploaded
    if (logoUrl) {
      updateData.logo_url = logoUrl;
    }

    // If agency was previously rejected, reset to pending status
    const { data: currentAgency } = await supabase
      .from('agencies')
      .select('status')
      .eq('id', agencyId)
      .single();

    if (currentAgency?.status === 'rejected') {
      updateData.status = 'pending';
      updateData.admin_notes = null; // Clear previous rejection notes
      updateData.submitted_at = new Date().toISOString();
    }

    // Update the agency
    const { data: updatedAgency, error: updateError } = await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', agencyId)
      .select('id, name, logo_url, coverage_areas, specialisms, status')
      .single();

    if (updateError) {
      console.error('Error updating agency:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update agency' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        agency: updatedAgency,
        message: currentAgency?.status === 'rejected' 
          ? 'Agency updated and resubmitted for approval!'
          : 'Agency updated successfully!'
      }
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/agencies/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/agencies/[id] - Delete agency (admin only)
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to delete agencies' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const agencyId = params.id;

    // Verify user is admin of this agency
    const { data: membership, error: membershipError } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You must be an admin of this agency to delete it' },
        { status: 403 }
      );
    }

    // Check if agency has multiple members (prevent accidental deletion)
    const { data: members, error: membersError } = await supabase
      .from('agency_agents')
      .select('user_id')
      .eq('agency_id', agencyId);

    if (membersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to check agency members' },
        { status: 500 }
      );
    }

    if (members && members.length > 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete agency with multiple members. Remove all other members first.' },
        { status: 400 }
      );
    }

    // Delete the agency (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('agencies')
      .delete()
      .eq('id', agencyId);

    if (deleteError) {
      console.error('Error deleting agency:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete agency' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Agency deleted successfully' }
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/agencies/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}