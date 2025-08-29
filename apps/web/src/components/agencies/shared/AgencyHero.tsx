import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'
import type { Agency } from './useAgencyModal'

interface AgencyHeroProps {
  agency: Agency
  getClassificationBadgeColor: (classification?: string) => string
  isMobile?: boolean
}

export function AgencyHero({ agency, getClassificationBadgeColor, isMobile = false }: AgencyHeroProps) {
  return (
    <div className="relative bg-gradient-to-br from-slate-50/80 via-white to-slate-50/80 border-b border-slate-200/80">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/40 via-transparent to-transparent" />
      <div className={`relative ${isMobile ? 'px-4 py-3' : 'p-8'}`}>
        <div className={`flex ${isMobile ? 'items-center text-left' : 'items-start'} gap-3`}>
          {/* Agency Logo - Smaller on mobile */}
          <div className="flex-shrink-0">
            {agency.logo_url ? (
              <div className={`${isMobile ? 'w-12 h-12' : 'w-20 h-20'} rounded-xl bg-white/90 shadow-md border border-slate-200/80 p-2 flex items-center justify-center overflow-hidden backdrop-blur-sm`}>
                <Image
                  src={agency.logo_url}
                  alt={`${agency.name} logo`}
                  width={isMobile ? 32 : 80}
                  height={isMobile ? 32 : 80}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className={`${isMobile ? 'w-12 h-12' : 'w-20 h-20'} rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-md border border-slate-200/80 flex items-center justify-center`}>
                <Building2 className={`${isMobile ? 'w-5 h-5' : 'w-10 h-10'} text-slate-600`} />
              </div>
            )}
          </div>
          
          {/* Agency Header Info - More compact */}
          <div className="flex-1 min-w-0">
            <h1 className={`${isMobile ? 'text-lg' : 'text-3xl'} font-bold text-slate-900 mb-1 tracking-tight truncate`}>
              {agency.name}
            </h1>
            {agency.classification && (
              <Badge className={`${getClassificationBadgeColor(agency.classification)} font-medium px-2 py-0.5 text-xs`}>
                {agency.classification === 'Both' 
                  ? 'Commercial & Residential'
                  : `${agency.classification} Specialist`
                }
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}