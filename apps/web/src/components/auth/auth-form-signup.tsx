'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { OAuthButtons } from './oauth-buttons'

interface AuthFormSignUpProps {
  returnUrl?: string
  onSwitchMode?: () => void
}

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
]

export function AuthFormSignUp({ returnUrl, onSwitchMode }: AuthFormSignUpProps) {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newsletterOptIn, setNewsletterOptIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordChecks = useMemo(() => {
    return passwordRequirements.map((req) => ({
      ...req,
      passed: req.test(password),
    }))
  }, [password])

  const isPasswordValid = passwordChecks.every((check) => check.passed)
  const isFormValid = email.trim() !== '' && isPasswordValid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    try {
      setError(null)
      setLoading(true)
      await signUp(email, password, returnUrl, newsletterOptIn)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to create account')
      console.error('Sign up error:', err)
    }
  }

  return (
    <div className="w-full max-w-[460px]">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[26px] font-[600] text-[#171419] font-inter mb-1.5">
          Create your account
        </h2>
        <p className="text-[14px] text-[#7C7588] font-inter">
          Free forever. Upgrade when you're ready.
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
            placeholder="you@company.co.uk"
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
              placeholder="Create a password"
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

          {/* Password Requirements */}
          {password && (
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {passwordChecks.map((check, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {check.passed ? (
                      <>
                        <circle cx="8" cy="8" r="8" fill="#10B981" />
                        <path
                          d="M11 6L7 10L5 8"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    ) : (
                      <circle cx="8" cy="8" r="8" fill="#E8E4DC" />
                    )}
                  </svg>
                  <span
                    className={`text-[11px] font-inter ${
                      check.passed ? 'text-[#10B981]' : 'text-[#7C7588]'
                    }`}
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Newsletter Checkbox */}
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="newsletter"
            checked={newsletterOptIn}
            onChange={(e) => setNewsletterOptIn(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#E8E4DC] text-[#7033FF] focus:ring-[#7033FF] focus:ring-offset-0"
            disabled={loading}
          />
          <label htmlFor="newsletter" className="text-[12px] text-[#4A4451] font-inter cursor-pointer leading-tight">
            Keep me in the loop. Send me product updates, market insights and the occasional newsletter.
          </label>
        </div>

        {/* Terms and Privacy */}
        <p className="text-[11px] text-[#7C7588] font-inter leading-[1.4]">
          By creating an account, you agree to our{' '}
          <a
            href="https://app.termly.io/policy-viewer/policy.html?policyUUID=0d60ea82-ecb7-43d4-bf2d-a3ea5a0900c6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5421CC] hover:text-[#7033FF] transition-colors"
          >
            Terms
          </a>{' '}
          and{' '}
          <a
            href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5421CC] hover:text-[#7033FF] transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>

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
              <span>Creating account...</span>
            </div>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      {/* OAuth Buttons */}
      <OAuthButtons redirectTo={returnUrl} mode="signup" />

      {/* Switch to Sign In */}
      <div className="text-center mt-3">
        <span className="text-[14px] text-[#4A4451] font-inter">
          Already have an account?{' '}
        </span>
        {onSwitchMode ? (
          <button
            type="button"
            onClick={onSwitchMode}
            className="text-[14px] font-[600] text-[#5421CC] hover:text-[#7033FF] transition-colors font-inter"
          >
            Sign in
          </button>
        ) : (
          <Link
            href={`/auth?mode=signin${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
            className="text-[14px] font-[600] text-[#5421CC] hover:text-[#7033FF] transition-colors font-inter"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  )
}
