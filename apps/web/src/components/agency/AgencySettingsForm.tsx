'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'

interface AgencyData {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
}

interface AgencySettingsFormProps {
  agency: AgencyData
}

const PROPERTY_SPECIALISMS = [
  'Residential Sales',
  'Residential Lettings',
  'Commercial Sales', 
  'Commercial Lettings',
  'Land & New Homes',
  'Luxury Properties',
  'Investment Properties',
  'Property Management',
  'Auction Properties',
  'International Properties'
]

export function AgencySettingsForm({ agency }: AgencySettingsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: agency.name,
    coverageAreas: agency.coverage_areas,
    specialisms: agency.specialisms,
    logoFile: null as File | null,
    logoUrl: agency.logo_url || ''
  })

  const logoInputRef = useRef<HTMLInputElement>(null)

  const onLogoDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setFormData(prev => ({
        ...prev,
        logoFile: file,
        logoUrl: URL.createObjectURL(file)
      }))
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onLogoDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024 // 5MB
  })

  const removeLogo = () => {
    setFormData(prev => ({
      ...prev,
      logoFile: null,
      logoUrl: ''
    }))
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const toggleSpecialism = (specialism: string) => {
    setFormData(prev => ({
      ...prev,
      specialisms: prev.specialisms.includes(specialism)
        ? prev.specialisms.filter(s => s !== specialism)
        : [...prev.specialisms, specialism]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Agency name is required' })
      return
    }

    if (!formData.coverageAreas.trim()) {
      setMessage({ type: 'error', text: 'Coverage areas are required' })
      return
    }

    if (formData.specialisms.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one specialism' })
      return
    }

    setIsSubmitting(true)

    try {
      // Prepare form data for submission
      const submitFormData = new FormData()
      submitFormData.append('name', formData.name.trim())
      submitFormData.append('coverageAreas', formData.coverageAreas.trim())
      submitFormData.append('specialisms', JSON.stringify(formData.specialisms))
      
      if (formData.logoFile) {
        submitFormData.append('logoFile', formData.logoFile)
      }

      const response = await fetch(`/api/agencies/${agency.id}`, {
        method: 'PUT',
        body: submitFormData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update agency')
      }

      setMessage({ 
        type: 'success', 
        text: 'Agency settings updated successfully!' 
      })

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Error updating agency:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update agency settings' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function getAgencyInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="agencyName" className="text-sm font-medium">
              Agency Name *
            </Label>
            <Input
              id="agencyName"
              placeholder="Enter your agency name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isSubmitting}
              className="mt-1"
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="coverageAreas" className="text-sm font-medium">
              Coverage Areas *
            </Label>
            <Textarea
              id="coverageAreas"
              placeholder="e.g., London, Surrey, Sussex, Hampshire..."
              value={formData.coverageAreas}
              onChange={(e) => setFormData(prev => ({ ...prev, coverageAreas: e.target.value }))}
              disabled={isSubmitting}
              className="mt-1 min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              Specify the regions, cities, or areas your agency covers
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logo & Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Agency Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-6">
              {/* Logo Preview */}
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-white shadow-lg">
                {formData.logoUrl ? (
                  <Image
                    src={formData.logoUrl}
                    alt="Agency logo"
                    width={96}
                    height={96}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-white font-bold text-2xl">
                    {getAgencyInitials(formData.name || 'Agency')}
                  </span>
                )}
              </div>

              {/* Upload Area */}
              <div className="flex-1">
                {!formData.logoUrl ? (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                      ${isDragActive 
                        ? 'border-blue-400 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                  >
                    <input {...getInputProps()} ref={logoInputRef} />
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      {isDragActive ? 'Drop your logo here...' : 'Drag & drop your logo, or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          {formData.logoFile ? formData.logoFile.name : 'Current logo'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeLogo}
                        disabled={isSubmitting}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Change Logo
                    </Button>
                    <input
                      type="file"
                      ref={logoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          onLogoDrop([e.target.files[0]])
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specialisms */}
      <Card>
        <CardHeader>
          <CardTitle>Property Specialisms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Select all the property types and services your agency specializes in
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PROPERTY_SPECIALISMS.map((specialism) => (
              <button
                key={specialism}
                type="button"
                onClick={() => toggleSpecialism(specialism)}
                disabled={isSubmitting}
                className={`p-3 text-left border rounded-lg transition-all text-sm
                  ${formData.specialisms.includes(specialism)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
              >
                {specialism}
              </button>
            ))}
          </div>
          {formData.specialisms.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Selected specialisms:</p>
              <div className="flex flex-wrap gap-2">
                {formData.specialisms.map((specialism) => (
                  <Badge key={specialism} variant="secondary" className="text-xs">
                    {specialism}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
          disabled={isSubmitting}
        >
          Reset Changes
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          {isSubmitting ? 'Updating...' : 'Update Agency'}
        </Button>
      </div>
    </form>
  )
}