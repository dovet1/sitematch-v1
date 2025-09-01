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
  Loader2,
  List,
  Map
} from 'lucide-react'
import Image from 'next/image'
import { AgencyCreationModal } from '@/components/agencies/agency-creation-modal'
import { AgencyModal } from '@/components/agencies/AgencyModal'
import { AgencyMapSimple } from '@/components/agencies/AgencyMapSimple'
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
  const [isMapView, setIsMapView] = useState(false)

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
        return 'bg-primary-100 text-primary-800 border border-primary-200'
      case 'Residential':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'Both':
        return 'bg-violet-100 text-violet-800 border border-violet-200'
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header with Glassmorphism */}
      <div className="relative overflow-hidden border-b border-slate-200/60 bg-gradient-to-br from-primary-50 via-white to-primary-50/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-100/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-blue-500/5" />
        
        <div className="relative container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="flex-1 text-center lg:text-left">
                <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                  Agency Directory
                </h1>
                <p className="text-slate-600 text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Discover vetted property agencies and connect with expert teams across Commercial and Residential markets
                </p>
              </div>
              
              <div className="flex justify-center lg:justify-end">
                {user ? (
                  <AgencyCreationModal>
                    <Button size="lg" className="shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 bg-primary hover:bg-primary/90 text-white border-0 px-8 py-3">
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
                    <Button size="lg" className="shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 bg-primary hover:bg-primary/90 text-white border-0 px-8 py-3">
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
          {/* Premium Search and Filters */}
          <div className="mb-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <Input
                      placeholder="Search agencies by name..."
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-12 pr-4 py-3 text-base border-2 border-transparent bg-slate-50 hover:bg-white focus:bg-white focus:border-primary-300 focus:shadow-lg transition-all duration-200 rounded-xl"
                    />
                  </div>
                </div>
                
                <div className="w-full lg:w-64">
                  <Select value={classification} onValueChange={handleClassificationChange}>
                    <SelectTrigger className="w-full py-3 px-4 text-base border-2 border-transparent bg-slate-50 hover:bg-white focus:border-primary-300 focus:shadow-lg transition-all duration-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <SelectValue placeholder="Filter by type" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="border-slate-200 shadow-xl">
                      <SelectItem value="all" className="text-base">All Types</SelectItem>
                      <SelectItem value="Commercial" className="text-base">Commercial</SelectItem>
                      <SelectItem value="Residential" className="text-base">Residential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center justify-center pt-4 border-t border-slate-200">
                <div className="flex rounded-lg bg-slate-100 p-1">
                  <button
                    onClick={() => setIsMapView(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      !isMapView 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    List View
                  </button>
                  <button
                    onClick={() => setIsMapView(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isMapView 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Map className="h-4 w-4" />
                    Map View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          {isMapView ? (
            <div className="h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
              <AgencyMapSimple
                search={search}
                classification={classification}
                onAgencyClick={setSelectedAgencyId}
              />
            </div>
          ) : (
            <>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {agencies.map((agency) => (
                    <Card key={agency.id} className="group relative bg-white/50 backdrop-blur-sm border border-slate-200/60 hover:border-primary-200 hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-300 hover:-translate-y-2 overflow-hidden rounded-2xl cursor-pointer" onClick={() => setSelectedAgencyId(agency.id)}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-primary-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <CardContent className="relative p-6">
                        <div className="flex items-center gap-4 mb-4">
                          {agency.logo_url ? (
                            <div className="w-16 h-16 bg-slate-50 shadow-sm border border-slate-200 flex-shrink-0 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center overflow-hidden">
                              <Image
                                src={agency.logo_url}
                                alt={`${agency.name} logo`}
                                width={56}
                                height={56}
                                className="w-14 h-14 object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200 group-hover:scale-110 transition-transform duration-300">
                              <Building2 className="w-8 h-8 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 text-lg group-hover:text-primary-700 transition-colors duration-200 line-clamp-2 leading-tight">
                              {agency.name}
                            </h3>
                          </div>
                        </div>

                        {agency.classification && (
                          <div className="mb-4">
                            <Badge 
                              className={`font-medium text-xs px-3 py-1 ${getClassificationBadgeColor(agency.classification)}`}
                            >
                              {agency.classification === 'Both' 
                                ? 'Commercial & Residential Specialists'
                                : `${agency.classification} Property Specialists`
                              }
                            </Badge>
                          </div>
                        )}

                        {agency.geographic_patch && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-600 font-medium line-clamp-2 leading-relaxed">
                              {agency.geographic_patch}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Premium Load More - Only show in list view */}
          {!isMapView && hasMore && agencies.length > 0 && (
            <div className="flex justify-center mt-12">
              <Button
                onClick={loadMore}
                variant="outline"
                disabled={isLoading}
                className="bg-white/80 backdrop-blur-sm hover:bg-primary hover:text-white border-2 border-slate-200 hover:border-primary-300 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 px-8 py-3 text-base font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading More...
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