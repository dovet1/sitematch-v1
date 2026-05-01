import { calculateDistance } from '@/lib/distance-utils'
import type { Store } from '@/lib/stores'
import type { TravelTimeData } from '@/types/travel-time'

interface NearbyStoresCSVParams {
  stores: Store[]
  selectedPoint: { lat: number; lng: number }
  radiusMeters: number
  filterSummary: string
  travelTimes: Record<string, TravelTimeData>
}

export function exportNearbyStoresToCSV(params: NearbyStoresCSVParams): void {
  const csv = generateNearbyStoresCSV(params)
  const date = new Date().toISOString().split('T')[0]
  downloadFile(csv, `assess-area-nearby-stores-${date}.csv`, 'text/csv')
}

export function generateNearbyStoresCSV({
  stores,
  selectedPoint,
  radiusMeters,
  filterSummary,
  travelTimes
}: NearbyStoresCSVParams): string {
  const lines: string[] = []

  lines.push(`# Selected Point,${escapeCSV(`${selectedPoint.lat}, ${selectedPoint.lng}`)}`)
  lines.push(`# Radius,${escapeCSV(`${formatRadius(radiusMeters)}`)}`)
  lines.push(`# Filters,${escapeCSV(filterSummary || 'None')}`)
  lines.push('')
  lines.push('Store Name,Distance (mi),Walking Time (min),Driving Time (min)')

  for (const store of stores) {
    const travelTime = travelTimes[store.id]
    const distance =
      Number.isFinite(store.lat) && Number.isFinite(store.lon)
        ? calculateDistance(selectedPoint.lat, selectedPoint.lng, store.lat, store.lon).toString()
        : ''
    const walkingMinutes = travelTime?.walking
      ? Math.round(travelTime.walking.duration / 60).toString()
      : ''
    const drivingMinutes = travelTime?.driving
      ? Math.round(travelTime.driving.duration / 60).toString()
      : ''

    lines.push([
      escapeCSV(store.name || ''),
      escapeCSV(distance),
      escapeCSV(walkingMinutes),
      escapeCSV(drivingMinutes)
    ].join(','))
  }

  return lines.join('\n')
}

function formatRadius(radiusMeters: number): string {
  if (radiusMeters >= 1000) {
    return `${radiusMeters / 1000} km`
  }

  return `${radiusMeters} m`
}

function escapeCSV(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
