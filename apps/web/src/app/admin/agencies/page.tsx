'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Search, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Edit,
  Eye,
  Users,
  Filter,
  Loader2,
  ExternalLink,
  Calendar
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClientClient } from '@/lib/supabase'

interface Agency {
  id: string
  name: string
  contact_email: string
  contact_phone: string
  description?: string
  classification?: string
  geographic_patch?: string
  website?: string
  logo_url?: string
  created_at: string
  updated_at: string
  created_by: string
  current_version_id?: string
  agency_team_members?: Array<{ id: string; name: string }>
  agency_versions?: Array<{ 
    id: string
    status: 'pending' | 'approved' | 'rejected'
    version_number: number
  }>
}

interface AgencyVersion {
  id: string
  agency_id: string
  version_number: number
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  review_notes?: string
  data: any
}

export default function AdminAgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [versions, setVersions] = useState<AgencyVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('agencies')

  useEffect(() => {
    fetchData()
  }, [search, statusFilter])

  const fetchData = async () => {
    try {
      const supabase = createClientClient()
      
      // Fetch agencies with their versions
      let agencyQuery = supabase
        .from('agencies')
        .select(`
          *,
          agency_team_members (id, name),
          agency_versions (
            id,
            status,
            version_number
          )
        `)
        .order('created_at', { ascending: false })

      if (search.trim()) {
        agencyQuery = agencyQuery.ilike('name', `%${search.trim()}%`)
      }

      const { data: rawAgencies, error: agencyError } = await agencyQuery

      if (agencyError) throw agencyError

      // Process agencies and apply status filter based on versions
      let processedAgencies = rawAgencies || []
      
      if (statusFilter !== 'all') {
        processedAgencies = processedAgencies.filter(agency => {
          const versions = agency.agency_versions || []
          switch (statusFilter) {
            case 'pending':
              return versions.some((v: any) => v.status === 'pending')
            case 'approved': 
              return versions.some((v: any) => v.status === 'approved')
            case 'rejected':
              return versions.some((v: any) => v.status === 'rejected')
            default:
              return true
          }
        })
      }

      setAgencies(processedAgencies)

      // Fetch pending versions
      const { data: versionData, error: versionError } = await supabase
        .from('agency_versions')
        .select(`
          *,
          agency:agencies (
            id,
            name,
            created_by
          )
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })

      if (versionError) throw versionError

      setVersions(versionData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load agencies')
    } finally {
      setIsLoading(false)
    }
  }

  const updateAgencyStatus = async (agencyId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      const response = await fetch(`/api/admin/agencies/${agencyId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update agency status')
      }

      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success(result.message)
      }

      console.log(`Agency ${status} successfully. Updated ${result.updatedVersions} version(s).`)
      
      fetchData()
    } catch (error) {
      console.error('Error updating agency status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update agency status')
    }
  }

  const getAgencyStatus = (agency: Agency): 'draft' | 'pending' | 'approved' | 'rejected' => {
    const versions = agency.agency_versions || []
    if (versions.length === 0) return 'draft'
    
    // If has approved version, show as approved (even if also has pending)
    if (versions.some((v: any) => v.status === 'approved')) return 'approved'
    
    // If has pending version, show as pending
    if (versions.some((v: any) => v.status === 'pending')) return 'pending'
    
    // If only rejected versions
    if (versions.some((v: any) => v.status === 'rejected')) return 'rejected'
    
    return 'draft'
  }

  const hasPendingVersion = (agency: Agency): boolean => {
    return agency.agency_versions?.some((v: any) => v.status === 'pending') || false
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Edit className="h-3 w-3" />Draft</Badge>
      case 'pending':
        return <Badge variant="default" className="gap-1 bg-yellow-500"><Clock className="h-3 w-3" />Pending</Badge>
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Rejected</Badge>
      default:
        return null
    }
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-b from-primary-50/30 to-background">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
              <Link href="/admin" className="hover:text-foreground">
                Admin
              </Link>
              <span>/</span>
              <span className="text-foreground">Agency Management</span>
            </nav>
            
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Agency Management
            </h1>
            <p className="text-muted-foreground">
              Review and manage agency profiles and submissions
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Search and Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search agencies by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="agencies">
                All Agencies ({agencies.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending Reviews ({versions.length})
              </TabsTrigger>
            </TabsList>

            {/* All Agencies Tab */}
            <TabsContent value="agencies" className="space-y-4">
              {agencies.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No agencies found</h3>
                    <p className="text-muted-foreground">
                      {search || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'No agencies have been created yet'
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                agencies.map((agency) => (
                  <Card key={agency.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Logo */}
                        <div className="flex-shrink-0">
                          {agency.logo_url ? (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                              <Image
                                src={agency.logo_url}
                                alt={`${agency.name} logo`}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                              <Building2 className="w-8 h-8 text-primary/70" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">
                                {agency.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(getAgencyStatus(agency))}
                                {agency.classification && (
                                  <Badge 
                                    variant="secondary"
                                    className={getClassificationBadgeColor(agency.classification)}
                                  >
                                    {agency.classification}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Contact: </span>
                              <span className="text-foreground">{agency.contact_email}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Phone: </span>
                              <span className="text-foreground">{agency.contact_phone}</span>
                            </div>
                            {agency.geographic_patch && (
                              <div>
                                <span className="text-muted-foreground">Area: </span>
                                <span className="text-foreground">{agency.geographic_patch}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Team: </span>
                              <span className="text-foreground">
                                {agency.agency_team_members?.length || 0} members
                              </span>
                            </div>
                          </div>

                          {agency.description && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {agency.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/agencies/${agency.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </Link>
                            </Button>

                            {hasPendingVersion(agency) && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => updateAgencyStatus(agency.id, 'approved')}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateAgencyStatus(agency.id, 'rejected')}
                                >
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}

                            <div className="ml-auto text-xs text-muted-foreground">
                              Created {new Date(agency.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Pending Reviews Tab */}
            <TabsContent value="pending" className="space-y-4">
              {versions.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No pending reviews</h3>
                    <p className="text-muted-foreground">
                      All agency submissions have been reviewed
                    </p>
                  </CardContent>
                </Card>
              ) : (
                versions.map((version) => (
                  <Card key={version.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {version.data?.agency?.name || 'Unknown Agency'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="default" className="gap-1 bg-yellow-500">
                              <Clock className="h-3 w-3" />
                              Version {version.version_number}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Submitted {new Date(version.submitted_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/agencies/${version.agency_id}/versions/${version.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Review Version
                          </Link>
                        </Button>
                        
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/agencies/${version.agency_id}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Current
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}