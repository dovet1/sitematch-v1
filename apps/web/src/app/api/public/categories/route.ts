import { NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'

export const dynamic = 'force-dynamic'

/**
 * Get all store categories
 *
 * Returns:
 * {
 *   categories: Category[],
 *   total: number
 * }
 */
export async function GET() {
  try {
    const service = await createStoreService()
    const categories = await service.getCategories()

    return NextResponse.json({
      categories,
      total: categories.length
    })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      {
        categories: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
