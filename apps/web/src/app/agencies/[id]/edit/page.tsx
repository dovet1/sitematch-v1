'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  X,
  Save,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'
import { TeamManagement } from '@/components/agencies/team-management'
import { CompanyLinking } from '@/components/agencies/company-linking'
import { LocationSearch } from '@/components/search/LocationSearch'
import Image from 'next/image'
import Link from 'next/link'
import { AgencyModal } from '@/components/agencies/AgencyModal'

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
  const [showPreview, setShowPreview] = useState(false)

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
      formData.append('type', 'logo')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Failed to upload logo')
      }

      const result = await response.json()
      updateField('logo_url', result.file.url)
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
      router.push('/occupier/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit for review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAgencyStatus = (agency: Agency): 'draft' | 'pending' | 'approved' | 'rejected' => {
    const versions = agency.agency_versions || []
    
    if (versions.length === 0) {
      return 'draft'
    }
    
    const latestVersion = versions.reduce((latest, current) => {
      return current.version_number > latest.version_number ? current : latest
    })
    
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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">

      {/* Premium Full-Screen Layout with Violet Bloom */}
      <div className="min-h-screen flex flex-col">
        {/* Enhanced Hero Section with Better UX */}
        <div className="relative bg-white/80 backdrop-blur-xl border-b border-violet-200/40">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-purple-600/5" />
          
          {/* Top Navigation Bar */}
          <div className="relative px-6 py-4 border-b border-violet-100/50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <Link 
                href="/occupier/dashboard"
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50/50 hover:bg-violet-100/70 text-violet-700 hover:text-violet-800 transition-all duration-200 text-sm font-medium border border-violet-200/50 hover:border-violet-300/70 hover:shadow-sm"
              >
                <svg 
                  className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
              
              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Status:</span>
                {getStatusBadge(getAgencyStatus(agency))}
              </div>
            </div>
          </div>
          
          {/* Main Hero Content */}
          <div className="relative px-6 py-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">Edit Agency Profile</h1>
                  <p className="text-violet-600/70 text-sm">Manage your agency's public presence and team information</p>
                </div>
                
                {/* Action Buttons Group */}
                <div className="flex items-center gap-3">
                  {/* Save Button - Always visible, disabled when no changes */}
                  <Button
                    onClick={saveAllChanges}
                    disabled={!unsavedChanges || isSubmitting}
                    variant="outline"
                    className={`${
                      unsavedChanges 
                        ? 'border-violet-300 text-violet-700 hover:bg-violet-50' 
                        : 'border-slate-200 text-slate-400 cursor-not-allowed'
                    } transition-all duration-200`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {unsavedChanges ? 'Save Changes' : 'All Saved'}
                      </>
                    )}
                  </Button>
                  
                  {/* Preview Button */}
                  <Button
                    onClick={() => setShowPreview(true)}
                    variant="outline"
                    className="border-violet-300 text-violet-700 hover:bg-violet-50 transition-all duration-200"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  
                  {/* Publish Button */}
                  <Button
                    onClick={submitForReview}
                    disabled={isSubmitting || getAgencyStatus(agency) === 'pending' || unsavedChanges}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-6 py-2 rounded-xl font-medium shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : getAgencyStatus(agency) === 'pending' ? (
                      <>
                        <Clock className="mr-2 h-4 w-4" />
                        Under Review
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Publish Profile
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Unsaved Changes Warning */}
              {unsavedChanges && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">You have unsaved changes. Save before publishing or they will be lost.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium Main Content with Violet Bloom Styling */}
        <div className="flex-1 flex">
          {/* Primary Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 space-y-6">
              
              {/* Compact Agency Header */}
              <div className="flex items-center gap-6 py-6">
                {/* Logo Section */}
                <div className="group relative">
                  <div className="relative">
                    {agency.logo_url ? (
                      <div className="w-16 h-16 rounded-xl bg-white/80 backdrop-blur-xl border border-violet-200/60 p-2 flex items-center justify-center shadow-lg shadow-violet-500/10">
                        <Image
                          src={agency.logo_url}
                          alt={`${agency.name} logo`}
                          width={64}
                          height={64}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-100/80 to-purple-100/80 border border-violet-200/60 flex items-center justify-center shadow-lg shadow-violet-500/10 backdrop-blur-xl">
                        <Building2 className="w-8 h-8 text-violet-400" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-violet-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 rounded-xl cursor-pointer">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    
                    <ImageUpload
                      value={agency.logo_url || ''}
                      onChange={handleLogoUpload}
                      maxSize={5 * 1024 * 1024}
                      acceptedTypes={['image/png', 'image/jpeg', 'image/jpg']}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                
                {/* Agency Name & Classification */}
                <div className="flex-1">
                  <Input
                    value={agency.name}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, name: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    className="text-3xl font-bold text-slate-900 border-none p-0 bg-transparent focus:outline-none placeholder-violet-300 mb-2"
                    placeholder="Your Agency Name"
                  />
                  <p className="text-sm text-slate-600 mb-1">
                    We specialise in
                  </p>
                  <div className="inline-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setAgency(prev => prev ? { ...prev, classification: 'Commercial' } : null)
                        setUnsavedChanges(true)
                      }}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                        agency.classification === 'Commercial'
                          ? 'bg-violet-100 border-violet-300 text-violet-800 font-medium shadow-sm'
                          : 'bg-white/70 border-violet-200/50 text-slate-600 hover:bg-violet-50 hover:border-violet-300'
                      }`}
                    >
                      Commercial Properties
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAgency(prev => prev ? { ...prev, classification: 'Residential' } : null)
                        setUnsavedChanges(true)
                      }}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                        agency.classification === 'Residential'
                          ? 'bg-violet-100 border-violet-300 text-violet-800 font-medium shadow-sm'
                          : 'bg-white/70 border-violet-200/50 text-slate-600 hover:bg-violet-50 hover:border-violet-300'
                      }`}
                    >
                      Residential Properties
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAgency(prev => prev ? { ...prev, classification: 'Both' } : null)
                        setUnsavedChanges(true)
                      }}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                        agency.classification === 'Both'
                          ? 'bg-violet-100 border-violet-300 text-violet-800 font-medium shadow-sm'
                          : 'bg-white/70 border-violet-200/50 text-slate-600 hover:bg-violet-50 hover:border-violet-300'
                      }`}
                    >
                      Both Commercial & Residential
                    </button>
                  </div>
                </div>
              </div>

              {/* About Section */}
              <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-violet-200/40 shadow-lg shadow-violet-500/5">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-3">Tell Your Story</h2>
                  <Textarea
                    value={agency.description || ''}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, description: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    placeholder="Describe your agency's unique value proposition, expertise, and what sets you apart in the market..."
                    className="w-full min-h-[120px] border-none bg-transparent text-slate-700 placeholder-violet-400 resize-none focus:outline-none"
                    maxLength={500}
                  />
                  <div className="text-xs text-violet-400 text-right mt-2">
                    {agency.description?.length || 0}/500 words
                  </div>
                </div>
              </div>

              {/* Team Section */}
              <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-violet-200/40 shadow-lg shadow-violet-500/5">
                <div className="p-6">
                  <TeamManagement 
                    agencyId={agency.id}
                    initialTeamMembers={agency.agency_team_members || []}
                  />
                </div>
              </div>

              {/* Client Companies Section */}
              <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-violet-200/40 shadow-lg shadow-violet-500/5">
                <div className="p-6">
                  <CompanyLinking agencyId={agency.id} />
                </div>
              </div>

              {/* Call-to-Action */}
              {getAgencyStatus(agency) === 'draft' && (
                <div className="text-center py-6">
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Ready to Launch?</h3>
                  <p className="text-violet-600/80 mb-6">
                    Submit for review and go live within 24-48 hours.
                  </p>
                  <Button asChild className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-6 py-2 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105">
                    <Link href={`/agencies/${agency.id}`}>
                      Preview Your Profile
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Agency Details Sidebar */}
          <div className="w-96 border-l border-violet-200/40 bg-white/60 backdrop-blur-xl overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Agency Details</h2>
              
              {/* Areas Covered Section */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-violet-600" />
                  <h3 className="text-base font-semibold text-slate-800">Areas Covered</h3>
                </div>
                <div className="pl-6">
                  <Textarea
                    value={agency.geographic_patch || ''}
                    onChange={(e) => {
                      setAgency(prev => prev ? { ...prev, geographic_patch: e.target.value } : null)
                      setUnsavedChanges(true)
                    }}
                    placeholder="e.g., United Kingdom, Central London, Greater Manchester..."
                    className="w-full min-h-[80px] border border-violet-200/50 bg-white/70 text-slate-700 placeholder-violet-400/60 resize-none focus:outline-none focus:bg-white focus:border-violet-400 p-3 rounded-lg transition-all"
                    rows={3}
                  />
                  <p className="text-xs text-violet-600/60 mt-2">
                    List the geographic areas your agency serves
                  </p>
                </div>
              </div>
              
              {/* Contact Details Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="h-4 w-4 text-violet-600" />
                  <h3 className="text-base font-semibold text-slate-800">Contact Details</h3>
                </div>
                
                <div className="pl-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Mail className="inline h-3 w-3 mr-1 text-violet-500" />
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={agency.contact_email}
                      onChange={(e) => {
                        setAgency(prev => prev ? { ...prev, contact_email: e.target.value } : null)
                        setUnsavedChanges(true)
                      }}
                      className="border border-violet-200/50 bg-white/70 text-slate-700 placeholder-violet-400/60 p-3 rounded-lg focus:outline-none focus:bg-white focus:border-violet-400 transition-all"
                      placeholder="hello@agency.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Phone className="inline h-3 w-3 mr-1 text-violet-500" />
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={agency.contact_phone}
                      onChange={(e) => {
                        setAgency(prev => prev ? { ...prev, contact_phone: e.target.value } : null)
                        setUnsavedChanges(true)
                      }}
                      className="border border-violet-200/50 bg-white/70 text-slate-700 placeholder-violet-400/60 p-3 rounded-lg focus:outline-none focus:bg-white focus:border-violet-400 transition-all"
                      placeholder="+44 20 7xxx xxxx"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Globe className="inline h-3 w-3 mr-1 text-violet-500" />
                      Website
                    </label>
                    <Input
                      type="url"
                      value={agency.website || ''}
                      onChange={(e) => {
                        setAgency(prev => prev ? { ...prev, website: e.target.value } : null)
                        setUnsavedChanges(true)
                      }}
                      placeholder="https://agency.com"
                      className="border border-violet-200/50 bg-white/70 text-slate-700 placeholder-violet-400/60 p-3 rounded-lg focus:outline-none focus:bg-white focus:border-violet-400 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Building2 className="inline h-3 w-3 mr-1 text-violet-500" />
                      Office Address
                    </label>
                    <LocationSearch
                      value={agency.office_address || ''}
                      onChange={(value) => {
                        setAgency(prev => prev ? { ...prev, office_address: value } : null)
                        setUnsavedChanges(true)
                      }}
                      onLocationSelect={handleLocationSelect}
                      placeholder="Search for office address..."
                      className="border border-violet-200/50 bg-white/70 text-slate-700 placeholder-violet-400/60 rounded-lg focus:outline-none focus:bg-white focus:border-violet-400 transition-all"
                      hideIcon={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Agency Preview Modal - Shows live data from database */}
      <AgencyModal 
        agencyId={agency?.id || null}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  )
}