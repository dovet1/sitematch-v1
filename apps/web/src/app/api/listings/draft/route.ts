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

    // Check for existing recent draft listings to prevent duplicates
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recentDrafts } = await supabase
      .from('listings')
      .select('id, created_at')
      .eq('created_by', user.id)
      .eq('status', 'draft')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentDrafts && recentDrafts.length > 0) {
      console.log('Returning existing recent draft listing:', recentDrafts[0].id)
      return NextResponse.json({
        success: true,
        listingId: recentDrafts[0].id,
        message: 'Using existing recent draft'
      })
    }

    // Get request data
    const { userEmail } = await request.json()

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

    // Create minimal draft listing with required contact fields  
    const draftData = {
      created_by: user.id,
      title: 'Draft Listing - In Progress',
      description: 'Draft listing created during wizard process',
      status: 'draft',
      sector_id: sectors[0].id,
      use_class_id: useClasses[0].id,
      // Required contact fields from schema
      contact_name: 'Contact Name',
      contact_title: 'Contact Title', 
      contact_email: userEmail || user.email || 'contact@example.com',
      // Required company_name field
      company_name: 'Draft Company'
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
    
    // Clean up old draft listings (older than 24 hours) for this user to prevent accumulation
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('listings')
      .delete()
      .eq('created_by', user.id)
      .eq('status', 'draft')
      .lt('created_at', twentyFourHoursAgo)
    
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