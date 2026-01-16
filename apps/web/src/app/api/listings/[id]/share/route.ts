import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the user owns this listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, created_by, share_token, is_public_shareable')
      .eq('id', id)
      .single();

    if (listingError) {
      if (listingError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching listing:', listingError);
      return NextResponse.json(
        { error: 'Failed to fetch listing' },
        { status: 500 }
      );
    }

    // Verify ownership
    if (listing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied - you can only share your own listings' },
        { status: 403 }
      );
    }

    // Generate new token if one doesn't exist or regenerate if requested
    // Generate a 32-character hex token to fit the database column
    const shareToken = listing.share_token || randomBytes(16).toString('hex');
    
    // Update the listing with share information
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        share_token: shareToken,
        is_public_shareable: true,
        shared_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating listing share status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update listing share status' },
        { status: 500 }
      );
    }

    // Generate the shareable URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared/${shareToken}`;

    return NextResponse.json({
      success: true,
      share_token: shareToken,
      share_url: shareUrl,
      is_public_shareable: true
    });
    
  } catch (error) {
    console.error('Unexpected error in share token generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the user owns this listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (listing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied - you can only manage your own listings' },
        { status: 403 }
      );
    }

    // Disable sharing by setting is_public_shareable to false
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        is_public_shareable: false
        // Keep the share_token for potential re-enabling
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error disabling listing sharing:', updateError);
      return NextResponse.json(
        { error: 'Failed to disable listing sharing' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      is_public_shareable: false
    });
    
  } catch (error) {
    console.error('Unexpected error in disabling share:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}