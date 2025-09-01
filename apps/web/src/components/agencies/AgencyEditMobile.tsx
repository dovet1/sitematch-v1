'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImageUpload } from '@/components/ui/image-upload'
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
  Loader2,
  Upload,
  X,
  Save,
  Eye,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'
import { TeamManagement } from '@/components/agencies/team-management'
import { CompanyLinking } from '@/components/agencies/company-linking'
import { LocationSearch } from '@/components/search/LocationSearch'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
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

interface AgencyEditMobileProps {
  agency: Agency
  onUpdate: (field: string, value: string) => void
  onSave: () => Promise<void>
  onSubmit: () => Promise<void>
  onBack: () => void
  isSubmitting: boolean
  unsavedChanges: boolean
  showPreview: boolean
  onPreviewToggle: () => void
}

type TabType = 'info' | 'about' | 'contact' | 'areas' | 'team' | 'companies'

export function AgencyEditMobile({ 
  agency, 
  onUpdate, 
  onSave, 
  onSubmit, 
  onBack,
  isSubmitting, 
  unsavedChanges, 
  showPreview, 
  onPreviewToggle 
}: AgencyEditMobileProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info')

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
        return <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"><Edit className="h-3 w-3" />Draft</div>
      case 'pending':
        return <div className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium"><Clock className="h-3 w-3" />Pending</div>
      case 'approved':
        return <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium"><CheckCircle className="h-3 w-3" />Approved</div>
      case 'rejected':
        return <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium"><AlertTriangle className="h-3 w-3" />Rejected</div>
      default:
        return null
    }
  }

  const handleLogoUpload = async (file: File | null) => {
    if (!file) {
      onUpdate('logo_url', '')
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
      onUpdate('logo_url', result.file.url)
    } catch (err) {
      console.error('Logo upload error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo')
    }
  }

  const handleLocationSelect = (location: { name: string; coordinates: { lat: number; lng: number } }) => {
    onUpdate('office_address', location.name)
  }

  const tabs = [
    { id: 'info' as const, label: 'Info', icon: Building2 },
    { id: 'about' as const, label: 'About', icon: Edit },
    { id: 'contact' as const, label: 'Contact', icon: Mail },
    { id: 'areas' as const, label: 'Areas', icon: MapPin },
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'companies' as const, label: 'Companies', icon: Building2 },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Mobile Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-violet-200/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2 hover:bg-violet-50 rounded-full"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Edit Agency</h1>
              {getStatusBadge(getAgencyStatus(agency))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreviewToggle}
              className="p-2 hover:bg-violet-50 rounded-full"
            >
              <Eye className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
              onClick={onSave}
              disabled={!unsavedChanges || isSubmitting}
              size="sm"
              variant="outline"
              className={`${
                unsavedChanges 
                  ? 'border-violet-300 text-violet-700 hover:bg-violet-50' 
                  : 'border-slate-200 text-slate-400'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Unsaved Changes Warning */}
        {unsavedChanges && (
          <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">You have unsaved changes</p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                  activeTab === tab.id
                    ? 'text-violet-600 border-violet-600 bg-violet-50'
                    : 'text-gray-600 border-transparent hover:text-violet-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50/20">
        <div className="p-4 space-y-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Logo & Name */}
              <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="group relative">
                    {agency.logo_url ? (
                      <div className="w-16 h-16 rounded-xl bg-white border border-violet-200/60 p-2 flex items-center justify-center shadow-lg">
                        <Image
                          src={agency.logo_url}
                          alt={`${agency.name} logo`}
                          width={64}
                          height={64}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200/60 flex items-center justify-center shadow-lg">
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
                  
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Agency Name</label>
                    <Input
                      value={agency.name}
                      onChange={(e) => onUpdate('name', e.target.value)}
                      className="text-lg font-semibold border-violet-200/50 bg-white/70 focus:border-violet-400"
                      placeholder="Your Agency Name"
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Specialization</h3>
                <p className="text-sm text-slate-600 mb-3">We specialise in</p>
                <div className="space-y-2">
                  {['Commercial', 'Residential', 'Both'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onUpdate('classification', type)}
                      className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 text-left ${
                        agency.classification === type
                          ? 'bg-violet-100 border-violet-300 text-violet-800 font-medium'
                          : 'bg-white/70 border-violet-200/50 text-slate-600 hover:bg-violet-50'
                      }`}
                    >
                      {type === 'Both' ? 'Both Commercial & Residential' : `${type} Properties`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">About Your Agency</h3>
              <Textarea
                value={agency.description || ''}
                onChange={(e) => onUpdate('description', e.target.value)}
                placeholder="Describe your agency's unique value proposition, expertise, and what sets you apart..."
                className="w-full min-h-[200px] border-violet-200/50 bg-white/70 resize-none focus:border-violet-400"
                maxLength={500}
              />
              <div className="text-xs text-violet-400 text-right mt-2">
                {agency.description?.length || 0}/500 characters
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Mail className="inline h-4 w-4 mr-2 text-violet-500" />
                  Email Address
                </label>
                <Input
                  type="email"
                  value={agency.contact_email}
                  onChange={(e) => onUpdate('contact_email', e.target.value)}
                  className="border-violet-200/50 bg-white/70 focus:border-violet-400"
                  placeholder="hello@agency.com"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Phone className="inline h-4 w-4 mr-2 text-violet-500" />
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={agency.contact_phone}
                  onChange={(e) => onUpdate('contact_phone', e.target.value)}
                  className="border-violet-200/50 bg-white/70 focus:border-violet-400"
                  placeholder="+44 20 7xxx xxxx"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Globe className="inline h-4 w-4 mr-2 text-violet-500" />
                  Website
                </label>
                <Input
                  type="url"
                  value={agency.website || ''}
                  onChange={(e) => onUpdate('website', e.target.value)}
                  placeholder="https://agency.com"
                  className="border-violet-200/50 bg-white/70 focus:border-violet-400"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Building2 className="inline h-4 w-4 mr-2 text-violet-500" />
                  Office Address
                </label>
                <LocationSearch
                  value={agency.office_address || ''}
                  onChange={(value) => onUpdate('office_address', value)}
                  onLocationSelect={handleLocationSelect}
                  placeholder="Search for office address..."
                  className="border-violet-200/50 bg-white/70 focus:border-violet-400"
                  hideIcon={false}
                />
              </div>
            </div>
          )}

          {activeTab === 'areas' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Areas Covered</h3>
              <Textarea
                value={agency.geographic_patch || ''}
                onChange={(e) => onUpdate('geographic_patch', e.target.value)}
                placeholder="e.g., Central London, Greater Manchester, United Kingdom..."
                className="w-full min-h-[120px] border-violet-200/50 bg-white/70 resize-none focus:border-violet-400"
                rows={5}
              />
              <p className="text-xs text-violet-600/60 mt-2">
                List the geographic areas your agency serves
              </p>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
              <TeamManagement 
                agencyId={agency.id}
                initialTeamMembers={agency.agency_team_members || []}
              />
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-violet-200/40 p-6">
              <CompanyLinking agencyId={agency.id} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-white border-t border-violet-200/60 p-4">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || getAgencyStatus(agency) === 'pending' || unsavedChanges}
          className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white py-3 rounded-xl font-medium shadow-lg disabled:opacity-50"
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

      {/* Preview Modal */}
      <AgencyModal 
        agencyId={agency?.id || null}
        isOpen={showPreview}
        onClose={onPreviewToggle}
      />
    </div>
  )
}