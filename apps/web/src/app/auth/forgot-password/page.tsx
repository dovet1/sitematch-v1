'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setError(null)
      setLoading(true)
      await resetPassword(email)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
      console.error('Reset password error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFAF7] flex items-center justify-center p-6">
      <div className="w-full max-w-[460px]">
        {/* Card */}
        <div className="bg-white rounded-[16px] border border-[#EFEBE2] p-8 lg:p-12">
          {/* Back Link */}
          <Link
            href="/auth?mode=signin"
            className="inline-flex items-center gap-2 text-[13px] font-[500] text-[#5421CC] hover:text-[#7033FF] transition-colors font-inter mb-6"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to sign in
          </Link>

          {!success ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-[28px] font-[600] text-[#171419] font-inter mb-2">
                  Reset your password
                </h1>
                <p className="text-[15px] text-[#7C7588] font-inter">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Email Field */}
                <div className="flex flex-col gap-[7px]">
                  <label htmlFor="email" className="text-[13px] font-[500] text-[#171419] font-inter">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-[46px] px-[14px] bg-white border border-[#E8E4DC] rounded-[10px] text-[15px] text-[#171419] placeholder:text-[#7C7588] font-inter focus:outline-none focus:ring-2 focus:ring-[#7033FF] focus:border-transparent transition-all"
                    disabled={loading}
                    required
                    autoFocus
                  />
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
                  disabled={!email.trim() || loading}
                  className="h-[50px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#7033FF]"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="flex flex-col items-center text-center">
                {/* Success Icon */}
                <div className="w-16 h-16 bg-[#EEE9FF] rounded-full flex items-center justify-center mb-6">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M26 10L13 23L7 17"
                      stroke="#7033FF"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Success Message */}
                <h2 className="text-[24px] font-[600] text-[#171419] font-inter mb-3">
                  Check your email
                </h2>
                <p className="text-[15px] text-[#7C7588] font-inter mb-2">
                  We've sent a password reset link to:
                </p>
                <p className="text-[15px] font-[600] text-[#171419] font-inter mb-6">
                  {email}
                </p>
                <p className="text-[14px] text-[#7C7588] font-inter mb-8">
                  If you don't see the email, check your spam folder or try again.
                </p>

                {/* Action Button */}
                <Link
                  href="/auth?mode=signin"
                  className="w-full h-[50px] flex items-center justify-center bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors"
                >
                  Return to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Help Text */}
        {!success && (
          <p className="text-center text-[13px] text-[#7C7588] font-inter mt-6">
            Remember your password?{' '}
            <Link
              href="/auth?mode=signin"
              className="text-[#5421CC] hover:text-[#7033FF] transition-colors font-[500]"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
