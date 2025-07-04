import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request data
    const { organizationId, userEmail } = await request.json()

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    }

    // Get first available sector and use class for draft
    const { data: sectors } = await supabase
      .from('sectors')
      .select('id, name')
      .limit(1)

    const { data: useClasses } = await supabase
      .from('use_classes')
      .select('id, code, name')
      .limit(1)

    if (!sectors || !sectors.length || !useClasses || !useClasses.length) {
      return NextResponse.json({ error: 'No reference data available' }, { status: 500 })
    }

    // Create minimal draft listing
    const draftData = {
      org_id: organizationId,
      created_by: user.id,
      title: 'Draft Listing - In Progress',
      description: 'Draft listing created during wizard process',
      status: 'draft',
      sector_id: sectors[0].id,
      use_class_id: useClasses[0].id,
      contact_email: userEmail || user.email || 'contact@example.com'
    }

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert(draftData)
      .select()
      .single()

    if (listingError) {
      console.error('Draft listing creation error:', listingError)
      return NextResponse.json({ 
        error: `Failed to create draft listing: ${listingError.message}` 
      }, { status: 500 })
    }

    console.log('Draft listing created successfully:', listing.id)
    
    return NextResponse.json({
      success: true,
      listingId: listing.id
    })

  } catch (error) {
    console.error('Draft listing creation failed:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create draft listing'
    }, { status: 500 })
  }
}