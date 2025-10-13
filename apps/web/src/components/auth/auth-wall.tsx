'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignUpModalEnhanced } from './signup-modal-enhanced'
import { LoginModal } from './login-modal'

interface AuthWallProps {
  resultCount?: number
  searchQuery?: string
}

export function AuthWall({ resultCount, searchQuery }: AuthWallProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Build the redirect URL
  const searchParamsString = searchParams?.toString() ?? ''
  const currentUrl = pathname + (searchParamsString ? `?${searchParamsString}` : '')

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
      <div 
        className="max-w-md w-full text-center space-y-6"
        role="alert"
        aria-live="polite"
      >
        <div className="flex justify-center">
          <Lock className="h-16 w-16 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">
            {resultCount ? (
              <>Sign up to view {resultCount} available requirements{searchQuery && <> matching "{searchQuery}"</>}</>
            ) : (
              <>Sign up for free to access the requirement search</>
            )}
          </h2>
          <p className="text-muted-foreground">
            You're one step away from finding the perfect match
          </p>
        </div>
        
        <div className="space-y-3">
          <SignUpModalEnhanced redirectTo={currentUrl}>
            <Button size="lg" className="w-full">
              Sign Up
            </Button>
          </SignUpModalEnhanced>
          
          <LoginModal redirectTo={currentUrl}>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full"
            >
              Already have an account? Sign In
            </Button>
          </LoginModal>
        </div>
      </div>
    </div>
  )
}