// Simple color system for polygon differentiation

export const POLYGON_COLORS = [
  '#2563eb', // blue-600 (default)
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#c2410c', // orange-700
  '#059669', // emerald-600
  '#7c3aed', // violet-600
  '#be185d', // pink-600
];

export function getPolygonColor(index: number): string {
  return POLYGON_COLORS[index % POLYGON_COLORS.length];
}

/**
 * Curated palette of 24 highly distinct colors for fascia markers
 * Selected for maximum visual differentiation and accessibility
 */
export const FASCIA_MARKER_COLORS = [
  '#2563eb', // blue-600 (bright blue)
  '#ea580c', // orange-600 (bright orange)
  '#16a34a', // green-600 (bright green)
  '#dc2626', // red-600 (bright red)
  '#9333ea', // purple-600 (bright purple)
  '#0891b2', // cyan-600 (bright cyan)
  '#d946ef', // fuchsia-600 (bright pink)
  '#eab308', // yellow-600 (bright yellow)
  '#8b5cf6', // violet-600 (bright violet)
  '#06b6d4', // cyan-500 (light cyan)
  '#f97316', // orange-500 (light orange)
  '#84cc16', // lime-500 (bright lime)
  '#ec4899', // pink-500 (bright pink)
  '#14b8a6', // teal-500 (bright teal)
  '#6366f1', // indigo-500 (bright indigo)
  '#a855f7', // purple-500 (light purple)
  '#f59e0b', // amber-500 (bright amber)
  '#10b981', // emerald-500 (bright emerald)
  '#3b82f6', // blue-500 (light blue)
  '#ef4444', // red-500 (light red)
  '#22c55e', // green-500 (light green)
  '#f43f5e', // rose-500 (bright rose)
  '#a3e635', // lime-400 (lighter lime)
  '#fb923c', // orange-400 (lighter orange)
]

/**
 * Hash string to number for deterministic color generation
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * Generate a stable, distinct color from fascia_id
 * Returns hex color string for marker fill
 * Falls back to neutral gray if fascia_id is missing/empty
 */
export function getFasciaMarkerColor(fasciaId: string | undefined): string {
  if (!fasciaId || fasciaId.trim() === '') {
    return '#9ca3af' // gray-400 fallback
  }

  const colorIndex = hashString(fasciaId) % FASCIA_MARKER_COLORS.length
  return FASCIA_MARKER_COLORS[colorIndex]
}