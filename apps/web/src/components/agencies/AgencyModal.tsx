'use client'

import { useState, useEffect } from 'react'
import { AgencyModalMobile } from './AgencyModalMobile'
import { CompanyListingLink } from './CompanyListingLink'
import { ListingModal } from '@/components/listings/ListingModal'

// Desktop version (keeping existing code for now, will extract later)
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  MapPin,
  Users,
  Globe,
  Phone,
  Mail,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgencyModal } from './shared/useAgencyModal'
import { AgencyHero } from './shared/AgencyHero'
import { TeamMemberCard } from './TeamMemberCard'

interface AgencyModalProps {
  agencyId: string | null
  isOpen: boolean
  onClose: () => void
}

// Simple responsive hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}

export function AgencyModal({ agencyId, isOpen, onClose }: AgencyModalProps) {
  const isMobile = useIsMobile()
  
  // Route to appropriate component based on device
  if (isMobile) {
    return <AgencyModalMobile agencyId={agencyId} isOpen={isOpen} onClose={onClose} />
  }

  // Desktop version (keeping existing logic for now)
  return <AgencyModalDesktop agencyId={agencyId} isOpen={isOpen} onClose={onClose} />
}

// Desktop component (temporary - will extract to separate file)
function AgencyModalDesktop({ agencyId, isOpen, onClose }: AgencyModalProps) {
  const { agency, isLoading, error, formatAddress, getClassificationBadgeColor, getCompanyLogo } = useAgencyModal(agencyId, isOpen)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full max-w-7xl max-h-[95vh] m-2 sm:m-4 bg-background rounded-3xl shadow-2xl shadow-black/20 flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Header - consistent with listing modal */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-2xl font-bold text-foreground">Agency Profile</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content - Mobile: tabs, Desktop: two-panel */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : error || !agency ? (
                <div className="flex-1 p-6">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {error || 'Agency not found'}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="flex flex-1">
                  {/* Main Content Area */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Hero Section */}
                    <div className="relative bg-gradient-to-br from-slate-50 via-white to-slate-50 border-b border-slate-200">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-transparent to-transparent opacity-60" />
                      <div className="relative p-8">
                        <div className="flex items-start gap-6">
                          {/* Agency Logo */}
                          <div className="flex-shrink-0">
                            {agency.logo_url ? (
                              <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border border-slate-200/60 p-3 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                                <Image
                                  src={agency.logo_url}
                                  alt={`${agency.name} logo`}
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-lg border border-slate-200/60 flex items-center justify-center">
                                <Building2 className="w-10 h-10 text-slate-600" />
                              </div>
                            )}
                          </div>
                          
                          {/* Agency Header Info */}
                          <div className="flex-1">
                            <div className="mb-4">
                              <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
                                {agency.name}
                              </h1>
                              {agency.classification && (
                                <div className="mb-3">
                                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-medium px-3 py-1">
                                    {agency.classification === 'Both' 
                                      ? 'Commercial & Residential Specialists'
                                      : `${agency.classification} Property Specialists`
                                    }
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Main Content Sections */}
                    <div className="p-6 bg-slate-50/30">
                      <div className="space-y-8">

                        {/* About Us Section */}
                        {agency.description && (
                          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/60">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-blue-600" />
                              About Us
                            </h3>
                            <p className="text-slate-600 leading-relaxed">
                              {agency.description}
                            </p>
                          </div>
                        )}

                        {/* Premium Team Section */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/60">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          Meet the Team
                        </h3>
                        
                        {agency.agency_team_members && agency.agency_team_members.length > 0 ? (
                          <div className="space-y-3">
                            {agency.agency_team_members.map((member) => (
                              <TeamMemberCard 
                                key={member.id} 
                                member={member}
                                isMobile={false}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-white p-12 text-center border-2 border-dashed border-slate-300">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
                              <Users className="h-8 w-8 text-slate-400" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-900 mb-3">Team Profiles Coming Soon</h4>
                            <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                              {agency.name} is building their team showcase. Check back soon to meet our property experts.
                            </p>
                          </div>
                        )}
                        </div>

                        {/* Linked Companies */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/60">
                          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            Trusted by Leading Companies
                          </h3>
                          
                          {agency.linked_companies && agency.linked_companies.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                              {agency.linked_companies.map((company) => (
                                <CompanyListingLink
                                  key={company.id}
                                  company={company}
                                  agencyId={agency.id}
                                  getCompanyLogo={getCompanyLogo}
                                  onListingClick={setSelectedListingId}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
                                <Building2 className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="text-sm text-slate-500 mb-2">No partnerships yet</p>
                              <p className="text-xs text-slate-400">
                                Companies will appear here once they work with {agency.name}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Panel - Agency Information */}
                  <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        Agency Details
                      </h3>
                      
                      {/* Areas Covered */}
                      {agency.geographic_patch && (
                        <div className="space-y-4 mb-6">
                          <div className="pb-4 border-b border-slate-100">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Areas Covered</h4>
                            <p className="text-sm text-slate-900 leading-relaxed">
                              {agency.geographic_patch}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Contact Information */}
                      <div className="space-y-4 mb-6">
                        <div className="pb-4">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact</h4>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 mb-0.5">Email</p>
                                <a href={`mailto:${agency.contact_email}`} className="text-sm text-slate-900 hover:text-blue-600 transition-colors break-all">
                                  {agency.contact_email}
                                </a>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                              <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                                <a href={`tel:${agency.contact_phone}`} className="text-sm text-slate-900 hover:text-blue-600 transition-colors">
                                  {agency.contact_phone}
                                </a>
                              </div>
                            </div>
                            
                            {agency.website && (
                              <div className="flex items-start gap-3">
                                <Globe className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-500 mb-0.5">Website</p>
                                  <a 
                                    href={agency.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors break-all"
                                  >
                                    {agency.website.replace(/^https?:\/\//, '')}
                                  </a>
                                </div>
                              </div>
                            )}
                            
                            {/* Office Location */}
                            {formatAddress(agency) && (
                              <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-xs text-slate-500 mb-0.5">Office</p>
                                  <p className="text-sm text-slate-900 leading-relaxed">
                                    {formatAddress(agency)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Listing Modal */}
      <ListingModal
        listingId={selectedListingId}
        isOpen={!!selectedListingId}
        onClose={() => setSelectedListingId(null)}
      />
    </AnimatePresence>
  )
}