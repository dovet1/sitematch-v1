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
        if (data.specialisms.length === 0) stepErrors.push('At least one specialism is required')
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
    <div className="max-w-2xl mx-auto">
      {/* Progress Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Step {currentStep + 1} of {STEPS.length}
          </h2>
          {lastSaved && (
            <div className="text-sm text-gray-500">
              Draft saved {lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>
        
        {/* Desktop Progress Indicator */}
        <div className="hidden sm:flex justify-between items-center mb-4">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${index < currentStep 
                  ? 'bg-green-100 text-green-600' 
                  : index === currentStep 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-400'
                }
              `}>
                {index < currentStep ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step.title}
                </p>
                <p className={`text-xs ${
                  index <= currentStep ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {step.description}
                </p>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  index < currentStep ? 'bg-green-200' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Mobile Progress Bar */}
        <div className="sm:hidden">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{STEPS[currentStep].title}</span>
            <span>{currentStep + 1} of {STEPS.length}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="p-6 border-b border-gray-200">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">Please fix the following errors:</div>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6 min-h-[400px]">
        <CurrentStepComponent 
          data={data}
          updateData={updateData}
          errors={errors}
        />
      </div>

      {/* Navigation */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentStep === 0 || isLoading}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={submitAgency}
              disabled={isLoading}
              className="flex items-center min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Agency
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goToNext}
              disabled={isLoading}
              className="flex items-center"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}