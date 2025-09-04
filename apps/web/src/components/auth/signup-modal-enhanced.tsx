'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Loader2, UserPlus, ChevronLeft, Check, Building2, Users, Wrench, Home, TreePine, Calculator, Globe, MoreHorizontal, X, Lock } from 'lucide-react'
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
  password: string
  confirmPassword: string
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
  const [password, setPassword] = useState('')
  
  const { signUp } = useAuth()
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
      password: '',
      confirmPassword: '',
      userType: undefined
    }
  })

  const selectedUserType = watch('userType')

  const onSubmitStep1 = async (data: SignUpFormData) => {
    setEmail(data.email)
    setPassword(data.password)
    setStep(2)
    setError(null)
  }

  const onSubmitStep2 = async () => {
    if (!selectedUserType) {
      setError('Please select your user type')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      await signUp(email, password, selectedUserType, redirectTo)
      // User will be automatically signed in and redirected
      reset()
    } catch (err) {
      console.error('Sign up error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
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
      setPassword('')
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
        <DialogOverlay />
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Account
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? (
                <>Enter your email and create a password to get started</>
              ) : (
                <>Complete your profile to personalize your experience</>
              )}
            </DialogDescription>
          </DialogHeader>
          
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
                  Account
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
            <form onSubmit={handleSubmit(onSubmitStep1)} className="space-y-4">
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
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                      message: 'Password must contain uppercase, lowercase, and a number'
                    }
                  })}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-red-500" role="alert">{errors.password.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters with uppercase, lowercase, and a number
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value, formValues) => 
                      value === formValues.password || 'Passwords do not match'
                  })}
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500" role="alert">{errors.confirmPassword.message}</p>
                )}
              </div>
              
              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                Continue
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
                  Creating account for: <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); onSubmitStep2(); }} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="user-type" className="text-base font-medium">
                    Which best describes you?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This helps us personalize your experience
                  </p>
                  
                  {/* Dropdown Selection */}
                  <Select 
                    onValueChange={(value: UserType) => {
                      setValue('userType', value);
                      clearErrors('userType');
                    }}
                    value={selectedUserType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your role..." />
                    </SelectTrigger>
                    <SelectContent 
                      className="z-[10020]" 
                      position="popper"
                      sideOffset={4}
                    >
                      {userTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !selectedUserType}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      <span>Complete Sign Up</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            By creating an account, you agree to our{' '}
            <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=0d60ea82-ecb7-43d4-bf2d-a3ea5a0900c6" className="underline hover:text-primary">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c" className="underline hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}