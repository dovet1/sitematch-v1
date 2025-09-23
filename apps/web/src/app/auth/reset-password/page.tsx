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
    const handlePasswordReset = async () => {
      const { createClientClient } = await import('@/lib/supabase')
      const supabase = createClientClient()

      try {
        // Handle the auth callback (this processes URL fragments and tokens)
        const { data, error } = await supabase.auth.getSession()

        console.log('Session check result:', {
          hasSession: !!data.session,
          hasUser: !!data.session?.user,
          error: error?.message
        })

        console.log('Environment info:', {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          currentUrl: window.location.href,
          fullParams: window.location.search,
          fullHash: window.location.hash
        })

        if (data.session?.user) {
          console.log('✅ Valid session found, user can reset password')
          setError(null)
        } else {
          // Try to get URL parameters
          const urlParams = new URLSearchParams(window.location.search)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))

          const accessToken = urlParams.get('access_token') || hashParams.get('access_token')
          const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token')
          const type = urlParams.get('type') || hashParams.get('type')

          console.log('URL parameters:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type })

          if (accessToken && type === 'recovery') {
            console.log('Found recovery tokens, setting session...')
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            })

            if (sessionError) {
              console.error('Error setting session:', sessionError)
              setError(`Reset link error: ${sessionError.message}. This may be due to environment mismatch or expired token.`)
            } else {
              console.log('✅ Session set successfully')
              setError(null)
            }
          } else {
            console.log('❌ No valid session or recovery tokens found')
            setError('Invalid reset link. Please request a new password reset from this environment.')
          }
        }
      } catch (err) {
        console.error('Error in password reset flow:', err)
        setError('Invalid reset link. Please request a new password reset.')
      }
    }

    if (typeof window !== 'undefined') {
      handlePasswordReset()
    }
  }, [])

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Direct Supabase call - just like the working test page
      const { createClientClient } = await import('@/lib/supabase')
      const supabase = createClientClient()
      
      console.log('Updating password directly with Supabase...')
      const { error } = await supabase.auth.updateUser({
        password: data.password
      })
      
      if (error) {
        throw error
      }
      
      console.log('✅ Password updated successfully!')
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