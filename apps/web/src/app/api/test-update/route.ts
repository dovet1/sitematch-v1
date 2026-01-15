import { NextRequest, NextResponse } from 'next/server';
import { updateListing } from '@/lib/listings';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, updates } = body;

    console.log('Test update endpoint called:', { listingId, updates });

    const { createServerClient } = require('@/lib/supabase');
    const serverClient = await createServerClient();
    const result = await updateListing(listingId, updates, serverClient);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Update successful'
    });
  } catch (error) {
    console.error('Test update failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}