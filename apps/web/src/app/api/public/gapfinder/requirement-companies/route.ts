import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Get unique company names from approved listings with listing locations
 *
 * Returns:
 * {
 *   companies: string[]
 * }
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('listing_locations')
      .select(`
        listings!inner (
          company_name,
          status
        )
      `)
      .eq('listings.status', 'approved')

    if (error) {
      console.error('Requirement companies query error:', error)
      return NextResponse.json({
        companies: [],
        error: error.message || 'Failed to fetch companies'
      }, { status: 500 })
    }

    // Get unique company names
    const uniqueCompanies = Array.from(new Set(
      data.map(item => {
        const listing = Array.isArray(item.listings) ? item.listings[0] : item.listings
        return listing?.company_name
      })
    ))
      .filter(name => name && name.trim().length > 0)
      .sort()

    return NextResponse.json({
      companies: uniqueCompanies,
      total: uniqueCompanies.length
    })
  } catch (error) {
    console.error('Requirement companies API error:', error)
    return NextResponse.json(
      {
        companies: [],
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
