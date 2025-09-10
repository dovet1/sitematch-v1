import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    
    // First verify the user owns this agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found or unauthorized' }, { status: 404 })
    }

    // Get listings owned by the user with their agency links
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select(`
        id,
        company_name,
        company_domain,
        clearbit_logo,
        listing_agents(
          agency_id
        )
      `)
      .eq('created_by', user.id)

    if (listingsError) {
      console.error('Error fetching listings:', listingsError)
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
    }

    // Filter for listings with approved versions
    let approvedListings: any[] = []
    if (listings && listings.length > 0) {
      const listingIds = listings.map(l => l.id)
      
      const { data: approvedVersions, error: versionsError } = await supabase
        .from('listing_versions')
        .select('listing_id')
        .in('listing_id', listingIds)
        .eq('status', 'approved')

      if (versionsError) {
        console.error('Error fetching approved versions:', versionsError)
        return NextResponse.json({ error: 'Failed to fetch approved versions' }, { status: 500 })
      }

      const approvedListingIds = new Set(approvedVersions?.map(v => v.listing_id) || [])
      approvedListings = listings.filter(listing => approvedListingIds.has(listing.id))
    }

    // Get logos for approved listings
    const listingIds = approvedListings.map(l => l.id)
    let logos: any[] = []
    
    if (listingIds.length > 0) {
      const { data: logoFiles } = await supabase
        .from('file_uploads')
        .select('listing_id, file_path, bucket_name')
        .in('listing_id', listingIds)
        .eq('file_type', 'logo')
      
      logos = logoFiles || []
    }

    // Format the response
    const companies = approvedListings.map(listing => {
      const logo = logos.find(l => l.listing_id === listing.id)
      const isLinkedToThisAgency = listing.listing_agents?.some((agent: any) => agent.agency_id === params.id) || false
      
      return {
        id: listing.id,
        company_name: listing.company_name,
        company_domain: listing.company_domain,
        clearbit_logo: listing.clearbit_logo || false,
        logo_url: logo?.file_path || null,
        logo_bucket: logo?.bucket_name || null,
        linked: isLinkedToThisAgency
      }
    })

    return NextResponse.json({ 
      data: companies,
      count: companies.length 
    })

  } catch (error) {
    console.error('Error in available-companies endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}