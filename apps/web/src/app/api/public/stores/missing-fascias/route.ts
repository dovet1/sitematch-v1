import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { StoreService } from '@/lib/stores-service'

async function createStoreService() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  return new StoreService(supabase)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = Number(searchParams.get('lat'))
    const lon = Number(searchParams.get('lon'))
    const radius = Math.min(Number(searchParams.get('radius')) || 5000, 20000)
    const fasciaIds = searchParams.get('fasciaIds')?.split(',').filter(Boolean)
    const categoryIds = searchParams.get('categoryIds')?.split(',').filter(Boolean)

    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Validate lat/lon ranges
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { error: 'Coordinates out of range' },
        { status: 400 }
      )
    }

    const service = await createStoreService()
    const missingFascias = await service.getMissingFascias(
      lat,
      lon,
      radius,
      fasciaIds,
      categoryIds
    )

    return NextResponse.json({
      missingFascias,
      total: missingFascias.length,
      meta: {
        lat,
        lon,
        radius,
        filters: {
          fasciaIds: fasciaIds || [],
          categoryIds: categoryIds || []
        }
      }
    })
  } catch (error: any) {
    console.error('Error fetching missing fascias:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
