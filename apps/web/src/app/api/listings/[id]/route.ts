// =====================================================
// Individual Listing API Route Handler - Story 3.0
// CRUD operations for specific listings
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {

export const dynamic = 'force-dynamic';

  updateListing,
  deleteListing,
  validateListingData
} from '@/lib/listings';
import { createAdminService } from '@/lib/admin';
import type {
  UpdateListingRequest,
  ApiResponse
} from '@/types/listings';

// =====================================================
// GET /api/listings/[id] - Get specific listing
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    const listingId = params.id;

    // Validate UUID format
    if (!isValidUUID(listingId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    // Use admin service for comprehensive listing data with proper error handling
    const adminService = createAdminService();
    const listing = await adminService.getListingById(listingId);

    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const canAccess = canUserAccessListing(user, listing);
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: listing
    });

  } catch (error) {
    console.error(`GET /api/listings/${params.id} error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT /api/listings/[id] - Update listing
// =====================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const listingId = params.id;

    // Validate UUID format
    if (!isValidUUID(listingId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    // Get existing listing
    const adminService = createAdminService();
    const existingListing = await adminService.getListingById(listingId);
    if (!existingListing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check update permissions
    const canUpdate = canUserUpdateListing(user, existingListing);
    if (!canUpdate) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Parse request body
    let updateData: UpdateListingRequest;
    try {
      updateData = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate the update data
    const validation = validateListingData(updateData);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Update the listing with proper server client
    const { createServerClient } = require('@/lib/supabase');
    const serverClient = createServerClient();
    const updatedListing = await updateListing(listingId, updateData, serverClient);

    // Log the update for monitoring
    console.log(`Listing updated: ${listingId} by user ${user.id}`);

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: 'Listing updated successfully'
    });

  } catch (error) {
    console.error(`PUT /api/listings/${params.id} error:`, error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Validation failed')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        );
      }
      
      if (error.message.includes('Foreign key')) {
        return NextResponse.json(
          { success: false, error: 'Invalid sector or use class reference' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/listings/[id] - Delete listing
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const listingId = params.id;

    // Validate UUID format
    if (!isValidUUID(listingId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    // Get existing listing
    const adminService = createAdminService();
    const existingListing = await adminService.getListingById(listingId);
    if (!existingListing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Check delete permissions
    const canDelete = canUserDeleteListing(user, existingListing);
    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete the listing (cascades to related tables)
    await deleteListing(listingId);

    // Log the deletion for monitoring
    console.log(`Listing deleted: ${listingId} by user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Listing deleted successfully'
    });

  } catch (error) {
    console.error(`DELETE /api/listings/${params.id} error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PERMISSION HELPER FUNCTIONS
// =====================================================

function canUserAccessListing(user: any, listing: any): boolean {
  // Public users can view approved listings
  if (!user) {
    return listing.status === 'approved';
  }

  // Admins can access all listings
  if (user.role === 'admin') {
    return true;
  }

  // Users can access listings they created
  if (user.id === listing.created_by) {
    return true;
  }

  // Legacy: Users can access their organization's listings (if org_id exists)
  if (user.org_id && listing.org_id && user.org_id === listing.org_id) {
    return true;
  }

  // Anyone can view approved listings
  return listing.status === 'approved';
}

function canUserUpdateListing(user: any, listing: any): boolean {
  if (!user) return false;

  // Admins can update all listings
  if (user.role === 'admin') {
    return true;
  }

  // Users can update listings they created
  if (user.id === listing.created_by) {
    return true;
  }

  // Legacy: Occupiers can update their organization's listings (if org_id exists)
  if (user.role === 'occupier' && user.org_id && listing.org_id && user.org_id === listing.org_id) {
    return true;
  }

  return false;
}

function canUserDeleteListing(user: any, listing: any): boolean {
  if (!user) return false;

  // Admins can delete all listings
  if (user.role === 'admin') {
    return true;
  }

  // Users can delete listings they created
  if (user.id === listing.created_by) {
    return true;
  }

  // Legacy: Occupiers can delete their organization's listings (if org_id exists)
  if (user.role === 'occupier' && user.org_id && listing.org_id && user.org_id === listing.org_id) {
    return true;
  }

  return false;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}