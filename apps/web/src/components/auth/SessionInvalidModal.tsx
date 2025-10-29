'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function SessionInvalidModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signOut, user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    const logoutReason = searchParams?.get('logout_reason')

    // Only show modal if there's a logout reason and user is still authenticated
    if (logoutReason === 'session_invalid' && user) {
      setIsOpen(true)
    }
  }, [searchParams, user])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setIsOpen(false)

    // Clear session cookies immediately
    document.cookie = 'session_id=; path=/; max-age=0; samesite=lax'
    document.cookie = 'session_id=; path=/; max-age=0'
    localStorage.removeItem('session_id')

    try {
      // Use local scope to only sign out THIS device, not all devices
      const { createClientClient } = await import('@/lib/supabase')
      const supabase = createClientClient()
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      console.error('Error signing out:', error)
    }

    // Clean up the URL and redirect to home
    router.replace('/')
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Logged In from Another Device</DialogTitle>
          <DialogDescription className="pt-2">
            You've been logged in from another device. For security reasons, you can only be logged in on one device at a time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full"
          >
            {isLoggingOut ? 'Logging out...' : 'Okay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
