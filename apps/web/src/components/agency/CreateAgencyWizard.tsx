'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

// Import step components
import { BasicInfoStep } from './wizard-steps/BasicInfoStep'
import { LogoBrandingStep } from './wizard-steps/LogoBrandingStep'
import { CoverageSpecialismsStep } from './wizard-steps/CoverageSpecialismsStep'
import { TeamBuildingStep } from './wizard-steps/TeamBuildingStep'

interface WizardData {
  // Basic Info
  name: string
  description: string
  website: string
  
  // Logo & Branding
  logoFile: File | null
  logoUrl: string
  
  // Coverage & Specialisms
  coverageAreas: string
  specialisms: string[]
  
  // Team Building
  directAgents: {
    email: string
    name: string
    phone: string
    role: 'admin' | 'member'
    coverageArea: string
    headshotFile: File | null
    headshotUrl: string
  }[]
  inviteAgents: {
    email: string
    name: string
    role: 'admin' | 'member'
  }[]
}

const INITIAL_DATA: WizardData = {
  name: '',
  description: '',
  website: '',
  logoFile: null,
  logoUrl: '',
  coverageAreas: '',
  specialisms: [],
  directAgents: [],
  inviteAgents: []
}

const STEPS = [
  {
    id: 'basic-info',
    title: 'Basic Information',
    description: 'Agency name and description',
    component: BasicInfoStep
  },
  {
    id: 'logo-branding',
    title: 'Logo & Branding',
    description: 'Visual identity',
    component: LogoBrandingStep
  },
  {
    id: 'coverage-specialisms',
    title: 'Coverage & Specialisms',
    description: 'Areas and expertise',
    component: CoverageSpecialismsStep
  },
  {
    id: 'team-building',
    title: 'Team Building',
    description: 'Add team members',
    component: TeamBuildingStep
  }
]

const STORAGE_KEY = 'agency-wizard-draft'

export function CreateAgencyWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY)
    if (savedDraft) {
      try {
        const parsedData = JSON.parse(savedDraft)
        setData(parsedData)
        toast({
          title: 'Draft restored',
          description: 'Your previous work has been restored.',
        })
      } catch (error) {
        console.error('Error parsing saved draft:', error)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [toast])

  // Auto-save draft every 30 seconds and on data changes
  const saveDraft = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setLastSaved(new Date())
  }, [data])

  useEffect(() => {
    const timer = setInterval(saveDraft, 30000) // Auto-save every 30 seconds
    return () => clearInterval(timer)
  }, [saveDraft])

  useEffect(() => {
    // Save on data changes (debounced)
    const timer = setTimeout(saveDraft, 1000)
    return () => clearTimeout(timer)
  }, [data, saveDraft])

  const updateData = (updates: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const validateCurrentStep = (): string[] => {
    const stepErrors: string[] = []
    
    switch (currentStep) {
      case 0: // Basic Info
        if (!data.name.trim()) stepErrors.push('Agency name is required')
        if (data.name.trim().length < 2) stepErrors.push('Agency name must be at least 2 characters')
        if (data.name.trim().length > 100) stepErrors.push('Agency name must be less than 100 characters')
        if (data.description.length > 1000) stepErrors.push('Description must be less than 1000 characters')
        if (data.website && !isValidUrl(data.website)) stepErrors.push('Please enter a valid website URL')
        break
        
      case 1: // Logo & Branding
        // Logo is optional, no validation needed
        break
        
      case 2: // Coverage & Specialisms
        if (!data.coverageAreas.trim()) stepErrors.push('Coverage areas is required')
        if (data.coverageAreas.trim().length > 500) stepErrors.push('Coverage areas must be less than 500 characters')
        break
        
      case 3: // Team Building
        // Team building is optional
        const allEmails = [
          ...data.directAgents.map(a => a.email),
          ...data.inviteAgents.map(a => a.email)
        ]
        const duplicateEmails = allEmails.filter((email, index) => 
          allEmails.indexOf(email) !== index
        )
        if (duplicateEmails.length > 0) {
          stepErrors.push(`Duplicate email addresses found: ${duplicateEmails.join(', ')}`)
        }
        break
    }
    
    return stepErrors
  }

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const goToNext = () => {
    const stepErrors = validateCurrentStep()
    setErrors(stepErrors)
    
    if (stepErrors.length === 0) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
    } else {
      toast({
        title: 'Please fix the errors below',
        description: `${stepErrors.length} error${stepErrors.length > 1 ? 's' : ''} found`,
        variant: 'destructive',
      })
    }
  }

  const goToPrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setErrors([])
  }

  const submitAgency = async () => {
    const stepErrors = validateCurrentStep()
    setErrors(stepErrors)
    
    if (stepErrors.length > 0) {
      toast({
        title: 'Please fix the errors below',
        description: `${stepErrors.length} error${stepErrors.length > 1 ? 's' : ''} found`,
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      // Create agency first, then upload files
      const agencyResponse = await fetch('/api/agencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          website: data.website.trim() || undefined,
          logoUrl: data.logoUrl, // Will be filtered out if blob URL
          coverageAreas: data.coverageAreas.trim(),
          specialisms: data.specialisms,
          directAgents: data.directAgents.map(agent => ({
            email: agent.email,
            name: agent.name,
            phone: agent.phone,
            role: agent.role,
            coverageArea: agent.coverageArea,
            headshotUrl: agent.headshotUrl?.startsWith('blob:') ? null : agent.headshotUrl
          })),
          inviteAgents: data.inviteAgents
        }),
      })

      if (!agencyResponse.ok) {
        const errorData = await agencyResponse.json()
        throw new Error(errorData.error || 'Failed to create agency')
      }

      const result = await agencyResponse.json()
      const agencyId = result.data.agency.id

      console.log('Agency created, starting file uploads...', {
        hasLogoFile: !!data.logoFile,
        logoFileName: data.logoFile?.name,
        headshotFiles: data.directAgents.filter(a => a.headshotFile).map(a => ({ name: a.name, file: a.headshotFile?.name }))
      })

      // Upload logo if provided
      let logoUploaded = false
      if (data.logoFile) {
        try {
          const logoFormData = new FormData()
          logoFormData.append('file', data.logoFile)
          logoFormData.append('type', 'logo')
          logoFormData.append('agencyId', agencyId)
          
          const logoUploadResponse = await fetch('/api/agencies/upload', {
            method: 'POST',
            body: logoFormData,
          })
          
          if (logoUploadResponse.ok) {
            logoUploaded = true
            console.log('Logo uploaded successfully')
          } else {
            console.error('Failed to upload logo')
          }
        } catch (logoError) {
          console.error('Error uploading logo:', logoError)
          // Don't fail the whole process for logo upload errors
        }
      }

      // Upload headshots for direct agents
      let headshotsUploaded = 0
      const totalHeadshots = data.directAgents.filter(agent => agent.headshotFile).length
      
      for (const agent of data.directAgents) {
        if (agent.headshotFile) {
          try {
            const headshotFormData = new FormData()
            headshotFormData.append('file', agent.headshotFile)
            headshotFormData.append('type', 'headshot')
            headshotFormData.append('agencyId', agencyId)
            headshotFormData.append('agentEmail', agent.email)
            
            const headshotUploadResponse = await fetch('/api/agencies/upload', {
              method: 'POST',
              body: headshotFormData,
            })
            
            if (headshotUploadResponse.ok) {
              headshotsUploaded++
              console.log(`Headshot uploaded for ${agent.name}`)
            } else {
              console.error(`Failed to upload headshot for ${agent.name}`)
            }
          } catch (headshotError) {
            console.error(`Error uploading headshot for ${agent.name}:`, headshotError)
            // Don't fail the whole process for headshot upload errors
          }
        }
      }

      // Send invitations if any
      if (data.inviteAgents.length > 0) {
        try {
          await fetch('/api/agencies/invite', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agencyId: result.data.agency.id,
              invitations: data.inviteAgents
            }),
          })
        } catch (inviteError) {
          console.error('Error sending invitations:', inviteError)
          // Don't fail the whole process for invitation errors
        }
      }

      // Clear draft
      localStorage.removeItem(STORAGE_KEY)

      // Create success message with file upload info
      let description = 'Your agency is now pending approval. You\'ll receive an email once it\'s reviewed.'
      const uploadSummary = []
      
      if (logoUploaded) {
        uploadSummary.push('Logo uploaded')
      }
      if (headshotsUploaded > 0) {
        uploadSummary.push(`${headshotsUploaded}/${totalHeadshots} headshots uploaded`)
      }
      
      if (uploadSummary.length > 0) {
        description += ` ${uploadSummary.join(' • ')}.`
      }

      toast({
        title: 'Agency created successfully!',
        description,
      })

      // Redirect to success page or agency dashboard
      router.push(`/agents/dashboard?created=true&agency_id=${result.data.agency.id}`)

    } catch (error) {
      console.error('Error creating agency:', error)
      toast({
        title: 'Error creating agency',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100
  const CurrentStepComponent = STEPS[currentStep].component

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Premium Progress Header */}
        <div className="relative bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 sm:p-8 pb-4 sm:pb-6 border-b border-gray-100">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-40">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148, 163, 184) 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          
          {/* Content */}
          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Create Your Agency
                </h1>
                <p className="text-gray-600 mt-2 text-sm sm:text-base">
                  {STEPS[currentStep].title} • {STEPS[currentStep].description}
                </p>
              </div>
              {lastSaved && (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Auto-saved {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
        
            {/* Desktop Progress Stepper - Enhanced */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-4 gap-2">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="relative">
                    <div className="flex flex-col items-center">
                      {/* Step Circle */}
                      <div className={`
                        relative flex items-center justify-center w-12 h-12 rounded-2xl text-sm font-semibold
                        transition-all duration-300 transform mb-3 z-10
                        ${index < currentStep 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25' 
                          : index === currentStep 
                            ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-xl shadow-violet-500/30 scale-110' 
                            : 'bg-white border-2 border-gray-200 text-gray-400 hover:border-gray-300'
                        }
                      `}>
                        {index < currentStep ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <span className="text-base">{index + 1}</span>
                        )}
                        {index === currentStep && (
                          <div className="absolute inset-0 rounded-2xl animate-pulse bg-gradient-to-br from-violet-600/20 to-blue-600/20" />
                        )}
                      </div>
                      
                      {/* Step Text */}
                      <div className="text-center px-2">
                        <p className={`text-sm font-semibold transition-colors leading-tight ${
                          index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {step.title}
                        </p>
                        <p className={`text-xs mt-1 transition-colors leading-tight ${
                          index <= currentStep ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Connector Line */}
                    {index < STEPS.length - 1 && (
                      <div className="absolute top-6 left-[calc(50%+24px)] w-[calc(100%-24px)]">
                        <div className="h-0.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                            index < currentStep 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                              : ''
                          }`} style={{ width: index < currentStep ? '100%' : '0%' }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tablet Progress - Compact */}
            <div className="hidden sm:block lg:hidden">
              <div className="flex items-center gap-3">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-xl text-sm font-semibold
                      transition-all duration-300
                      ${index < currentStep 
                        ? 'bg-green-500 text-white' 
                        : index === currentStep 
                          ? 'bg-violet-600 text-white shadow-lg' 
                          : 'bg-gray-100 text-gray-400'
                      }
                    `}>
                      {index < currentStep ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`w-12 h-0.5 mx-2 ${
                        index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{STEPS[currentStep].title}</p>
                </div>
              </div>
            </div>

            {/* Mobile Progress - Enhanced */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900">
                  Step {currentStep + 1} of {STEPS.length}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {Math.round(progressPercentage)}% Complete
                </span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Messages - Enhanced */}
        {errors.length > 0 && (
          <div className="p-4 sm:p-6 border-b border-gray-100 bg-red-50/50">
            <Alert className="border-red-200 bg-white/90 backdrop-blur">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <AlertDescription className="flex-1">
                  <div className="font-semibold text-red-900 mb-2">Please fix the following errors:</div>
                  <ul className="space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </div>
            </Alert>
          </div>
        )}

        {/* Step Content - Enhanced */}
        <div className="p-6 sm:p-8 min-h-[400px] bg-gradient-to-b from-white to-gray-50/50">
          <CurrentStepComponent 
            data={data}
            updateData={updateData}
            errors={errors}
          />
        </div>

        {/* Navigation - Premium */}
        <div className="p-4 sm:p-6 lg:p-8 border-t border-gray-100 bg-gradient-to-b from-gray-50 to-white">
          {/* Mobile Navigation - Fixed Bottom Style */}
          <div className="sm:hidden">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goToPrevious}
                disabled={currentStep === 0 || isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 hover:bg-gray-50 transition-all duration-200 rounded-xl font-medium text-gray-700 disabled:opacity-50"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-base">Back</span>
              </Button>
              
              {currentStep === STEPS.length - 1 ? (
                <Button
                  onClick={submitAgency}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-base">Creating...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">Complete</span>
                      <CheckCircle2 className="w-5 h-5" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={goToNext}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200"
                >
                  <span className="text-base">Next</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              )}
            </div>
            
            {/* Skip option for mobile on team step */}
            {currentStep === 3 && data.directAgents.length === 0 && data.inviteAgents.length === 0 && (
              <Button
                variant="ghost"
                onClick={goToNext}
                disabled={isLoading}
                className="w-full mt-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 rounded-xl font-medium"
              >
                Skip Team Setup
              </Button>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex sm:justify-between">
            <Button
              variant="outline"
              onClick={goToPrevious}
              disabled={currentStep === 0 || isLoading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 border-gray-200 hover:bg-gray-50 transition-all duration-200 rounded-xl font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            <div className="flex gap-3">
              {/* Skip button for optional steps */}
              {currentStep === 3 && data.directAgents.length === 0 && data.inviteAgents.length === 0 && (
                <Button
                  variant="ghost"
                  onClick={goToNext}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 rounded-xl font-medium"
                >
                  Skip Team Setup
                </Button>
              )}
              
              {currentStep === STEPS.length - 1 ? (
                <Button
                  onClick={submitAgency}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 min-w-[140px] px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-200 transform hover:scale-105"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Agency</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={goToNext}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 min-w-[120px] px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-200 transform hover:scale-105"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}