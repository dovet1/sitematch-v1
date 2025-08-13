'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, Image as ImageIcon, AlertCircle, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

interface WizardData {
  name: string
  description: string
  website: string
  logoFile: File | null
  logoUrl: string
  coverageAreas: string
  specialisms: string[]
  directAgents: Array<{
    email: string
    name: string
    phone: string
    role: 'admin' | 'member'
    headshotFile: File | null
    headshotUrl: string
  }>
  inviteAgents: Array<{
    email: string
    name: string
    role: 'admin' | 'member'
  }>
}

interface LogoBrandingStepProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
  errors: string[]
}

export function LogoBrandingStep({ data, updateData, errors }: LogoBrandingStepProps) {
  const [uploadError, setUploadError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)

  const getAgencyInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    // Validate file
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError('File size must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file')
      return
    }

    setUploadError('')
    setIsUploading(true)

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      
      // Store file and preview URL
      updateData({ 
        logoFile: file,
        logoUrl: previewUrl 
      })
      
    } catch (error) {
      console.error('Error handling file:', error)
      setUploadError('Error processing image')
    } finally {
      setIsUploading(false)
    }
  }, [updateData])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024 // 5MB
  })

  const removeLogo = () => {
    if (data.logoUrl && data.logoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(data.logoUrl)
    }
    updateData({ logoFile: null, logoUrl: '' })
    setUploadError('')
  }

  const hasLogo = data.logoFile || data.logoUrl

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Logo & Branding
        </h3>
        <p className="text-gray-600">
          Upload your agency logo or we'll create a beautiful placeholder with your initials.
        </p>
      </div>

      {/* Logo Upload Section */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-gray-700">
          Agency Logo
        </Label>

        {/* Upload Area */}
        {!hasLogo && (
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${isDragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                {isUploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              <div>
                <p className="text-base font-medium text-gray-900">
                  {isDragActive ? 'Drop your logo here' : 'Upload your agency logo'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Drag and drop, or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Supports PNG, JPG, GIF, WebP • Max 5MB
                </p>
              </div>

              <div className="flex justify-center">
                <Button type="button" variant="outline" size="sm" className="flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Logo Preview */}
        {hasLogo && (
          <div className="space-y-4">
            <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg border">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-white shadow-sm flex items-center justify-center">
                  {data.logoUrl ? (
                    <Image
                      src={data.logoUrl}
                      alt="Agency logo"
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-gray-400 font-medium">
                      {getAgencyInitials(data.name || 'Agency')}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Logo Preview</h4>
                <p className="text-sm text-gray-500 mt-1">
                  This is how your logo will appear on your agency profile
                </p>
                {data.logoFile && (
                  <div className="flex items-center mt-2 text-xs text-gray-400">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                    {data.logoFile.name} • {(data.logoFile.size / 1024).toFixed(1)}KB
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeLogo}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  removeLogo()
                  // This will trigger the upload area to show again
                }}
                className="flex items-center"
              >
                <Upload className="w-4 h-4 mr-2" />
                Change Logo
              </Button>
            </div>
          </div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Fallback Preview */}
        {!hasLogo && data.name && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {getAgencyInitials(data.name)}
                </span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">No logo? No problem!</h4>
                <p className="text-sm text-gray-600">
                  We'll create a beautiful placeholder with your agency initials
                </p>
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  )
}