import { NextRequest, NextResponse } from 'next/server'
import { createStoreService } from '@/lib/stores-service'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { isRetailCentreGapsEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireGapFinderAccess()
  if (!access.authorized) return access.response
  if (!(await isRetailCentreGapsEnabled())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const areaId = request.nextUrl.searchParams.get('areaId')?.trim()
  if (!areaId) return NextResponse.json({ error: 'areaId is required' }, { status: 400 })

  try {
    const service = await createStoreService()
    const geometry = await service.getRetailCentreBoundary(areaId)
    if (!geometry) return NextResponse.json({ error: 'Retail centre not found' }, { status: 404 })
    return NextResponse.json({ geometry })
  } catch (error) {
    console.error('Retail-centre boundary error:', error)
    return NextResponse.json({ error: 'Failed to load boundary' }, { status: 500 })
  }
}
