import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { enrichStores } from '@/lib/store-enrichment'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { isRetailCentreGapsEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireGapFinderAccess()
  if (!access.authorized) return access.response

  const geography = request.nextUrl.searchParams.get('geography')
  const areaId = request.nextUrl.searchParams.get('areaId')?.trim()
  if (!areaId || (geography !== 'town' && geography !== 'retail_centre')) {
    return NextResponse.json({ error: 'Valid geography and areaId are required' }, { status: 400 })
  }
  if (geography === 'retail_centre' && !(await isRetailCentreGapsEnabled())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const service = await createStoreService()
    const stores = geography === 'town'
      ? await service.getStoresInBua(areaId)
      : await service.getStoresInRetailCentre(areaId)
    const enrichedStores = await enrichStores(stores)
    return NextResponse.json({ stores: enrichedStores })
  } catch (error) {
    console.error('Selected gap-area stores error:', error)
    return NextResponse.json({ error: 'Failed to load stores' }, { status: 500 })
  }
}
