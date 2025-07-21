'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Lock, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

interface ResetPasswordFormData {
  password: string
  confirmPassword: string
}

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasProcessedAuth, setHasProcessedAuth] = useState(false)
  const router = useRouter()
  const { updatePassword, user, loading, refresh } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetPasswordFormData>()

  useEffect(() => {
    const handlePasswordResetSession = async () => {
      console.log('Reset password page - Auth state:', { user: !!user, loading, userEmail: user?.email, hasProcessedAuth })
      
      // Check if we have a code parameter (successful verification)
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      console.log('URL has code parameter:', !!code)
      
      if (code && !hasProcessedAuth) {
        console.log('Found code parameter, waiting for Supabase session to establish')
        setHasProcessedAuth(true)
        
        // Supabase should have established a session during verification
        // Just wait longer and trust the process
        const waitForSession = async () => {
          for (let i = 0; i < 10; i++) {
            console.log(`Checking for session, attempt ${i + 1}/10`)
            await refresh()
            
            // Wait a bit between checks
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Check if we now have a user
            if (user) {
              console.log('Session found after waiting!')
              setError(null)
              break
            }
          }
          
          if (!user) {
            console.log('No session found after waiting')
            setError('Invalid reset link. Please request a new password reset.')
          }
        }
        
        waitForSession()
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }
      
      // Only process auth check once to avoid multiple token consumption
      if (!hasProcessedAuth) {
        // Give time for Supabase to establish session from URL
        const checkAuthWithDelay = setTimeout(() => {
          setHasProcessedAuth(true)
          if (!loading && !user) {
            console.log('No user found after extended wait')
            setError('Invalid reset link. Please request a new password reset.')
          } else if (!loading && user) {
            console.log('User found, clearing any errors')
            setError(null)
          }
        }, 2000) // Wait 2 seconds for auth to settle
        
        // If user is found immediately, clear timeout and error
        if (user) {
          clearTimeout(checkAuthWithDelay)
          setError(null)
          setHasProcessedAuth(true)
        }
        
        return () => clearTimeout(checkAuthWithDelay)
      }
    }
    
    if (typeof window !== 'undefined') {
      handlePasswordResetSession()
    }
  }, [user, loading, hasProcessedAuth])

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('Attempting password update, user state:', { user: !!user, email: user?.email })
      
      // Double-check we have a valid user session
      if (!user) {
        console.log('No user session found, refreshing auth state')
        await refresh()
        
        // Check again after refresh
        if (!user) {
          throw new Error('Auth session missing! Please try clicking the reset link again.')
        }
      }
      
      console.log('User session confirmed, updating password')
      await updatePassword(data.password)
      setSuccess(true)
      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/occupier/dashboard')
      }, 3000)
    } catch (err) {
      console.error('Password update failed:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="text-center pt-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Password Updated</h2>
            <p className="text-muted-foreground mb-4">
              Your password has been successfully updated. You'll be redirected to your dashboard shortly.
            </p>
            <Button onClick={() => router.push('/occupier/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Create New Password
          </CardTitle>
          <CardDescription>
            Enter your new password below. Make sure it's secure and memorable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a new password"
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
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters with uppercase, lowercase, and a number
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value, formValues) => 
                    value === formValues.password || 'Passwords do not match'
                })}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>
            
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}