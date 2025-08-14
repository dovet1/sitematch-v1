'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Users,
  Search,
  Filter,
  AlertTriangle,
  TrendingUp,
  Eye,
  Calendar,
  MapPin
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'

interface AgencyStats {
  total: number
  pending: number
  approved: number
  rejected: number
  approvalRate: number
  avgReviewTime: number
}

interface PendingAgency {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'pending' | 'draft'
  created_at: string
  created_by: string
  creator_email: string
  agent_count: number
  listings_count: number
}

interface AdminAgenciesDashboardProps {
  stats: AgencyStats
  pendingAgencies: PendingAgency[]
}

export function AdminAgenciesDashboard({ stats, pendingAgencies }: AdminAgenciesDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'draft' | 'rejected'>('all')

  function getAgencyInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getPriorityLevel(agency: PendingAgency): 'high' | 'medium' | 'low' {
    const daysSinceSubmission = Math.floor(
      (Date.now() - new Date(agency.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceSubmission >= 3) return 'high'
    if (daysSinceSubmission >= 1) return 'medium'
    return 'low'
  }

  function getPriorityBorder(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-l-red-500'
      case 'medium':
        return 'border-l-4 border-l-yellow-500'
      case 'low':
        return 'border-l-4 border-l-green-500'
      default:
        return ''
    }
  }

  function getPriorityBadge(priority: 'high' | 'medium' | 'low') {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Urgent</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Standard</Badge>
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Recent</Badge>
    }
  }

  // Filter agencies based on search and status
  const filteredAgencies = pendingAgencies.filter(agency => {
    const matchesSearch = searchTerm === '' || 
      agency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agency.creator_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agency.coverage_areas && agency.coverage_areas.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = filterStatus === 'all' || agency.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="heading-1">Agency Administration</h1>
          <p className="body-large text-muted-foreground">Review and approve agency submissions</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agencies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.approved} approved, {stats.rejected} rejected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Requiring admin attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>All Agencies</CardTitle>
          <CardDescription>View and manage all agency submissions (pending, approved, rejected)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search agencies, creators, or locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All ({pendingAgencies.length})
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('pending')}
              >
                Pending ({pendingAgencies.filter(a => a.status === 'pending').length})
              </Button>
              <Button
                variant={filterStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('draft')}
              >
                Draft ({pendingAgencies.filter(a => a.status === 'draft').length})
              </Button>
              <Button
                variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('rejected')}
              >
                Rejected ({pendingAgencies.filter(a => a.status === 'rejected').length})
              </Button>
            </div>
          </div>

          {/* Agency Cards */}
          <div className="space-y-4">
            {filteredAgencies.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No agencies found</h3>
                <p className="text-gray-600">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'All agencies have been reviewed'
                  }
                </p>
              </div>
            ) : (
              filteredAgencies.map((agency) => {
                const priority = getPriorityLevel(agency)
                return (
                  <Card key={agency.id} className={`hover:shadow-md transition-shadow ${getPriorityBorder(priority)}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          {/* Agency Logo */}
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            {agency.logo_url ? (
                              <Image
                                src={agency.logo_url}
                                alt={`${agency.name} logo`}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-semibold text-lg">
                                {getAgencyInitials(agency.name)}
                              </span>
                            )}
                          </div>

                          {/* Agency Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                  {agency.name}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                  <span>Created by {agency.creator_email}</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(agency.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getPriorityBadge(priority)}
                                <Badge className={getStatusColor(agency.status)}>
                                  {agency.status}
                                </Badge>
                              </div>
                            </div>

                            {/* Coverage and Specialisms */}
                            <div className="space-y-2 mb-4">
                              {agency.coverage_areas && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  <span className="truncate">{agency.coverage_areas}</span>
                                </div>
                              )}
                              {agency.specialisms && agency.specialisms.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {agency.specialisms.slice(0, 3).map((specialism, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {specialism}
                                    </Badge>
                                  ))}
                                  {agency.specialisms.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{agency.specialisms.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {agency.agent_count} team member{agency.agent_count !== 1 ? 's' : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {agency.listings_count} listing{agency.listings_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="ml-4">
                          <Link href={`/admin/agencies/${agency.id}/review`}>
                            <Button className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Review
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}