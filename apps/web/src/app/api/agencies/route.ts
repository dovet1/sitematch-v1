// =====================================================
// Agencies API Route Handler - Story 18.2
// Agency creation and management operations
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface CreateAgencyRequest {
  name: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  logoFile?: File;
  coverageAreas: string;
  specialisms: string[];
  directAgents: {
    email: string;
    name: string;
    phone?: string;
    role: 'admin' | 'member';
    coverageArea?: string;
    headshotUrl?: string;
    headshotFile?: File;
  }[];
  inviteAgents: {
    email: string;
    name: string;
    role: 'admin' | 'member';
  }[];
}

// =====================================================
// POST /api/agencies - Create new agency
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const body: CreateAgencyRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.coverageAreas || !body.specialisms || body.specialisms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, coverageAreas, and at least one specialism' },
        { status: 400 }
      );
    }

    // Check if user is already part of an agency
    const { data: existingMembership } = await supabase
      .from('agency_agents')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    if (existingMembership) {
      return NextResponse.json(
        { success: false, error: 'You are already a member of an agency' },
        { status: 400 }
      );
    }

    // Check for duplicate agency name
    const { data: existingAgency } = await supabase
      .from('agencies')
      .select('id')
      .ilike('name', body.name)
      .single();

    if (existingAgency) {
      return NextResponse.json(
        { success: false, error: 'An agency with this name already exists' },
        { status: 409 }
      );
    }

    // Start transaction
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .insert({
        name: body.name.trim(),
        logo_url: body.logoUrl?.startsWith('blob:') ? null : body.logoUrl || null,
        coverage_areas: body.coverageAreas.trim(),
        specialisms: body.specialisms,
        status: 'pending',
        created_by: user.id
      })
      .select()
      .single();

    if (agencyError) {
      console.error('Error creating agency:', agencyError);
      return NextResponse.json(
        { success: false, error: 'Failed to create agency' },
        { status: 500 }
      );
    }

    // Create initial version record with complete agency data
    const agencyData = {
      name: body.name,
      description: body.description,
      website: body.website,
      logo_url: body.logoUrl?.startsWith('blob:') ? null : body.logoUrl || null,
      coverage_areas: body.coverageAreas,
      specialisms: body.specialisms,
      direct_agents: body.directAgents || [],
      invite_agents: body.inviteAgents || []
    };

    const { error: versionError } = await supabase
      .from('agency_versions')
      .insert({
        agency_id: agency.id,
        version_number: 1,
        data: agencyData,
        status: 'pending',
        created_by: user.id
      });

    if (versionError) {
      console.error('Error creating agency version:', versionError);
      // Clean up agency record
      await supabase.from('agencies').delete().eq('id', agency.id);
      return NextResponse.json(
        { success: false, error: 'Failed to create agency version' },
        { status: 500 }
      );
    }

    // Add creator as admin (minimal record)
    const { error: creatorError } = await supabase
      .from('agency_agents')
      .insert({
        agency_id: agency.id,
        user_id: user.id,
        email: user.email || '',
        name: user.email || 'Agency Admin',
        role: 'admin',
        is_registered: true
      });

    if (creatorError) {
      console.error('Error adding creator to agency:', creatorError);
      // Clean up
      await supabase.from('agencies').delete().eq('id', agency.id);
      return NextResponse.json(
        { success: false, error: 'Failed to add creator to agency' },
        { status: 500 }
      );
    }

    // Add direct agents (check if creator is included and update their record)
    if (body.directAgents && body.directAgents.length > 0) {
      for (const agent of body.directAgents) {
        const isCreator = agent.email.toLowerCase() === user.email?.toLowerCase();
        
        if (isCreator) {
          // Update the creator's existing record with complete data
          console.log('📝 Updating creator agent record:', {
            name: agent.name,
            phone: agent.phone,
            coverageArea: agent.coverageArea,
            headshotUrl: agent.headshotUrl,
            role: agent.role,
            agencyId: agency.id,
            userId: user.id
          });
          
          const { error: updateError } = await supabase
            .from('agency_agents')
            .update({
              name: agent.name,
              phone: agent.phone || null,
              coverage_area: agent.coverageArea || null,
              headshot_url: agent.headshotUrl || null,
              role: agent.role || 'admin' // Keep admin role or use specified role
            })
            .eq('agency_id', agency.id)
            .eq('user_id', user.id);
            
          if (updateError) {
            console.error('❌ Error updating creator agent record:', updateError);
          } else {
            console.log('✅ Creator agent record updated successfully');
          }
        } else {
          // Insert new record for non-creator direct agents
          const { error: insertError } = await supabase
            .from('agency_agents')
            .insert({
              agency_id: agency.id,
              user_id: null, // Will be updated when/if they register
              email: agent.email,
              name: agent.name,
              phone: agent.phone || null,
              coverage_area: agent.coverageArea || null,
              headshot_url: agent.headshotUrl || null,
              role: agent.role,
              is_registered: false
            });
            
          if (insertError) {
            console.error('Error adding direct agent:', insertError);
            // Note: Don't fail the whole operation for this
          }
        }
      }
    }

    // Create invitations for invite agents
    const invitations = [];
    if (body.inviteAgents && body.inviteAgents.length > 0) {
      for (const agent of body.inviteAgents) {
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        invitations.push({
          agency_id: agency.id,
          email: agent.email,
          name: agent.name,
          role: agent.role,
          token,
          expires_at: expiresAt.toISOString(),
          invited_by: user.id
        });
      }

      const { error: invitationsError } = await supabase
        .from('agency_invitations')
        .insert(invitations);

      if (invitationsError) {
        console.error('Error creating invitations:', invitationsError);
        // Note: Don't fail the whole operation for this
      } else {
        // Send invitation emails
        const { sendAgencyInvitationEmail } = await import('@/lib/email-templates')
        
        for (const invitation of invitations) {
          try {
            const acceptUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/agents/invite/${invitation.token}`
            
            await sendAgencyInvitationEmail({
              recipientName: invitation.name,
              recipientEmail: invitation.email,
              agencyName: agency.name,
              inviterName: user.email || 'Agency Admin',
              role: invitation.role,
              acceptUrl,
              expiresAt: invitation.expires_at
            })
            
            console.log(`📧 Invitation email sent to ${invitation.email}`)
          } catch (emailError) {
            console.error(`📧 Failed to send invitation email to ${invitation.email}:`, emailError)
            // Don't fail the whole operation for email issues
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        agency,
        invitations: invitations.map(inv => ({ email: inv.email, token: inv.token }))
      }
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/agencies:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// GET /api/agencies - List agencies (for admin)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only allow admins to list all agencies
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('agencies')
      .select(`
        id,
        name,
        logo_url,
        coverage_areas,
        specialisms,
        status,
        admin_notes,
        created_at,
        updated_at,
        approved_at,
        users!agencies_created_by_fkey(email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: agencies, error } = await query;

    if (error) {
      console.error('Error fetching agencies:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agencies' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: agencies || [],
      pagination: {
        page,
        limit,
        hasMore: agencies?.length === limit
      }
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/agencies:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}