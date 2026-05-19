'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { OAuthButtons } from './oauth-buttons'

interface AuthFormSignInProps {
  returnUrl?: string
  onSwitchMode?: () => void
}

export function AuthFormSignIn({ returnUrl, onSwitchMode }: AuthFormSignInProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    try {
      setError(null)
      setLoading(true)
      await signIn(email, password, returnUrl)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to sign in')
      console.error('Sign in error:', err)
    }
  }

  return (
    <div className="w-full max-w-[460px]">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[26px] font-[600] text-[#171419] font-inter mb-1.5">
          Sign in
        </h2>
        <p className="text-[14px] text-[#7C7588] font-inter">
          Enter your details to access your account.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* Email Field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[13px] font-[500] text-[#171419] font-inter">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-[42px] px-[14px] bg-white border border-[#E8E4DC] rounded-[10px] text-[14px] text-[#171419] placeholder:text-[#7C7588] font-inter focus:outline-none focus:ring-2 focus:ring-[#7033FF] focus:border-transparent transition-all"
            disabled={loading}
            required
          />
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[13px] font-[500] text-[#171419] font-inter">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-[42px] px-[14px] pr-12 bg-white border border-[#E8E4DC] rounded-[10px] text-[14px] text-[#171419] placeholder:text-[#7C7588] font-inter focus:outline-none focus:ring-2 focus:ring-[#7033FF] focus:border-transparent transition-all"
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C7588] hover:text-[#171419] transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 10C2.5 10 5 4.5 10 4.5C15 4.5 17.5 10 17.5 10C17.5 10 15 15.5 10 15.5C5 15.5 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 12C11.1046 12 12 11.1046 12 10C12 8.89543 11.1046 8 10 8C8.89543 8 8 8.89543 8 10C8 11.1046 8.89543 12 10 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 10C2.5 10 5 4.5 10 4.5C15 4.5 17.5 10 17.5 10C17.5 10 15 15.5 10 15.5C5 15.5 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 12C11.1046 12 12 11.1046 12 10C12 8.89543 11.1046 8 10 8C8.89543 8 8 8.89543 8 10C8 11.1046 8.89543 12 10 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Forgot Password Link */}
        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-[13px] font-[500] text-[#5421CC] hover:text-[#7033FF] transition-colors font-inter"
          >
            Forgot password?
          </Link>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-[10px]">
            <p className="text-[13px] text-red-700 font-inter">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || loading}
          className="h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#7033FF]"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* OAuth Buttons */}
      <OAuthButtons redirectTo={returnUrl} mode="signin" />

      {/* Switch to Sign Up */}
      <div className="text-center mt-3">
        <span className="text-[14px] text-[#4A4451] font-inter">
          New to SiteMatcher?{' '}
        </span>
        {onSwitchMode ? (
          <button
            type="button"
            onClick={onSwitchMode}
            className="text-[14px] font-[600] text-[#5421CC] hover:text-[#7033FF] transition-colors font-inter"
          >
            Create an account
          </button>
        ) : (
          <Link
            href={`/auth?mode=signup${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
            className="text-[14px] font-[600] text-[#5421CC] hover:text-[#7033FF] transition-colors font-inter"
          >
            Create an account
          </Link>
        )}
      </div>
    </div>
  )
}
