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
  office_street_address?: string
  office_city?: string
  office_postcode?: string
  office_country?: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  agency_team_members?: TeamMember[]
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
                  Click any field to edit inline - changes save automatically
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {getStatusBadge(agency.status)}
                <Button
                  onClick={submitForReview}
                  disabled={isSubmitting || agency.status === 'pending'}
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
            
            {agency.status === 'draft' && (
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
            <div className="group relative">
              {agency.logo_url ? (
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 group-hover:opacity-75 transition-opacity">
                  <Image
                    src={agency.logo_url}
                    alt={`${agency.name} logo`}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors border-2 border-dashed border-primary/30">
                  <Upload className="w-8 h-8 text-primary/70" />
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
                  onBlur={(e) => updateField('name', e.target.value)}
                  className="text-3xl font-bold border-none p-0 bg-transparent focus:bg-muted/20 focus:px-2 focus:py-1 transition-all"
                  placeholder="Agency Name"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Classification - Inline Select */}
                <Select
                  value={agency.classification || ''}
                  onValueChange={(value) => updateField('classification', value)}
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
                
                {/* Geographic Patch - Inline Edit */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <Input
                    value={agency.geographic_patch || ''}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, geographic_patch: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    onBlur={(e) => updateField('geographic_patch', e.target.value)}
                    placeholder="Geographic area"
                    className="border-none p-0 bg-transparent focus:bg-muted/20 focus:px-2 focus:py-1 transition-all h-auto"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                {/* Contact Email - Inline Edit */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                  <Input
                    type="email"
                    value={agency.contact_email}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, contact_email: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    onBlur={(e) => updateField('contact_email', e.target.value)}
                    placeholder="contact@agency.com"
                    className="border-none p-0 bg-transparent focus:bg-muted/20 focus:px-2 focus:py-1 transition-all h-auto w-auto min-w-[200px]"
                  />
                </div>
                
                {/* Contact Phone - Inline Edit */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Phone className="h-4 w-4" />
                  <Input
                    type="tel"
                    value={agency.contact_phone}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, contact_phone: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    onBlur={(e) => updateField('contact_phone', e.target.value)}
                    placeholder="Phone number"
                    className="border-none p-0 bg-transparent focus:bg-muted/20 focus:px-2 focus:py-1 transition-all h-auto w-auto min-w-[150px]"
                  />
                </div>
                
                {/* Website - Inline Edit */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Globe className="h-4 w-4" />
                  <Input
                    type="url"
                    value={agency.website || ''}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, website: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    onBlur={(e) => updateField('website', e.target.value)}
                    placeholder="Website URL"
                    className="border-none p-0 bg-transparent focus:bg-muted/20 focus:px-2 focus:py-1 transition-all h-auto w-auto min-w-[150px]"
                  />
                  {agency.website && <ExternalLink className="h-3 w-3" />}
                </div>
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
                onBlur={(e) => updateField('description', e.target.value)}
                placeholder="Describe your agency, services, and expertise..."
                className="min-h-[120px] border-none resize-none focus:border-border transition-all"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {agency.description?.length || 0}/500 characters
              </p>
            </CardContent>
          </Card>

          {/* Office Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Office Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={agency.office_street_address || ''}
                onChange={(e) => {
                  setAgency(prev => prev ? { ...prev, office_street_address: e.target.value } : null)
                  setUnsavedChanges(true)
                }}
                onBlur={(e) => updateField('office_street_address', e.target.value)}
                placeholder="Street address"
                className="border-none focus:border-border transition-all"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  value={agency.office_city || ''}
                  onChange={(e) => {
                    setAgency(prev => prev ? { ...prev, office_city: e.target.value } : null)
                    setUnsavedChanges(true)
                  }}
                  onBlur={(e) => updateField('office_city', e.target.value)}
                  placeholder="City"
                  className="border-none focus:border-border transition-all"
                />
                
                <Input
                  value={agency.office_postcode || ''}
                  onChange={(e) => {
                    setAgency(prev => prev ? { ...prev, office_postcode: e.target.value } : null)
                    setUnsavedChanges(true)
                  }}
                  onBlur={(e) => updateField('office_postcode', e.target.value)}
                  placeholder="Postcode"
                  className="border-none focus:border-border transition-all"
                />
                
                <Input
                  value={agency.office_country || ''}
                  onChange={(e) => {
                    setAgency(prev => prev ? { ...prev, office_country: e.target.value } : null)
                    setUnsavedChanges(true)
                  }}
                  onBlur={(e) => updateField('office_country', e.target.value)}
                  placeholder="Country"
                  className="border-none focus:border-border transition-all"
                />
              </div>
              
              {formatAddress(agency) && (
                <p className="text-sm text-muted-foreground mt-2">
                  Preview: {formatAddress(agency)}
                </p>
              )}
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
                  disabled={isSubmitting || agency.status === 'pending'}
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