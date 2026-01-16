import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

    // Check if user owns the listing
    if (listing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete listings you created' },
        { status: 403 }
      );
    }

    // Delete the listing (cascade deletes will handle related records)
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting listing:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete listing' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error in delete listing API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
