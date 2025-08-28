'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ExternalLink,
  AlertTriangle,
  X
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface TeamMember {
  id: string
  name: string
  title: string
  bio?: string
  email: string
  phone?: string
  linkedin_url?: string
  headshot_url?: string
  display_order: number
}

interface Agency {
  id: string
  name: string
  description?: string
  classification?: 'Commercial' | 'Residential' | 'Both'
  geographic_patch?: string
  website?: string
  logo_url?: string
  contact_email: string
  contact_phone: string
  office_street_address?: string
  office_city?: string
  office_postcode?: string
  office_country?: string
  created_at: string
  updated_at: string
  agency_team_members?: TeamMember[]
}

interface AgencyModalProps {
  agencyId: string | null
  isOpen: boolean
  onClose: () => void
}

export function AgencyModal({ agencyId, isOpen, onClose }: AgencyModalProps) {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && agencyId) {
      fetchAgency()
    } else {
      setAgency(null)
      setError(null)
    }
  }, [isOpen, agencyId])

  const fetchAgency = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/agencies/${agencyId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch agency')
      }
      const result = await response.json()
      setAgency(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agency')
    } finally {
      setIsLoading(false)
    }
  }

  const formatAddress = (agency: Agency) => {
    const parts = [
      agency.office_street_address,
      agency.office_city,
      agency.office_postcode,
      agency.office_country
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join(', ') : null
  }

  const getClassificationBadgeColor = (classification?: string) => {
    switch (classification) {
      case 'Commercial':
        return 'bg-blue-100 text-blue-800'
      case 'Residential':
        return 'bg-green-100 text-green-800'
      case 'Both':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full h-full max-w-6xl max-h-[90vh] m-4 bg-background rounded-2xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
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

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : error || !agency ? (
                <div className="p-6">
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
                  <div className="relative bg-gradient-to-br from-primary-50/30 via-background to-primary-50/20 border-b border-border/50">
                    <div className="p-6 lg:p-8">
                      <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
                        {/* Agency Logo */}
                        <div className="flex-shrink-0">
                          {agency.logo_url ? (
                            <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl bg-white shadow-lg ring-1 ring-black/5 p-3 flex items-center justify-center">
                              <Image
                                src={agency.logo_url}
                                alt={`${agency.name} logo`}
                                width={120}
                                height={120}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 shadow-lg ring-1 ring-primary/10 flex items-center justify-center">
                              <Building2 className="w-12 h-12 lg:w-16 lg:h-16 text-primary/60" />
                            </div>
                          )}
                        </div>
                        
                        {/* Agency Info */}
                        <div className="flex-1 min-w-0">
                          <div className="mb-4">
                            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-3 tracking-tight">
                              {agency.name}
                            </h1>
                            
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                              {agency.classification && (
                                <Badge 
                                  variant="secondary" 
                                  className={`${getClassificationBadgeColor(agency.classification)} px-3 py-1 font-medium`}
                                >
                                  {agency.classification} Property Expert
                                </Badge>
                              )}
                              
                              {agency.geographic_patch && (
                                <div className="flex items-center gap-2 text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-lg border">
                                  <MapPin className="h-4 w-4" />
                                  <span className="font-medium text-sm">{agency.geographic_patch}</span>
                                </div>
                              )}
                            </div>

                            {/* Agency Description */}
                            {agency.description && (
                              <p className="text-muted-foreground leading-relaxed max-w-2xl mb-4">
                                {agency.description}
                              </p>
                            )}
                          </div>

                          {/* Quick Contact */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button size="sm" className="shadow-sm" asChild>
                              <a href={`mailto:${agency.contact_email}?subject=Property Inquiry`}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </a>
                            </Button>
                            
                            <Button size="sm" variant="outline" className="shadow-sm" asChild>
                              <a href={`tel:${agency.contact_phone}`}>
                                <Phone className="h-4 w-4 mr-2" />
                                Call
                              </a>
                            </Button>

                            {agency.website && (
                              <Button size="sm" variant="ghost" asChild>
                                <a
                                  href={agency.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Globe className="h-4 w-4 mr-2" />
                                  Website
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="p-6 lg:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Team Members */}
                      <div className="lg:col-span-2">
                        {agency.agency_team_members && agency.agency_team_members.length > 0 ? (
                          <div>
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-foreground">Meet Our Team</h3>
                                <p className="text-muted-foreground text-sm">Expert professionals ready to help you</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {agency.agency_team_members.map((member) => (
                                <Card key={member.id} className="h-full hover:shadow-md transition-all duration-200">
                                  <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                      {member.headshot_url ? (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                          <Image
                                            src={member.headshot_url}
                                            alt={`${member.name} photo`}
                                            width={48}
                                            height={48}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                          <Users className="w-6 h-6 text-primary/60" />
                                        </div>
                                      )}
                                      
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-foreground mb-1">
                                          {member.name}
                                        </h4>
                                        <p className="text-primary/70 font-medium mb-2 text-sm">
                                          {member.title}
                                        </p>
                                        
                                        {member.bio && (
                                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                            {member.bio}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center text-center py-8">
                              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Users className="h-6 h-6 text-muted-foreground" />
                              </div>
                              <h3 className="font-semibold text-foreground mb-2">Team Coming Soon</h3>
                              <p className="text-muted-foreground text-sm max-w-md">
                                This agency is still building their team profile.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      {/* Contact Sidebar */}
                      <div>
                        {formatAddress(agency) && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <MapPin className="h-4 w-4 text-primary" />
                                </div>
                                Office Location
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-foreground font-medium text-sm leading-relaxed">
                                  {formatAddress(agency)}
                                </p>
                              </div>
                              
                              <div className="pt-2 space-y-2">
                                <h4 className="font-medium text-foreground text-sm">Get in Touch</h4>
                                
                                <a
                                  href={`mailto:${agency.contact_email}`}
                                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
                                >
                                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Mail className="h-3 w-3 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-xs">Send Email</p>
                                  </div>
                                </a>
                                
                                <a
                                  href={`tel:${agency.contact_phone}`}
                                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
                                >
                                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Phone className="h-3 w-3 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-xs">Call Now</p>
                                  </div>
                                </a>

                                {agency.website && (
                                  <a
                                    href={agency.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
                                  >
                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                      <Globe className="h-3 w-3 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground text-xs">Visit Website</p>
                                    </div>
                                  </a>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
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