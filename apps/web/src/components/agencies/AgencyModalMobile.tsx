'use client'

import { useState, useEffect } from 'react'
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

interface AgencyModalMobileProps {
  agencyId: string | null
  isOpen: boolean
  onClose: () => void
}

type TabType = 'about' | 'contact' | 'coverage' | 'team' | 'companies'

export function AgencyModalMobile({ agencyId, isOpen, onClose }: AgencyModalMobileProps) {
  const { agency, isLoading, error, formatAddress, getClassificationBadgeColor } = useAgencyModal(agencyId, isOpen)
  const [activeTab, setActiveTab] = useState<TabType>('about')

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

  const tabs = [
    { id: 'about' as const, label: 'About', icon: Building2 },
    { id: 'contact' as const, label: 'Contact', icon: Mail },
    { id: 'coverage' as const, label: 'Coverage', icon: MapPin },
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'companies' as const, label: 'Companies', icon: Building2 },
  ]

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

          {/* Mobile Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full max-w-md max-h-[95vh] m-2 bg-white rounded-3xl shadow-2xl shadow-black/25 border border-slate-200/50 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Header - More premium styling */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50/50 via-white to-slate-50/50 border-b border-slate-200/60">
              <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Agency Profile</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-2 min-h-[40px] min-w-[40px] hover:bg-slate-100/80 rounded-full"
                aria-label="Close modal"
              >
                <X className="h-4 w-4 text-slate-600" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : error || !agency ? (
                <div className="flex-1 p-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {error || 'Agency not found'}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <>
                  {/* Hero Section */}
                  <AgencyHero 
                    agency={agency} 
                    getClassificationBadgeColor={getClassificationBadgeColor}
                    isMobile={true}
                  />


                  {/* Tab Navigation - Consistent with listing modal */}
                  <div className="bg-white border-b border-gray-200">
                    <div className="flex overflow-x-auto">
                      {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                              activeTab === tab.id
                                ? 'text-violet-600 border-violet-600 bg-primary-50'
                                : 'text-gray-600 border-transparent hover:text-violet-600 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tab Content - Clean content areas */}
                  <div className="flex-1 overflow-y-auto bg-slate-50/20">
                    <div className="p-6">
                      {activeTab === 'about' && (
                        <div>
                          {agency.description ? (
                            <div className="prose prose-sm max-w-none">
                              <p className="text-slate-700 leading-relaxed font-medium text-base">
                                {agency.description}
                              </p>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <Building2 className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="text-slate-500 font-medium">No description available yet</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'contact' && (
                        <div className="space-y-5">
                          <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Email</p>
                              <p className="text-slate-900 font-medium">{agency.contact_email}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Phone className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Phone</p>
                              <p className="text-slate-900 font-medium">{agency.contact_phone}</p>
                            </div>
                          </div>
                          {agency.website && (
                            <div className="flex items-start gap-3">
                              <Globe className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Website</p>
                                <p className="text-slate-900 font-medium break-all">{agency.website}</p>
                              </div>
                            </div>
                          )}
                          {formatAddress(agency) && (
                            <div className="flex items-start gap-3">
                              <MapPin className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Office Location</p>
                                <p className="text-slate-900 font-medium">{formatAddress(agency)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'coverage' && (
                        <div>
                          {agency.geographic_patch ? (
                            <div className="prose prose-sm max-w-none">
                              <p className="text-slate-700 leading-relaxed font-medium text-base">
                                {agency.geographic_patch}
                              </p>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <MapPin className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="text-slate-500 font-medium">Coverage areas not specified</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'team' && (
                        <div>
                          {agency.agency_team_members && agency.agency_team_members.length > 0 ? (
                            <div className="space-y-3">
                              {agency.agency_team_members.map((member) => (
                                <TeamMemberCard 
                                  key={member.id} 
                                  member={member}
                                  isMobile={true}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <Users className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="text-slate-500 font-medium">Team profiles coming soon</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'companies' && (
                        <div>
                          {agency.linked_companies && agency.linked_companies.length > 0 ? (
                            <div className="grid grid-cols-3 gap-4">
                              {agency.linked_companies.map((company) => (
                                <Link
                                  key={company.id}
                                  href={`/search?viewAll=true&companyName=${encodeURIComponent(company.company_name)}`}
                                  className="bg-white rounded-2xl p-4 block hover:scale-105 transition-transform shadow-sm border border-slate-100"
                                >
                                  <div className="aspect-square bg-slate-50 rounded-xl p-3 mb-3 flex items-center justify-center">
                                    {company.logo_url ? (
                                      <Image
                                        src={company.logo_url}
                                        alt={`${company.company_name} logo`}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <Building2 className="w-6 h-6 text-slate-400" />
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 text-center truncate leading-tight font-medium">
                                    {company.company_name}
                                  </p>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <Building2 className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="text-slate-500 font-medium">No partnerships yet</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}