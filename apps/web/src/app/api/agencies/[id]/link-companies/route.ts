import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyIds } = await request.json()
    const supabase = createServerClient()
    
    // Verify the user owns this agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found or unauthorized' }, { status: 404 })
    }

    // Get all user's listings to update
    const { data: userListings, error: listingsError } = await supabase
      .from('listings')
      .select('id, linked_agency_id')
      .eq('created_by', user.id)

    if (listingsError) {
      console.error('Error fetching user listings:', listingsError)
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
    }

    // Prepare updates
    const updates = []
    
    for (const listing of userListings || []) {
      if (companyIds.includes(listing.id)) {
        // Should be linked to this agency
        if (listing.linked_agency_id !== params.id) {
          updates.push({
            id: listing.id,
            linked_agency_id: params.id
          })
        }
      } else {
        // Should not be linked to this agency
        if (listing.linked_agency_id === params.id) {
          updates.push({
            id: listing.id,
            linked_agency_id: null
          })
        }
      }
    }

    // Perform updates if needed
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('listings')
          .update({ linked_agency_id: update.linked_agency_id })
          .eq('id', update.id)
          .eq('created_by', user.id) // Extra safety check

        if (updateError) {
          console.error('Error updating listing:', updateError)
          // Continue with other updates even if one fails
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      updated: updates.length,
      message: `Updated ${updates.length} company link(s)`
    })

  } catch (error) {
    console.error('Error in link-companies endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}