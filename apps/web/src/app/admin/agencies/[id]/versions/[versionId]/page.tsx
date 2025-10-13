'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  ArrowLeft,
  Building2, 
  Users, 
  Clock, 
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import { createClientClient } from '@/lib/supabase'

interface AgencyVersion {
  id: string
  agency_id: string
  version_number: number
  status: 'pending' | 'approved' | 'rejected'
  data: {
    agency: {
      name: string
      contact_email: string
      contact_phone: string
      description?: string
      classification?: string
      geographic_patch?: string
      website?: string
      logo_url?: string
      office_street_address?: string
      office_city?: string
      office_postcode?: string
      office_country?: string
    }
    team_members: Array<{
      id: string
      name: string
      title: string
      bio?: string
      email?: string
      phone?: string
      linkedin_url?: string
      headshot_url?: string
      display_order: number
    }>
  }
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  review_notes?: string
  agency?: {
    name: string
    created_at: string
  }
}

export default function AdminAgencyVersionReviewPage() {
  const params = useParams<{ id: string; versionId: string }>()
  const { id: agencyId, versionId } = params
  const [version, setVersion] = useState<AgencyVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')

  useEffect(() => {
    fetchVersion()
  }, [agencyId, versionId])

  const fetchVersion = async () => {
    try {
      const supabase = createClientClient()
      
      const { data, error } = await supabase
        .from('agency_versions')
        .select(`
          *,
          agency:agencies (
            name,
            created_at
          )
        `)
        .eq('id', versionId)
        .eq('agency_id', agencyId)
        .single()

      if (error) throw error
      
      setVersion(data)
    } catch (error) {
      console.error('Error fetching version:', error)
      toast.error('Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const updateVersionStatus = async (status: 'approved' | 'rejected') => {
    if (!version) return

    try {
      setUpdating(true)
      
      const response = await fetch(`/api/admin/agencies/${agencyId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status, 
          notes: reviewNotes.trim() || undefined 
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${status} version`)
      }

      toast.success(result.message)
      fetchVersion() // Refresh the data
    } catch (error) {
      console.error(`Error ${status}ing version:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to ${status} version`)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatAddress = (agencyData: any) => {
    const parts = [
      agencyData.office_street_address,
      agencyData.office_city,
      agencyData.office_postcode,
      agencyData.office_country
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join(', ') : null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!version) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Version Not Found</h1>
            <p className="text-muted-foreground mb-6">The requested agency version could not be found.</p>
            <Button asChild>
              <Link href="/admin/agencies">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Agencies
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const { agency: agencyData, team_members } = version.data

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/agencies">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agencies
            </Link>
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Review Agency Version
            </h1>
            <p className="text-muted-foreground">
              {version.agency?.name} - Version {version.version_number}
            </p>
          </div>
          
          <div className="ml-auto">
            {getStatusBadge(version.status)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agency Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Agency Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  {agencyData.logo_url ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <Image
                        src={agencyData.logo_url}
                        alt={`${agencyData.name} logo`}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-8 h-8 text-primary/70" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {agencyData.name}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {agencyData.contact_email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {agencyData.contact_phone}
                      </div>
                      {agencyData.website && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4" />
                          <a href={agencyData.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                            {agencyData.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {agencyData.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {agencyData.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agencyData.classification && (
                    <div>
                      <Label className="text-sm font-medium">Classification</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {agencyData.classification}
                      </p>
                    </div>
                  )}
                  
                  {agencyData.geographic_patch && (
                    <div>
                      <Label className="text-sm font-medium">Geographic Area</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {agencyData.geographic_patch}
                      </p>
                    </div>
                  )}
                </div>

                {formatAddress(agencyData) && (
                  <div>
                    <Label className="text-sm font-medium">Office Address</Label>
                    <div className="flex items-start gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {formatAddress(agencyData)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members ({team_members?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {team_members && team_members.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {team_members
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((member) => (
                        <div key={member.id} className="flex items-start gap-3 p-4 border rounded-lg">
                          {member.headshot_url ? (
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                              <Image
                                src={member.headshot_url}
                                alt={`${member.name} headshot`}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-primary/70" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground">
                              {member.name}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {member.title}
                            </p>
                            {member.bio && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {member.bio}
                              </p>
                            )}
                            
                            {(member.email || member.phone || member.linkedin_url) && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                {member.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {member.email}
                                  </div>
                                )}
                                {member.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {member.phone}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No team members added yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Version Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Version Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(version.status)}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Version Number</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {version.version_number}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Submitted</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(version.submitted_at).toLocaleString()}
                  </p>
                </div>

                {version.reviewed_at && (
                  <div>
                    <Label className="text-sm font-medium">Reviewed</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(version.reviewed_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {version.review_notes && (
                  <div>
                    <Label className="text-sm font-medium">Review Notes</Label>
                    <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted rounded">
                      {version.review_notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Review Actions */}
            {version.status === 'pending' && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="review-notes" className="text-sm font-medium">
                      Review Notes (Optional)
                    </Label>
                    <Textarea
                      id="review-notes"
                      placeholder="Add notes about this review..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => updateVersionStatus('rejected')}
                      disabled={updating}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => updateVersionStatus('approved')}
                      disabled={updating}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
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