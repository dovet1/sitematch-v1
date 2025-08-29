'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImageUpload } from '@/components/ui/image-upload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  MapPin,
  Users,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  Loader2,
  Upload,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { TeamManagement } from '@/components/agencies/team-management'
import { LocationSearch } from '@/components/search/LocationSearch'
import Image from 'next/image'
import Link from 'next/link'

interface Agency {
  id: string
  name: string
  contact_email: string
  contact_phone: string
  description?: string
  classification?: 'Commercial' | 'Residential' | 'Both'
  geographic_patch?: string
  website?: string
  logo_url?: string
  office_address?: string
  created_at: string
  updated_at: string
  agency_team_members?: TeamMember[]
  agency_versions?: Array<{
    id: string
    status: 'pending' | 'approved' | 'rejected'
    version_number: number
  }>
}

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

export default function AgencyEditPage() {
  const params = useParams()
  const router = useRouter()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

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

  const saveAllChanges = async () => {
    if (!agency || !unsavedChanges) return
    
    setIsSubmitting(true)
    try {
      const updateData = {
        name: agency.name,
        description: agency.description || '',
        classification: agency.classification || '',
        geographic_patch: agency.geographic_patch || '',
        contact_email: agency.contact_email,
        contact_phone: agency.contact_phone,
        website: agency.website || '',
        office_address: agency.office_address || ''
      }

      const response = await fetch(`/api/agencies/${agency.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        throw new Error('Failed to save changes')
      }

      setUnsavedChanges(false)
      toast.success('All changes saved successfully')
    } catch (err) {
      toast.error('Failed to save changes')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = async (field: string, value: string) => {
    if (!agency) return
    
    try {
      const response = await fetch(`/api/agencies/${agency.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      })

      if (!response.ok) {
        throw new Error('Failed to update field')
      }

      setAgency(prev => prev ? { ...prev, [field]: value } : null)
      setUnsavedChanges(false)
      toast.success('Changes saved automatically')
    } catch (err) {
      toast.error('Failed to save changes')
    }
  }

  const handleLocationSelect = (location: { name: string; coordinates: { lat: number; lng: number } }) => {
    if (!agency) return
    
    setAgency(prev => prev ? { ...prev, office_address: location.name } : null)
    setUnsavedChanges(true)
  }

  const handleLocationClear = () => {
    if (!agency) return
    
    setAgency(prev => prev ? { ...prev, office_address: '' } : null)
    setUnsavedChanges(true)
  }

  const handleLogoUpload = async (file: File | null) => {
    if (!file) {
      updateField('logo_url', '')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo') // Specify the file type for proper bucket routing

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Failed to upload logo')
      }

      const result = await response.json()
      updateField('logo_url', result.file.url) // Use the correct path from the response
    } catch (err) {
      console.error('Logo upload error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo')
    }
  }

  const submitForReview = async () => {
    if (!agency) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/agencies/${agency.id}/submit`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to submit for review')
      }

      toast.success('Agency submitted for review successfully')
      router.push('/occupier/dashboard') // Redirect to dashboard
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit for review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAgencyStatus = (agency: Agency): 'draft' | 'pending' | 'approved' | 'rejected' => {
    const versions = agency.agency_versions || []
    
    // No versions at all = draft
    if (versions.length === 0) {
      return 'draft'
    }
    
    // Find the version with the highest version number
    const latestVersion = versions.reduce((latest, current) => {
      return current.version_number > latest.version_number ? current : latest
    })
    
    // Return the status of the latest version
    return latestVersion.status
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Edit className="h-3 w-3" />Draft</Badge>
      case 'pending':
        return <Badge variant="default" className="gap-1"><Clock className="h-3 w-3" />Pending Review</Badge>
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
      {/* Status Header */}
      <div className="border-b border-border bg-gradient-to-b from-primary-50/30 to-background">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
              <Link href="/occupier/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-foreground">Edit Agency</span>
            </nav>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Edit Agency Profile
                </h1>
                <p className="text-muted-foreground">
                  Make your changes below, then click "Save Changes" to save all updates
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {getStatusBadge(getAgencyStatus(agency))}
                <Button
                  onClick={saveAllChanges}
                  disabled={!unsavedChanges || isSubmitting}
                  variant="outline"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  onClick={submitForReview}
                  disabled={isSubmitting || getAgencyStatus(agency) === 'pending'}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Submit for Review
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {getAgencyStatus(agency) === 'draft' && (
              <Alert className="mt-4">
                <Edit className="h-4 w-4" />
                <AlertDescription>
                  Your agency is in draft status. Make any changes you&apos;d like, then submit for review when ready.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header - Inline Editable */}
        <div className="mb-8">
          <div className="flex items-start gap-6 mb-6">
            {/* Logo Upload */}
            <div className="group relative flex-shrink-0">
              {agency.logo_url ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-white border border-border">
                  <Image
                    src={agency.logo_url}
                    alt={`${agency.name} logo`}
                    width={96}
                    height={96}
                    className="w-full h-full object-contain p-2"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-white mx-auto mb-1" />
                      <span className="text-xs text-white">Change Logo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border-2 border-dashed border-primary/30 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-primary/70 mx-auto mb-1" />
                    <span className="text-xs text-primary/70">Add Logo</span>
                  </div>
                </div>
              )}
              
              <ImageUpload
                value={agency.logo_url || ''}
                onChange={handleLogoUpload}
                maxSize={5 * 1024 * 1024}
                acceptedTypes={['image/png', 'image/jpeg', 'image/jpg']}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Agency Name - Inline Edit */}
              <div className="mb-2">
                <Input
                  value={agency.name}
                  onChange={(e) => {
                    setAgency(prev => prev ? { ...prev, name: e.target.value } : null)
                    setUnsavedChanges(true)
                  }}
                  className="text-3xl font-bold border-none p-0 bg-transparent focus:bg-muted/20 focus:px-2 focus:py-1 transition-all"
                  placeholder="Agency Name"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Classification - Inline Select */}
                <Select
                  value={agency.classification || ''}
                  onValueChange={(value) => {
                    setAgency(prev => prev ? { ...prev, classification: value as 'Commercial' | 'Residential' | 'Both' } : null)
                    setUnsavedChanges(true)
                  }}
                >
                  <SelectTrigger className={`w-auto border-none p-1 h-auto ${getClassificationBadgeColor(agency.classification)}`}>
                    <SelectValue placeholder="+ Add Classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Residential">Residential</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
                
                {agency.geographic_patch && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{agency.geographic_patch}</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{agency.contact_email}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{agency.contact_phone}</span>
                </div>
                
                {agency.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <a 
                      href={agency.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      Website
                    </a>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>About {agency.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={agency.description || ''}
                onChange={(e) => {
                  setAgency(prev => prev ? { ...prev, description: e.target.value } : null)
                  setUnsavedChanges(true)
                }}
                placeholder="Describe your agency, services, and expertise..."
                className="min-h-[120px] border-none resize-none focus:border-border transition-all"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {agency.description?.length || 0}/500 characters
              </p>
            </CardContent>
          </Card>

          {/* Geographic Coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Geographic Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Service Areas</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={agency.geographic_patch || ''}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, geographic_patch: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    placeholder="Geographic areas you serve (e.g., Central London, Greater Manchester)"
                    className="flex-1 border-none bg-transparent focus:bg-muted/20 focus:border-border transition-all"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Specify the geographic areas or regions where you provide services
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Office Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Office Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Email */}
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Contact Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="email"
                    value={agency.contact_email}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, contact_email: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    placeholder="contact@agency.com"
                    className="flex-1 border-none bg-transparent focus:bg-muted/20 focus:border-border transition-all"
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Contact Phone</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="tel"
                    value={agency.contact_phone}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, contact_phone: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    placeholder="Phone number"
                    className="flex-1 border-none bg-transparent focus:bg-muted/20 focus:border-border transition-all"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Website</Label>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="url"
                    value={agency.website || ''}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, website: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    placeholder="Website URL"
                    className="flex-1 border-none bg-transparent focus:bg-muted/20 focus:border-border transition-all"
                  />
                  {agency.website && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>

              {/* Office Location */}
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Office Location</Label>
                <LocationSearch
                  value={agency.office_address || ''}
                  onChange={(value) => {
                    if (value === '') {
                      // If value is empty, trigger clear function
                      handleLocationClear()
                    } else {
                      setAgency(prev => prev ? { ...prev, office_address: value } : null)
                      setUnsavedChanges(true)
                    }
                  }}
                  onLocationSelect={handleLocationSelect}
                  placeholder="Enter office address (e.g., 123 Main St, London)"
                  className="border-none focus:border-border transition-all"
                />
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <TeamManagement 
            agencyId={agency.id}
            initialTeamMembers={agency.agency_team_members || []}
          />

          {/* Actions */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle>Ready to Publish?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                When you&apos;re satisfied with your agency profile, submit it for review. Our team will review and approve it within 1-2 business days.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={submitForReview}
                  disabled={isSubmitting || getAgencyStatus(agency) === 'pending'}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Submit for Review
                    </>
                  )}
                </Button>
                
                <Button asChild variant="outline" className="flex-1">
                  <Link href={`/agencies/${agency.id}`}>
                    Preview Public Profile
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/occupier/dashboard">
              ← Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}