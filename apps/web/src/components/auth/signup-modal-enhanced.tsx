'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Loader2, UserPlus, ChevronLeft, Check, Building2, Users, Wrench, Home, TreePine, Calculator, Globe, MoreHorizontal, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { UserType } from '@/types/auth'

interface SignUpFormData {
  email: string
  userType: UserType
}

interface SignUpModalProps {
  children: React.ReactNode
  redirectTo?: string
}

const userTypes: { value: UserType; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'Commercial Occupier', 
    label: 'Commercial Occupier', 
    description: 'Looking for office or retail space',
    icon: <Building2 className="h-4 w-4" />
  },
  { 
    value: 'Landlord/Vendor', 
    label: 'Landlord/Vendor', 
    description: 'Property owner or seller',
    icon: <Home className="h-4 w-4" />
  },
  { 
    value: 'Developer', 
    label: 'Developer', 
    description: 'Property developer',
    icon: <Wrench className="h-4 w-4" />
  },
  { 
    value: 'Housebuilder', 
    label: 'Housebuilder', 
    description: 'Residential developer',
    icon: <TreePine className="h-4 w-4" />
  },
  { 
    value: 'Consultant', 
    label: 'Consultant', 
    description: 'Property consultant or advisor',
    icon: <Calculator className="h-4 w-4" />
  },
  { 
    value: 'Government', 
    label: 'Government', 
    description: 'Government or public sector',
    icon: <Globe className="h-4 w-4" />
  },
  { 
    value: 'Other', 
    label: 'Other', 
    description: 'Other type of user',
    icon: <MoreHorizontal className="h-4 w-4" />
  },
]

export function SignUpModalEnhanced({ children, redirectTo }: SignUpModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  
  const { signIn } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors
  } = useForm<SignUpFormData>({
    defaultValues: {
      email: '',
      userType: undefined
    }
  })

  const selectedUserType = watch('userType')

  const onSubmitEmail = async (data: SignUpFormData) => {
    setEmail(data.email)
    setStep(2)
    setError(null)
  }

  const onSubmitUserType = async (data: SignUpFormData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('Attempting to sign in with:', { email, redirectTo, userType: data.userType })
      // Send magic link after both steps are complete with user_type in metadata
      await signIn(email, redirectTo, data.userType)
      console.log('Sign in successful, storing user type:', data.userType)
      // Store user type for when they complete signup (backup in case metadata doesn't work)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingUserType', data.userType)
      }
      setSuccess(true)
      reset()
    } catch (err) {
      console.error('Sign in error:', err)
      setError(`Database error saving new user: ${err instanceof Error ? err.message : 'An error occurred'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      reset()
      setError(null)
      setSuccess(false)
      setStep(1)
      setEmail('')
    }
  }

  const handleBack = () => {
    setStep(1)
    setError(null)
  }

  const selectedUserTypeData = userTypes.find(type => type.value === selectedUserType)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="z-[9998]" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[9999] grid w-full max-w-[500px] translate-x-[-50%] translate-y-[-50%] gap-6 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] violet-bloom-card"
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Account
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? (
              <>Enter your email to get started - we'll send you a magic link to complete registration</>
            ) : (
              <>Complete your profile to personalize your experience</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {success ? (
          <div className="text-center py-6" role="status" aria-live="polite">
            <div className="mb-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              We've sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <>
            {/* Enhanced Progress Indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    1
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-colors",
                    step >= 1 ? "text-primary" : "text-muted-foreground"
                  )}>
                    Email
                  </span>
                </div>
                <div className={cn(
                  "h-1 w-12 transition-colors mt-[-16px]",
                  step >= 2 ? "bg-primary" : "bg-muted"
                )} />
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    2
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-colors",
                    step >= 2 ? "text-primary" : "text-muted-foreground"
                  )}>
                    Profile
                  </span>
                </div>
              </div>
            </div>

            {step === 1 ? (
              <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    aria-label="Email address"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Please enter a valid email address'
                      }
                    })}
                    disabled={isLoading}
                    autoFocus
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500" role="alert">{errors.email.message}</p>
                  )}
                </div>
                
                {error && (
                  <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md" role="alert" aria-live="assertive">
                    {error}
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Continuing...</span>
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Navigation Header */}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <span className="text-sm text-muted-foreground">Step 2 of 2</span>
                </div>

                {/* Email Confirmation */}
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Creating account for: <strong>{email}</strong>
                  </p>
                </div>
                
                <form onSubmit={handleSubmit(onSubmitUserType)} className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="user-type-select" className="text-base font-medium">
                      Which best describes you?
                    </Label>
                    <Select
                      value={selectedUserType || ''}
                      onValueChange={(value) => {
                        setValue('userType', value as UserType)
                        if (errors.userType) {
                          clearErrors('userType')
                        }
                      }}
                    >
                      <SelectTrigger 
                        id="user-type-select"
                        className="w-full h-12"
                        aria-label="Select your user type"
                      >
                        <SelectValue placeholder="Choose your user type">
                          {selectedUserTypeData && (
                            <div className="flex items-center gap-2">
                              {selectedUserTypeData.icon}
                              <span>{selectedUserTypeData.label}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent 
                        className="z-[10000] max-h-[300px]" 
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={4}
                      >
                        {userTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="py-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {type.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{type.label}</span>
                                <span className="text-sm text-muted-foreground">{type.description}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.userType && (
                      <p className="text-sm text-red-500" role="alert">{errors.userType.message}</p>
                    )}
                  </div>
                  
                  {error && (
                    <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md" role="alert" aria-live="assertive">
                      {error}
                    </div>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={isLoading || !selectedUserType}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      'Complete Sign Up'
                    )}
                  </Button>
                </form>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center mt-4">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        )}
        <DialogPrimitive.Close className="absolute right-4 top-4 opacity-70 ring-offset-background transition-all duration-200 ease-in-out hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground violet-bloom-touch">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
    </Dialog>
  )
}