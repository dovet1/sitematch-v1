// =====================================================
// Listings API Route Handler - Story 3.0
// Core CRUD operations for listings
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  createListing,
  getListings,
  validateListingData
} from '@/lib/listings';
import type {
  CreateListingRequest,
  ListingsQueryParams,
  ListingStatus,
  ApiResponse
} from '@/types/listings';

// =====================================================
// GET /api/listings - List listings
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

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const queryParams: ListingsQueryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '10'), 50), // Max 50 per page
      status: (searchParams.get('status') as ListingStatus | 'all') || undefined,
      sector_id: searchParams.get('sector_id') || undefined,
      use_class_id: searchParams.get('use_class_id') || undefined,
      search: searchParams.get('search') || undefined
    };

    // For non-admin users, filter by their organization
    if (user.role !== 'admin' && user.org_id) {
      queryParams.org_id = user.org_id;
    }

    const result = await getListings(queryParams);

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta
    });

  } catch (error) {
    console.error('GET /api/listings error:', error);
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
// POST /api/listings - Create new listing
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

    // Only occupiers can create listings
    if (user.role !== 'occupier') {
      return NextResponse.json(
        { success: false, error: 'Only occupiers can create listings' },
        { status: 403 }
      );
    }

    // Parse request body
    let requestData: CreateListingRequest;
    try {
      requestData = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate the listing data
    const validation = validateListingData(requestData);
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

    // Create the listing
    if (!user.org_id) {
      return NextResponse.json(
        { success: false, error: 'User must be associated with an organization' },
        { status: 400 }
      );
    }
    
    const listing = await createListing(requestData, user.id, user.org_id);

    // Log the creation for monitoring
    console.log(`Listing created: ${listing.id} by user ${user.id} (org: ${user.org_id})`);

    return NextResponse.json(
      {
        success: true,
        data: listing,
        message: 'Listing created successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/listings error:', error);

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
// UTILITY FUNCTIONS
// =====================================================

/**
 * Log API requests for monitoring and debugging
 */
function logRequest(method: string, path: string, userId?: string, metadata?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method,
    path,
    userId,
    metadata
  };
  
  console.log('API Request:', JSON.stringify(logEntry));
}

/**
 * Sanitize query parameters to prevent injection
 */
function sanitizeQueryParams(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      // Convert to string and remove potentially dangerous characters
      const stringValue = String(value).replace(/[<>\"\'&]/g, '');
      sanitized[key] = stringValue;
    }
  }
  
  return sanitized;
}