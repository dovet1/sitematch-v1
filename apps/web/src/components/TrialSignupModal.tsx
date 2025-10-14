'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Loader2, UserPlus, X, Lock, Zap, Star, LogIn } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { UserType } from '@/types/auth'

interface TrialSignupFormData {
  email: string
  password: string
  userType: UserType
  newsletterOptIn: boolean
}

interface TrialSignupModalProps {
  children: React.ReactNode
  context: 'search' | 'sitesketcher' | 'agency' | 'general'
  redirectPath?: string
  testimonial?: {
    quote: string
    author: string
    rating: number
  }
  forceOpen?: boolean
  onClose?: () => void
  onLoadingChange?: (loading: boolean) => void
}

const userTypes: { value: UserType; label: string }[] = [
  { value: 'Commercial Occupier', label: 'Commercial Occupier' },
  { value: 'Landlord/developer', label: 'Landlord/developer' },
  { value: 'Housebuilder', label: 'Housebuilder' },
  { value: 'Agent', label: 'Agent' },
  { value: 'Government', label: 'Government' },
  { value: 'Other', label: 'Other' },
]

const contextConfig = {
  search: {
    headline: 'Access 1000+ Property Requirements',
    subtext: 'Connect directly with qualified businesses actively seeking space',
    cta: 'Start Free Trial',
    testimonial: {
      quote: 'With SiteMatcher I can see the market in seconds. It\’s easily the fastest way I\’ve found to spot real opportunities.',
      author: 'Kerry Northfold, Director, Vedra Property',
      rating: 5
    }
  },
  sitesketcher: {
    headline: 'Access SiteSketcher Pro Tools',
    subtext: 'Advanced property assessment and visualization tools for commercial real estate professionals',
    cta: 'Start Free Trial - Access SiteSketcher',
    testimonial: {
      quote: 'SiteSketcher lets me draw a quick feasibility in minutes. It’s straightforward, simple, and saves a huge amount of time.',
      author: 'Harry Foreman, Partner, FMX Urban Property Advisory',
      rating: 5
    }
  },
  agency: {
    headline: 'Add your agency profile',
    subtext: "Connect your agency to your client's requirements",
    cta: 'Start Free Trial - Create Agency Profile',
    testimonial: {
      quote: "With SiteMatcher I can see the market in seconds. It\’s easily the fastest way I\’ve found to spot real opportunities.",
      author: 'Kerry Northfold, Director, Vedra Property',
      rating: 5
    }
  },
  general: {
    headline: 'Find matches for your site',
    subtext: 'Access professional tools and thousands of opportunities',
    cta: 'Start Free Trial - No Charge',
    testimonial: {
      quote: 'With SiteMatcher I can see the market in seconds. It\’s easily the fastest way I\’ve found to spot real opportunities.',
      author: 'Kerry Northfold, Director, Vedra Property',
      rating: 5
    }
  }
}

export function TrialSignupModal({ children, context, redirectPath, testimonial, forceOpen, onClose, onLoadingChange }: TrialSignupModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [loadingStage, setLoadingStage] = useState<'creating_account' | 'setting_up_trial' | 'redirecting'>('creating_account')

  const { signUp, signIn, user } = useAuth()
  const config = contextConfig[context]
  const displayTestimonial = testimonial || config.testimonial

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors
  } = useForm<TrialSignupFormData>({
    defaultValues: {
      email: '',
      password: '',
      userType: undefined,
      newsletterOptIn: false
    },
    mode: 'onChange'
  })

  const selectedUserType = watch('userType')

  // Note: Auto-checkout for logged-in users is now handled in the pricing components
  // This modal is primarily for non-logged-in users to sign up first

  const onSubmit = async (data: TrialSignupFormData) => {
    setIsLoading(true)
    setError(null)
    onLoadingChange?.(true)

    try {
      // Step 1: Create account or login
      setLoadingStage('creating_account')
      if (mode === 'signup') {
        // Pass 'SKIP_REDIRECT' to prevent automatic dashboard redirect
        await signUp(data.email, data.password, data.userType, 'SKIP_REDIRECT', data.newsletterOptIn)
      } else {
        // Pass 'SKIP_REDIRECT' to prevent automatic dashboard redirect
        await signIn(data.email, data.password, 'SKIP_REDIRECT')
      }

      // Step 2: Set up trial
      setLoadingStage('setting_up_trial')
      // Delay to ensure auth state is updated and show loading message
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create checkout session - the API will get userId from the session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType: context,
          redirectPath: redirectPath || '/search'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Checkout session error details:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      if (url) {
        // Step 3: Redirecting to checkout
        setLoadingStage('redirecting')
        // Show full-screen loading overlay to ensure user sees feedback
        document.body.style.overflow = 'hidden'
        const overlay = document.createElement('div')
        overlay.id = 'stripe-loading-overlay'
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
        `
        overlay.innerHTML = `
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
            <div style="font-size: 18px; font-weight: 500;">Redirecting to checkout...</div>
            <div style="font-size: 14px; opacity: 0.8; margin-top: 8px;">Please wait while we set up your trial</div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `
        document.body.appendChild(overlay)

        // Delay to show the redirecting message
        await new Promise(resolve => setTimeout(resolve, 1200))
        window.location.href = url
      } else {
        throw new Error('No checkout URL received')
      }

      // Don't reset or close - let the page redirect handle cleanup
    } catch (err) {
      console.error('Trial signup error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      onLoadingChange?.(false)
      // Clean up overlay if error occurs
      const overlay = document.getElementById('stripe-loading-overlay')
      if (overlay) {
        document.body.removeChild(overlay)
        document.body.style.overflow = 'auto'
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      reset()
      setError(null)
      setMode('signup')
      setLoadingStage('creating_account')
      onClose?.()
    }
  }

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'creating_account':
        return mode === 'signup' ? 'Creating account...' : 'Signing in...'
      case 'setting_up_trial':
        return 'Setting up your trial...'
      case 'redirecting':
        return 'Redirecting to checkout...'
      default:
        return 'Loading...'
    }
  }

  return (
    <Dialog open={forceOpen || open} onOpenChange={forceOpen ? (open: boolean) => !open && onClose?.() : handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 bg-white shadow-2xl !border-0 [&>button]:text-white [&>button]:hover:text-white/80">
          {/* Header */}
          <div className="relative px-4 pt-4 pb-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white">
            <DialogHeader className="space-y-2 text-center">
              <div className="mx-auto w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center mb-1">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-lg font-bold text-white">
                {mode === 'signup' ? config.headline : 'Welcome Back!'}
              </DialogTitle>
              {mode === 'signup' && (
                <DialogDescription className={`text-violet-100 text-sm max-w-md ${context === 'agency' ? 'text-left' : 'mx-auto'}`}>
                  {config.subtext}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Pricing highlight */}
            <div className="text-center mt-3 p-2 bg-white/10 backdrop-blur-sm rounded-lg">
              <div className="text-base font-semibold">
                <span className="line-through text-white/70">£975</span>{' '}
                <span className="text-white">£487.50/year</span> - 30 days free
              </div>
              <div className="text-xs text-violet-100">Add payment method, cancel anytime</div>
            </div>
          </div>

          <div className="px-4 py-4">
            {/* Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-violet-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                disabled={isLoading}
              >
                <UserPlus className="w-4 h-4 inline mr-1" />
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-violet-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                disabled={isLoading}
              >
                <LogIn className="w-4 h-4 inline mr-1" />
                Sign In
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Email and Password - Separate Lines */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="trial-email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="trial-email"
                    type="email"
                    placeholder="Enter your email address"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Please enter a valid email address'
                      }
                    })}
                    disabled={isLoading}
                    autoFocus
                    className="h-9"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trial-password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="trial-password"
                    type="password"
                    placeholder={mode === 'signup' ? "Create a secure password" : "Enter your password"}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: mode === 'signup' ? {
                        value: 8,
                        message: 'Password must be at least 8 characters'
                      } : undefined
                    })}
                    disabled={isLoading}
                    className="h-9"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">

                {mode === 'signup' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Professional role</Label>
                      <Select
                        onValueChange={(value: UserType) => {
                          setValue('userType', value);
                          clearErrors('userType');
                        }}
                        value={selectedUserType}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select your role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {userTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
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

                    {/* Newsletter Section */}
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 bg-violet-50/30 rounded-lg border border-violet-200/40">
                        <input
                          id="newsletter-opt-in"
                          type="checkbox"
                          {...register('newsletterOptIn')}
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
                  </>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200" role="alert">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {getLoadingMessage()}
                  </>
                ) : (
                  <>
                    {mode === 'signup' ? (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        {config.cta}
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                  </>
                )}
              </Button>
            </form>

            {/* Testimonial */}
            {displayTestimonial && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {displayTestimonial.author.split(' ')[0][0]}{displayTestimonial.author.split(' ')[1] ? displayTestimonial.author.split(' ')[1][0] : ''}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      {[...Array(displayTestimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                    <blockquote className="text-sm text-gray-700 italic">
                      "{displayTestimonial.quote}"
                    </blockquote>
                    <cite className="text-xs text-gray-500 mt-1 block">
                      - {displayTestimonial.author}
                    </cite>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center mt-3">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our{' '}
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=0d60ea82-ecb7-43d4-bf2d-a3ea5a0900c6" className="underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c" className="underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}