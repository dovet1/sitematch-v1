import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

interface Agency {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'approved' | 'pending' | 'draft' | 'rejected'
  created_at: string
}

interface AgencyCardProps {
  agency: Agency
}

function getAgencyInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

function getSpecialismColor(specialism: string): string {
  const colorMap: Record<string, string> = {
    'Office': 'bg-blue-50 text-blue-700 border-blue-200',
    'Retail': 'bg-green-50 text-green-700 border-green-200',
    'Industrial': 'bg-orange-50 text-orange-700 border-orange-200',
    'Warehouse': 'bg-purple-50 text-purple-700 border-purple-200',
    'Land': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Mixed Use': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Healthcare': 'bg-red-50 text-red-700 border-red-200',
    'Education': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Hospitality': 'bg-pink-50 text-pink-700 border-pink-200',
  }
  return colorMap[specialism] || 'bg-gray-50 text-gray-700 border-gray-200'
}

export function AgencyCard({ agency }: AgencyCardProps) {
  const initials = getAgencyInitials(agency.name)
  const coverageText = agency.coverage_areas ? truncateText(agency.coverage_areas, 45) : null
  const visibleSpecialisms = agency.specialisms.slice(0, 3)
  const remainingCount = agency.specialisms.length - 3

  return (
    <Card className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98]">
      <div className="p-6">
        {/* Logo & Name Section */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-inner">
              {agency.logo_url ? (
                <Image
                  src={agency.logo_url}
                  alt={`${agency.name} logo`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-white font-semibold text-lg tracking-wide">
                  {initials}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg sm:text-xl text-gray-900 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
              {agency.name}
            </h3>
            {coverageText && (
              <p 
                className="text-sm text-gray-600 leading-relaxed"
                title={agency.coverage_areas || undefined}
              >
                {coverageText}
              </p>
            )}
          </div>
        </div>

        {/* Specialisms Tags */}
        {agency.specialisms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleSpecialisms.map((specialism, index) => (
              <Badge
                key={index}
                variant="secondary"
                className={`text-xs font-medium px-3 py-1 rounded-full border ${getSpecialismColor(specialism)} transition-colors`}
              >
                {specialism}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <Badge
                variant="secondary"
                className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600 border-gray-200"
              >
                +{remainingCount} more
              </Badge>
            )}
            {agency.specialisms.length === 0 && (
              <Badge
                variant="secondary"
                className="text-xs font-medium px-3 py-1 rounded-full bg-gray-50 text-gray-500 border-gray-200"
              >
                General Commercial
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Hover Indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </Card>
  )
}