'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Loader2, Lock, X } from 'lucide-react'
import { ForgotPasswordModal } from './forgot-password-modal'
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
import { useAuth } from '@/contexts/auth-context'

interface LoginFormData {
  email: string
  password: string
}

interface LoginModalProps {
  children: React.ReactNode
  redirectTo?: string
}

export function LoginModal({ children, redirectTo }: LoginModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  
  const { signIn } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginFormData>()

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      await signIn(data.email, data.password, redirectTo)
      // No need to show success as user will be redirected
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent 
          className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto p-0 bg-gradient-to-br from-white via-violet-50/20 to-white !border-0 !outline-0 !ring-0 shadow-2xl [&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:z-50 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-xl [&>button]:bg-white/10 [&>button]:backdrop-blur-sm [&>button]:border [&>button]:border-white/20 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:hover:border-white/30 [&>button]:transition-all [&>button]:duration-200 [&>button]:flex [&>button]:items-center [&>button]:justify-center"
        >
          {/* Premium Header with Violet Bloom Gradient */}
          <div className="relative px-8 pt-8 pb-6 bg-gradient-to-r from-violet-900 via-purple-800 to-violet-900 text-white overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/30 via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/25 via-transparent to-transparent opacity-60" />
            <div className="relative">
              <DialogHeader className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  Welcome back
                </DialogTitle>
                <DialogDescription className="text-slate-200 text-base leading-relaxed max-w-md mx-auto">
                  Sign in to access your SiteMatcher dashboard, site requirements and our tools
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          
          <div className="px-6 py-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</Label>
                <Input
                  id="email"
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
                  className="h-10 px-3 bg-white border-violet-200/60 rounded-lg focus:border-violet-400/60 focus:ring-1 focus:ring-violet-100/60 transition-colors"
                />
                {errors.email && (
                  <p className="text-sm text-red-500" role="alert">{errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  {...register('password', {
                    required: 'Password is required'
                  })}
                  disabled={isLoading}
                  className="h-10 px-3 bg-white border-violet-200/60 rounded-lg focus:border-violet-400/60 focus:ring-1 focus:ring-violet-100/60 transition-colors"
                />
                {errors.password && (
                  <p className="text-sm text-red-500" role="alert">{errors.password.message}</p>
                )}
              </div>
              
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-violet-600 hover:text-violet-700 p-0 h-auto font-normal"
                  onClick={() => {
                    setOpen(false)
                    setForgotPasswordOpen(true)
                  }}
                >
                  Forgot password?
                </Button>
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
                    Signing in...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
            
            <p className="text-xs text-slate-500 text-center mt-4 -mb-1">
              By signing in, you agree to our{' '}
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
      
      <ForgotPasswordModal 
        open={forgotPasswordOpen} 
        onOpenChange={setForgotPasswordOpen}
      />
    </Dialog>
  )
}