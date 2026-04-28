import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MapLegendItem {
  id: string
  label: string
  color: string
  badgeNumbers: number[]
  isVisible: boolean
}

interface MapLegendProps {
  items: MapLegendItem[]
  onToggleVisibility?: (id: string) => void
  position?: 'stacked' | 'standalone'
  className?: string
}

export function MapLegend({
  items,
  onToggleVisibility,
  position = 'standalone',
  className
}: MapLegendProps) {
  if (items.length === 0) {
    return null
  }

  const positionClass = position === 'stacked' ? 'bottom-20' : 'bottom-4'

  return (
    <div
      className={cn(
        'absolute right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 min-w-[200px] max-w-[280px]',
        positionClass,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-700">Fascias</p>
        <span className="text-xs text-gray-500">({items.length})</span>
      </div>

      {/* Items */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {items.map((item) => {
          const badgeLabel = item.badgeNumbers.join(',')
          const hasBadge = badgeLabel.length > 0

          return (
            <div
              key={item.id}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50/50 transition-colors"
            >
              {/* Badge marker or color circle */}
              {hasBadge ? (
                <div
                  className="rounded-full border-2 border-white shadow-sm flex-shrink-0 flex items-center justify-center text-white text-xs font-bold leading-none"
                  style={{
                    backgroundColor: item.isVisible ? item.color : '#9ca3af',
                    minWidth: '20px',
                    height: '20px',
                    paddingLeft: '6px',
                    paddingRight: '6px'
                  }}
                >
                  {badgeLabel}
                </div>
              ) : (
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                  style={{ backgroundColor: item.isVisible ? item.color : '#9ca3af' }}
                />
              )}

              {/* Name only */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-xs truncate',
                    item.isVisible ? 'text-gray-700 font-medium' : 'text-gray-400'
                  )}
                  title={item.label}
                >
                  {item.label}
                </p>
              </div>

              {/* Visibility toggle */}
              {onToggleVisibility && (
                <button
                  onClick={() => onToggleVisibility(item.id)}
                  className="p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                  aria-label={item.isVisible ? 'Hide fascia' : 'Show fascia'}
                >
                  {item.isVisible ? (
                    <Eye className="h-3.5 w-3.5 text-gray-600" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
