'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'

interface OAuthButtonsProps {
  redirectTo?: string
  mode?: 'signin' | 'signup'
}

export function OAuthButtons({ redirectTo }: OAuthButtonsProps) {
  const { signUpWithOAuth } = useAuth()
  const [loadingProvider, setLoadingProvider] = useState<'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOAuthSignIn = async (provider: 'google') => {
    try {
      setError(null)
      setLoadingProvider(provider)

      // Debug logging
      console.log('=== OAuth Debug Info ===')
      console.log('Provider:', provider)
      console.log('window.location.origin:', window.location.origin)
      console.log('NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL)
      console.log('redirectTo param:', redirectTo)

      await signUpWithOAuth(provider, redirectTo)
    } catch (err) {
      setLoadingProvider(null)
      setError(err instanceof Error ? err.message : 'Failed to sign in with OAuth')
      console.error('OAuth sign in error:', err)
    }
  }

  return (
    <div className="w-full">
      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#EFEBE2]"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 bg-white text-[13px] text-[#7C7588] font-inter uppercase">
            Or continue with
          </span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-1 gap-3">
        {/* Google Button */}
        <button
          type="button"
          onClick={() => handleOAuthSignIn('google')}
          disabled={loadingProvider !== null}
          className="w-full h-[40px] flex items-center justify-center gap-2 px-3 bg-white border border-[#E8E4DC] rounded-[10px] hover:border-[#7033FF] hover:bg-[#FBFAF7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingProvider === 'google' ? (
            <div className="w-5 h-5 border-2 border-[#7033FF] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.1712 8.36788H17.4998V8.33325H9.99984V11.6666H14.7095C14.0225 13.6069 12.1762 14.9999 9.99984 14.9999C7.23859 14.9999 4.99984 12.7612 4.99984 9.99992C4.99984 7.23867 7.23859 4.99992 9.99984 4.99992C11.2744 4.99992 12.4341 5.48075 13.3169 6.26617L15.6736 3.90942C14.1857 2.52217 12.1948 1.66659 9.99984 1.66659C5.39775 1.66659 1.6665 5.39784 1.6665 9.99992C1.6665 14.602 5.39775 18.3333 9.99984 18.3333C14.602 18.3333 18.3332 14.602 18.3332 9.99992C18.3332 9.44117 18.2765 8.89575 18.1712 8.36788Z" fill="#FFC107"/>
                <path d="M2.6275 6.12117L5.36542 8.12909C6.10625 6.29492 7.90042 4.99992 9.99958 4.99992C11.2742 4.99992 12.4338 5.48075 13.3167 6.26617L15.6733 3.90942C14.1854 2.52217 12.1946 1.66659 9.99958 1.66659C6.79875 1.66659 4.02292 3.47367 2.6275 6.12117Z" fill="#FF3D00"/>
                <path d="M10.0003 18.3334C12.1528 18.3334 14.1095 17.5096 15.587 16.17L13.007 13.9875C12.1432 14.6279 11.0865 15.0008 10.0003 15C7.83282 15 5.99199 13.618 5.29866 11.6892L2.58199 13.783C3.96074 16.4817 6.76116 18.3334 10.0003 18.3334Z" fill="#4CAF50"/>
                <path d="M18.1713 8.36796H17.5V8.33333H10V11.6667H14.7096C14.3809 12.5902 13.7889 13.3972 13.0067 13.988L13.0071 13.9877L15.5871 16.1702C15.4046 16.3361 18.3333 14.1667 18.3333 10C18.3333 9.44129 18.2767 8.89587 18.1713 8.36796Z" fill="#1976D2"/>
              </svg>
              <span className="text-[14px] font-[600] text-[#171419] font-inter">
                Google
              </span>
            </>
          )}
        </button>

      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-[10px]">
          <p className="text-[13px] text-red-700 font-inter">{error}</p>
        </div>
      )}
    </div>
  )
}
