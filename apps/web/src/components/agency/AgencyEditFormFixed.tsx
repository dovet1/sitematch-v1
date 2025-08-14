'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

// Import step components - reuse from creation wizard
import { BasicInfoStep } from './wizard-steps/BasicInfoStep'
import { LogoBrandingStep } from './wizard-steps/LogoBrandingStep'
import { CoverageSpecialismsStep } from './wizard-steps/CoverageSpecialismsStep'
import { TeamBuildingStep } from './wizard-steps/TeamBuildingStep'

// Import edit-specific components
import { EditModeHeader } from './EditModeHeader'
import { AutoSaveIndicator } from './AutoSaveIndicator'

interface AgencyData {
  id: string
  name: string
  description: string | null
  website: string | null
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  approved_at: string | null
}

interface AgentMember {
  user_id?: string
  email: string
  name: string
  phone: string
  role: 'admin' | 'member'
  coverage_area: string
  is_registered: boolean
  joined_at: string | null
  headshot_url: string | null
}

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

interface AgencyEditFormFixedProps {
  agency: AgencyData
  members: AgentMember[]
  currentUserId: string
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
    description: 'Manage team members',
    component: TeamBuildingStep
  }
]

export function AgencyEditFormFixed({ agency, members, currentUserId }: AgencyEditFormFixedProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<WizardData>(() => {
    // Pre-populate with existing agency data
    return {
      name: agency.name || '',
      description: agency.description || '',
      website: agency.website || '',
      logoFile: null,
      logoUrl: agency.logo_url || '',
      coverageAreas: agency.coverage_areas || '',
      specialisms: agency.specialisms || [],
      directAgents: members.filter(m => m.is_registered).map(member => ({
        email: member.email,
        name: member.name,
        phone: member.phone || '',
        role: member.role,
        coverageArea: member.coverage_area || '',
        headshotFile: null,
        headshotUrl: member.headshot_url || ''
      })),
      inviteAgents: members.filter(m => !m.is_registered).map(member => ({
        email: member.email,
        name: member.name,
        role: member.role
      }))
    }
  })

  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  
  const { toast } = useToast()
  const router = useRouter()

  // Handle data updates and mark as unsaved
  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)
    setErrors([])
  }, [])

  // Navigate between steps
  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex)
  }

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Manual save function
  const handleSave = async () => {
    setIsAutoSaving(true)
    try {
      const changes = {
        name: data.name,
        description: data.description,
        website: data.website,
        logo_url: data.logoUrl,
        coverage_areas: data.coverageAreas,
        specialisms: data.specialisms
      }

      const response = await fetch(`/api/agencies/${agency.id}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          changes,
          versionId: agency.id
        })
      })

      if (response.ok) {
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
        toast({
          title: "Changes Saved",
          description: "Your changes have been saved successfully.",
        })
      }
    } catch (error) {
      console.error('Save failed:', error)
      toast({
        title: "Save Failed",
        description: "There was an error saving your changes.",
        variant: "destructive",
      })
    } finally {
      setIsAutoSaving(false)
    }
  }

  // Handle form submission for review
  const handleSubmitForReview = async () => {
    setIsLoading(true)
    try {
      // First save current changes
      await handleSave()
      
      // Then submit for review
      const response = await fetch(`/api/agencies/${agency.id}/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: agency.id })
      })

      if (response.ok) {
        toast({
          title: "Submitted for Review",
          description: "Your changes have been submitted successfully. You'll be notified once reviewed.",
        })
        router.push('/agents/settings')
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for review')
      }
    } catch (error) {
      console.error('Submit for review failed:', error)
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle cancel/exit
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push('/agents/settings')
      }
    } else {
      router.push('/agents/settings')
    }
  }

  // Validation - separate check from error setting
  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case 0: // Basic Info
        return !!data.name.trim()
      case 1: // Logo & Branding
        return !!(data.logoUrl || data.logoFile)
      case 2: // Coverage & Specialisms
        return !!data.coverageAreas.trim() && data.specialisms.length > 0
      case 3: // Team Building
        return (data.directAgents.length > 0 || data.inviteAgents.length > 0)
      default:
        return true
    }
  }

  const validateCurrentStep = (): boolean => {
    const newErrors: string[] = []

    switch (currentStep) {
      case 0: // Basic Info
        if (!data.name.trim()) newErrors.push('Agency name is required')
        break
      case 1: // Logo & Branding
        if (!data.logoUrl && !data.logoFile) newErrors.push('Logo is required')
        break
      case 2: // Coverage & Specialisms
        if (!data.coverageAreas.trim()) newErrors.push('Coverage areas are required')
        if (data.specialisms.length === 0) newErrors.push('At least one specialism is required')
        break
      case 3: // Team Building
        if (data.directAgents.length === 0 && data.inviteAgents.length === 0) {
          newErrors.push('At least one team member is required')
        }
        break
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const canSubmitForReview = (): boolean => {
    return !!(
      data.name.trim() &&
      (data.logoUrl || data.logoFile) &&
      data.coverageAreas.trim() &&
      data.specialisms.length > 0 &&
      (data.directAgents.length > 0 || data.inviteAgents.length > 0)
    )
  }

  const CurrentStepComponent = STEPS[currentStep].component
  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Edit Mode Header */}
        <EditModeHeader 
          agencyName={agency.name}
          agencyStatus={agency.status}
          onCancel={handleCancel}
        />

        {/* Auto-save Indicator */}
        <div className="mb-6">
          <AutoSaveIndicator 
            lastSaved={lastSaved}
            isAutoSaving={isAutoSaving}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>

        {/* Status Banner */}
        {agency.status === 'approved' && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Your approved listing is live. Changes will require review before being published.
            </AlertDescription>
          </Alert>
        )}

        {agency.status === 'pending' && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Your agency is under review. You can still make changes.
            </AlertDescription>
          </Alert>
        )}

        {agency.status === 'rejected' && agency.admin_notes && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Address the feedback below:</strong> {agency.admin_notes}
            </AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Navigation */}
        <div className="mb-8">
          <div className="flex justify-between">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                className={`flex-1 text-center p-3 mx-1 rounded-lg transition-colors ${
                  index === currentStep
                    ? 'bg-violet-100 text-violet-800 border border-violet-300'
                    : index < currentStep
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}
              >
                <div className="font-semibold text-sm">{step.title}</div>
                <div className="text-xs mt-1">{step.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <CurrentStepComponent 
            data={data}
            updateData={updateData}
            errors={errors}
          />
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex space-x-3">
            <Button 
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isAutoSaving}
              variant="outline"
            >
              {isAutoSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>

            {currentStep === STEPS.length - 1 ? (
              <Button
                onClick={handleSubmitForReview}
                disabled={!canSubmitForReview() || isLoading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!isCurrentStepValid()}
                className="flex items-center bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}