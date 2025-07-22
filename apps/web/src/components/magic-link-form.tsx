'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'

interface MagicLinkFormData {
  email: string
}

interface MagicLinkFormProps {
  redirectTo?: string
  className?: string
}

export function MagicLinkForm({ redirectTo, className }: MagicLinkFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { signIn } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues
  } = useForm<MagicLinkFormData>()

  const onSubmit = async (data: MagicLinkFormData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      await signIn(data.email, redirectTo)
      setSuccess(true)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    const email = getValues('email')
    return (
      <div className="text-center py-6" role="status" aria-live="polite">
        <div className="mb-4">
          <Mail className="h-12 w-12 mx-auto text-green-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Check your email</h3>
        <p className="text-sm text-muted-foreground">
          We've sent a sign-in link to <strong>{email || 'your email'}</strong>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={className}>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email address</Label>
        <Input
          id="signin-email"
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
        />
        {errors.email && (
          <p className="text-sm text-red-500" role="alert">{errors.email.message}</p>
        )}
      </div>
      
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md mt-3" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      
      <Button type="submit" className="w-full mt-4" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Sending magic link...</span>
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            <span>Send Magic Link</span>
          </>
        )}
      </Button>
    </form>
  )
}