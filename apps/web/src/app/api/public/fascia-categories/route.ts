import { NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Get all fascia-category mappings
 * Used to build the category → brand → fascia tree structure
 *
 * Returns:
 * {
 *   mappings: Array<{fascia_id: string, category_id: string, is_primary: boolean}>,
 *   total: number
 * }
 */
export async function GET() {
  try {
    const service = await createStoreService()
    const mappings = await service.getFasciaCategoryMappings()

    return NextResponse.json({
      mappings,
      total: mappings.length
    })
  } catch (error) {
    console.error('Fascia-categories API error:', error)
    return NextResponse.json(
      {
        mappings: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
