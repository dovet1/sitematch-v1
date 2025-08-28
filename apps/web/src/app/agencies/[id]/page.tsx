'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  AlertTriangle
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

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

export default function AgencyProfilePage() {
  const params = useParams()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgency()
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAgency = async () => {
    try {
      const response = await fetch(`/api/agencies/${params.id}`)
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !agency) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Agency not found'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Hero Section */}
      <div className="relative bg-gradient-to-br from-primary-50/30 via-background to-primary-50/20 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="container mx-auto px-6 py-12 relative">
          <div className="max-w-5xl mx-auto">
            {/* Navigation breadcrumb */}
            <nav className="mb-8">
              <Link 
                href="/agencies" 
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                ← Back to Agency Directory
              </Link>
            </nav>

            {/* Hero Content */}
            <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
              {/* Agency Logo - Enhanced */}
              <div className="flex-shrink-0">
                {agency.logo_url ? (
                  <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-2xl bg-white shadow-lg ring-1 ring-black/5 p-4 flex items-center justify-center">
                    <Image
                      src={agency.logo_url}
                      alt={`${agency.name} logo`}
                      width={160}
                      height={160}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 shadow-lg ring-1 ring-primary/10 flex items-center justify-center">
                    <Building2 className="w-16 h-16 lg:w-20 lg:h-20 text-primary/60" />
                  </div>
                )}
              </div>
              
              {/* Agency Info - Enhanced */}
              <div className="flex-1 min-w-0">
                {/* Agency Name & Classification */}
                <div className="mb-6">
                  <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-3 tracking-tight">
                    {agency.name}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    {agency.classification && (
                      <Badge 
                        variant="secondary" 
                        className={`${getClassificationBadgeColor(agency.classification)} text-base px-4 py-1.5 font-medium`}
                      >
                        {agency.classification} Property Expert
                      </Badge>
                    )}
                    
                    {agency.geographic_patch && (
                      <div className="flex items-center gap-2 text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border">
                        <MapPin className="h-4 w-4" />
                        <span className="font-medium">{agency.geographic_patch}</span>
                      </div>
                    )}
                  </div>

                  {/* Agency Description Preview */}
                  {agency.description && (
                    <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                      {agency.description}
                    </p>
                  )}
                </div>

                {/* Quick Contact - Enhanced */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="shadow-sm" asChild>
                    <a href={`mailto:${agency.contact_email}?subject=Property Inquiry`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </a>
                  </Button>
                  
                  <Button size="lg" variant="outline" className="shadow-sm" asChild>
                    <a href={`tel:${agency.contact_phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call {agency.contact_phone}
                    </a>
                  </Button>

                  {agency.website && (
                    <Button size="lg" variant="ghost" asChild>
                      <a
                        href={agency.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Visit Website
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 max-w-6xl">

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content - 2/3 width */}
          <div className="lg:col-span-2 space-y-8">

            {/* Premium Team Members Section */}
            {agency.agency_team_members && agency.agency_team_members.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">Meet Our Team</h2>
                    <p className="text-muted-foreground">Expert professionals ready to help you</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {agency.agency_team_members.map((member, index) => (
                    <Link
                      key={member.id}
                      href={`/agencies/${agency.id}/team/${member.id}`}
                      className="group block"
                    >
                      <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:shadow-primary/5 group-hover:border-primary/20">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {member.headshot_url ? (
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 ring-2 ring-background group-hover:ring-primary/20 transition-all">
                                <Image
                                  src={member.headshot_url}
                                  alt={`${member.name} photo`}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 ring-2 ring-background group-hover:ring-primary/20 transition-all">
                                <Users className="w-8 h-8 text-primary/60" />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors text-lg">
                                {member.name}
                              </h4>
                              <p className="text-primary/70 font-medium mb-2 text-sm">
                                {member.title}
                              </p>
                              
                              {member.bio && (
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                                  {member.bio}
                                </p>
                              )}
                              
                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                  {member.email && (
                                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center" title="Email available">
                                      <Mail className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                  
                                  {member.phone && (
                                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center" title="Phone available">
                                      <Phone className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                  
                                  {member.linkedin_url && (
                                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center" title="LinkedIn available">
                                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                
                                <div className="text-xs text-primary group-hover:text-primary/80 font-medium">
                                  View Profile →
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Team Coming Soon</h3>
                  <p className="text-muted-foreground max-w-md">
                    This agency is still building their team profile. Check back soon to meet the professionals who will help you.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - 1/3 width */}
          <div className="space-y-6">
            {formatAddress(agency) && (
              <Card className="sticky top-6">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    Office Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-foreground font-medium leading-relaxed">
                      {formatAddress(agency)}
                    </p>
                  </div>
                  
                  {/* Quick Contact Actions */}
                  <div className="pt-2 space-y-3">
                    <h4 className="font-medium text-foreground mb-3">Get in Touch</h4>
                    
                    <a
                      href={`mailto:${agency.contact_email}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">Send Email</p>
                        <p className="text-xs text-muted-foreground truncate">{agency.contact_email}</p>
                      </div>
                    </a>
                    
                    <a
                      href={`tel:${agency.contact_phone}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">Call Now</p>
                        <p className="text-xs text-muted-foreground">{agency.contact_phone}</p>
                      </div>
                    </a>

                    {agency.website && (
                      <a
                        href={agency.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Globe className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">Visit Website</p>
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-muted-foreground truncate">View online presence</p>
                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
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
    </div>
  )
}