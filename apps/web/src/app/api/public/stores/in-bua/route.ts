import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { enrichStores } from '@/lib/store-enrichment'

export const dynamic = 'force-dynamic'

/**
 * Get every store inside a built-up area polygon - find-gaps selected location.
 *
 * Query parameters:
 * - gsscode: Built-up area gsscode (required)
 *
 * Returns: { stores: Store[], total: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gsscode = searchParams.get('gsscode')?.trim()

    if (!gsscode) {
      return NextResponse.json(
        { stores: [], total: 0, error: 'Missing gsscode' },
        { status: 400 }
      )
    }

    const service = await createStoreService()
    const stores = await service.getStoresInBua(gsscode)
    const enrichedStores = await enrichStores(stores)

    return NextResponse.json({ stores: enrichedStores, total: enrichedStores.length })
  } catch (error) {
    return NextResponse.json(
      { stores: [], total: 0, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
