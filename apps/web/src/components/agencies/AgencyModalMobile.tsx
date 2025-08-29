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

interface AgencyModalMobileProps {
  agencyId: string | null
  isOpen: boolean
  onClose: () => void
}

type TabType = 'about' | 'details' | 'team' | 'companies'

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
    { id: 'about' as const, label: 'About Us', icon: Building2 },
    { id: 'details' as const, label: 'Details', icon: MapPin },
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

                  {/* Tab Content - Scrollable with better spacing */}
                  <div className="flex-1 overflow-y-auto bg-slate-50/20">
                    <div className="p-5">
                      {activeTab === 'about' && (
                        <div className="space-y-5">
                          {agency.description ? (
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/40 backdrop-blur-sm">
                              <p className="text-slate-700 leading-relaxed text-sm font-medium">
                                {agency.description}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/40 text-center backdrop-blur-sm">
                              <Building2 className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                              <p className="text-slate-500 text-sm font-medium">No description available</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'details' && (
                        <div className="space-y-5">
                          {/* Contact Information */}
                          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/40 backdrop-blur-sm">
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2.5">
                              <div className="p-1.5 bg-violet-50 rounded-lg">
                                <Mail className="h-4 w-4 text-violet-600" />
                              </div>
                              Contact Information
                            </h3>
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email</p>
                                <p className="text-sm text-slate-900 font-medium">{agency.contact_email}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Phone</p>
                                <p className="text-sm text-slate-900 font-medium">{agency.contact_phone}</p>
                              </div>
                              {agency.website && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Website</p>
                                  <p className="text-sm text-slate-900 font-medium break-all">{agency.website}</p>
                                </div>
                              )}
                              {formatAddress(agency) && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Office Location</p>
                                  <p className="text-sm text-slate-900 font-medium">{formatAddress(agency)}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {agency.geographic_patch && (
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/40 backdrop-blur-sm">
                              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2.5">
                                <div className="p-1.5 bg-violet-50 rounded-lg">
                                  <MapPin className="h-4 w-4 text-violet-600" />
                                </div>
                                Areas Covered
                              </h3>
                              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                {agency.geographic_patch}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'team' && (
                        <div className="space-y-4">
                          {agency.agency_team_members && agency.agency_team_members.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                              {agency.agency_team_members.map((member) => (
                                <div 
                                  key={member.id} 
                                  className="bg-white rounded-xl p-3 shadow-sm border border-slate-200/60 text-center"
                                >
                                  <div className="mb-2">
                                    {member.headshot_url ? (
                                      <div className="w-12 h-12 mx-auto rounded-xl overflow-hidden bg-slate-100">
                                        <Image
                                          src={member.headshot_url}
                                          alt={`${member.name} photo`}
                                          width={48}
                                          height={48}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-slate-500" />
                                      </div>
                                    )}
                                  </div>
                                  <h4 className="font-semibold text-slate-900 text-xs mb-1 truncate">
                                    {member.name}
                                  </h4>
                                  <p className="text-[10px] text-blue-600 font-medium truncate">
                                    {member.title}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/60 text-center">
                              <Users className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                              <p className="text-slate-500 text-sm">Team profiles coming soon</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'companies' && (
                        <div className="space-y-4">
                          {agency.linked_companies && agency.linked_companies.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                              {agency.linked_companies.map((company) => (
                                <Link
                                  key={company.id}
                                  href={`/search?viewAll=true&companyName=${encodeURIComponent(company.company_name)}`}
                                  className="bg-white rounded-xl p-3 shadow-sm border border-slate-200/60 block hover:scale-105 transition-transform"
                                >
                                  <div className="aspect-square bg-slate-50 rounded-lg p-2 mb-2 flex items-center justify-center">
                                    {company.logo_url ? (
                                      <Image
                                        src={company.logo_url}
                                        alt={`${company.company_name} logo`}
                                        width={64}
                                        height={64}
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <Building2 className="w-6 h-6 text-slate-400" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-600 text-center truncate leading-tight">
                                    {company.company_name}
                                  </p>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/60 text-center">
                              <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                              <p className="text-slate-500 text-sm">No partnerships yet</p>
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