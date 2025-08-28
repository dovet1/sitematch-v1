'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Building2,
  MapPin,
  Users,
  Globe,
  Phone,
  Mail,
  Search,
  Filter,
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import { AgencyCreationModal } from '@/components/agencies/agency-creation-modal'
import { AgencyModal } from '@/components/agencies/AgencyModal'
import { useAuth } from '@/contexts/auth-context'
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal'

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
  agency_team_members?: Array<{
    id: string
    name: string
    title: string
    headshot_url?: string
  }>
}

export default function AgenciesPage() {
  const { user } = useAuth()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classification, setClassification] = useState('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null)

  useEffect(() => {
    fetchAgencies()
  }, [search, classification, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAgencies = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
      })

      if (search.trim()) {
        params.append('search', search.trim())
      }

      if (classification && classification !== 'all') {
        params.append('classification', classification)
      }

      const response = await fetch(`/api/agencies?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch agencies')
      }

      const result = await response.json()
      
      if (page === 1) {
        setAgencies(result.data || [])
      } else {
        setAgencies(prev => [...prev, ...(result.data || [])])
      }

      setHasMore((result.data || []).length === 12)
    } catch (err) {
      console.error('Error fetching agencies:', err)
      setAgencies([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    setIsLoading(true)
  }

  const handleClassificationChange = (value: string) => {
    setClassification(value)
    setPage(1)
    setIsLoading(true)
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-b from-primary-50/30 to-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="text-left sm:text-center flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Agency Directory
                </h1>
                <p className="text-muted-foreground text-lg">
                  Discover property agencies and connect with expert teams
                </p>
              </div>
              
              <div className="flex justify-center sm:justify-end">
                {user ? (
                  <AgencyCreationModal>
                    <Button size="lg" className="shadow-sm">
                      <Building2 className="w-5 h-5 mr-2" />
                      Join Directory
                    </Button>
                  </AgencyCreationModal>
                ) : (
                  <AuthChoiceModal
                    redirectTo="/occupier/dashboard"
                    title="Create Your Agency Profile"
                    description="Sign up to showcase your agency in our directory"
                  >
                    <Button size="lg" className="shadow-sm">
                      <Building2 className="w-5 h-5 mr-2" />
                      Join Directory
                    </Button>
                  </AuthChoiceModal>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Search and Filters */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search agencies by name..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="w-full sm:w-48">
                <Select value={classification} onValueChange={handleClassificationChange}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Residential">Residential</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results */}
          {isLoading && page === 1 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : agencies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No agencies found</h3>
              <p className="text-muted-foreground">
                {search || classification !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'No agencies are currently available'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agencies.map((agency) => (
                <Card key={agency.id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {agency.logo_url ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={agency.logo_url}
                              alt={`${agency.name} logo`}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-6 h-6 text-primary/70" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {agency.name}
                          </h3>
                          {agency.classification && (
                            <Badge 
                              variant="secondary" 
                              className={`mt-1 ${getClassificationBadgeColor(agency.classification)}`}
                            >
                              {agency.classification}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    {agency.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                        {agency.description}
                      </p>
                    )}
                    
                    <div className="space-y-2 mb-4">
                      {agency.geographic_patch && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {agency.geographic_patch}
                          </span>
                        </div>
                      )}
                      
                      {formatAddress(agency) && (
                        <div className="flex items-start gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground text-xs line-clamp-2">
                            {formatAddress(agency)}
                          </span>
                        </div>
                      )}
                      
                      {agency.agency_team_members && agency.agency_team_members.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">
                            {agency.agency_team_members.length} team member{agency.agency_team_members.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <a
                          href={`mailto:${agency.contact_email}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Send email"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                        <a
                          href={`tel:${agency.contact_phone}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        {agency.website && (
                          <a
                            href={agency.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Visit website"
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedAgencyId(agency.id)}
                      >
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && agencies.length > 0 && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={loadMore}
                variant="outline"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Agencies'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Agency Modal */}
      <AgencyModal 
        agencyId={selectedAgencyId}
        isOpen={!!selectedAgencyId}
        onClose={() => setSelectedAgencyId(null)}
      />
    </div>
  )
}