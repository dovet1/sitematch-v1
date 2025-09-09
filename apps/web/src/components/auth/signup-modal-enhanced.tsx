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
  userType: UserType
  newsletter: boolean
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
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
      userType: undefined,
      newsletter: false
    }
  })

  const selectedUserType = watch('userType')
  const newsletter = watch('newsletter')

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true)
    setError(null)
    
    console.log('Form data being submitted:', {
      email: data.email,
      userType: data.userType,
      newsletter: data.newsletter,
      newsletterType: typeof data.newsletter
    })
    
    try {
      await signUp(data.email, data.password, data.userType, redirectTo, data.newsletter)
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
    }
  }

  const selectedUserTypeData = userTypes.find(type => type.value === selectedUserType)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent 
          className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto p-0 bg-gradient-to-br from-white via-violet-50/20 to-white border-0 shadow-2xl [&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:z-50 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-xl [&>button]:bg-white/10 [&>button]:backdrop-blur-sm [&>button]:border [&>button]:border-white/20 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:hover:border-white/30 [&>button]:transition-all [&>button]:duration-200 [&>button]:flex [&>button]:items-center [&>button]:justify-center"
        >
          {/* Premium Header with Violet Bloom Gradient */}
          <div className="relative px-8 pt-8 pb-6 bg-gradient-to-r from-violet-900 via-purple-800 to-violet-900 text-white overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/30 via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/25 via-transparent to-transparent opacity-60" />
            <div className="relative">
              <DialogHeader className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  Create your account
                </DialogTitle>
                <DialogDescription className="text-slate-200 text-base leading-relaxed max-w-md mx-auto">
                  Join SiteMatcher to access site requirements, create listings and use our tools
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          
          <div className="px-6 py-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Account Details Section */}
              <div className="space-y-4">
              
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium text-slate-700">Email address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email address"
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
                    className="h-10 px-3 bg-white border-violet-200/60 rounded-lg focus:border-violet-400/60 focus:ring-1 focus:ring-violet-100/60 transition-colors"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-slate-700">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a secure password"
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
                    className="h-10 px-3 bg-white border-violet-200/60 rounded-lg focus:border-violet-400/60 focus:ring-1 focus:ring-violet-100/60 transition-colors"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              
                <p className="text-xs text-slate-500">
                  Must be 8+ characters with uppercase, lowercase, and a number
                </p>
              </div>

              {/* Profile Section */}
              <div className="space-y-3">
              
                <div className="space-y-2">
                  <Label htmlFor="user-type" className="text-sm font-medium text-slate-700">
                    Professional role
                  </Label>
                  
                  <Select 
                    onValueChange={(value: UserType) => {
                      setValue('userType', value);
                      clearErrors('userType');
                    }}
                    value={selectedUserType}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border-violet-200/60 rounded-lg focus:border-violet-400/60 focus:ring-1 focus:ring-violet-100/60 transition-colors">
                      <SelectValue placeholder="Select your role..." />
                    </SelectTrigger>
                    <SelectContent className="z-[10020]">
                      {userTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {errors.userType && (
                    <p className="text-sm text-red-500" role="alert">
                      {errors.userType.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Newsletter Section */}
              <div className="space-y-3">
                
                <div className="flex items-start space-x-3 p-3 bg-violet-50/30 rounded-lg border border-violet-200/40">
                  <input
                    id="newsletter-opt-in"
                    type="checkbox"
                    {...register('newsletter')}
                    disabled={isLoading}
                    className="mt-0.5 h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500/20 focus:ring-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="newsletter-opt-in" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Send me the newest site requirements, market insights and partner offers
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Unsubscribe at anytime
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200" role="alert">
                  {error}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium rounded-lg transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create account
                  </>
                )}
              </Button>
            </form>

            
            <p className="text-xs text-slate-500 text-center mt-4 -mb-1">
              By creating an account, you agree to our{' '}
              <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=0d60ea82-ecb7-43d4-bf2d-a3ea5a0900c6" className="text-violet-600 hover:text-violet-700">
                Terms
              </a>{' '}
              and{' '}
              <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c" className="text-violet-600 hover:text-violet-700">
                Privacy Policy
              </a>
            </p>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}