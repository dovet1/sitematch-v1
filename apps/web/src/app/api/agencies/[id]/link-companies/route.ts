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

    // Get all user's listings and their current agency links
    const { data: userListings, error: listingsError } = await supabase
      .from('listings')
      .select(`
        id,
        listing_agents(
          id,
          agency_id
        )
      `)
      .eq('created_by', user.id)

    if (listingsError) {
      console.error('Error fetching user listings:', listingsError)
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
    }

    // Get current links for this agency
    const currentlyLinkedListings = new Set(
      userListings?.filter(listing => 
        listing.listing_agents?.some(agent => agent.agency_id === params.id)
      ).map(listing => listing.id) || []
    )

    const targetListings = new Set(companyIds)
    
    // Find listings to link and unlink
    const toLink = companyIds.filter((id: string) => !currentlyLinkedListings.has(id))
    const toUnlink = userListings?.filter(listing => 
      currentlyLinkedListings.has(listing.id) && !targetListings.has(listing.id)
    ).map(listing => listing.id) || []

    let operations = 0

    // Add new links
    if (toLink.length > 0) {
      const linksToInsert = toLink.map((listingId: string) => ({
        listing_id: listingId,
        agency_id: params.id
      }))

      const { error: insertError } = await supabase
        .from('listing_agents')
        .insert(linksToInsert)

      if (insertError) {
        console.error('Error inserting listing-agency links:', insertError)
        return NextResponse.json({ error: 'Failed to link companies' }, { status: 500 })
      }
      
      operations += toLink.length
    }

    // Remove existing links
    if (toUnlink.length > 0) {
      const { error: deleteError } = await supabase
        .from('listing_agents')
        .delete()
        .eq('agency_id', params.id)
        .in('listing_id', toUnlink)

      if (deleteError) {
        console.error('Error deleting listing-agency links:', deleteError)
        return NextResponse.json({ error: 'Failed to unlink companies' }, { status: 500 })
      }
      
      operations += toUnlink.length
    }

    return NextResponse.json({ 
      success: true,
      updated: operations,
      message: `Updated ${operations} company link(s)`
    })

  } catch (error) {
    console.error('Error in link-companies endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}