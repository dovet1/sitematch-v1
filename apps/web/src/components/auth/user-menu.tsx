'use client'

import { useState, useEffect } from 'react'
import { LogOut, Shield, LayoutDashboard, CreditCard, Loader2, LogOutIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/auth-context'
import { UserStatusHeader } from './user-status-header'
import Link from 'next/link'

function UserAvatar({ email }: { email: string }) {
  // Create avatar from email initials
  const initials = email
    .split('@')[0]
    .split('.')
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)

  return (
    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
      {initials}
    </div>
  )
}

export function UserMenu() {
  const { user, profile, signOut, isAdmin } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'trialing' | 'active' | 'past_due' | 'canceled' | null>(null)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [showSignoutAllDialog, setShowSignoutAllDialog] = useState(false)
  const [isSigningOutAll, setIsSigningOutAll] = useState(false)

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!user?.id) {
        setSubscriptionStatus(null)
        return
      }

      try {
        const response = await fetch('/api/user/subscription-status')
        if (response.ok) {
          const data = await response.json()
          setSubscriptionStatus(data.subscriptionStatus)
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error)
      }
    }

    fetchSubscriptionStatus()
  }, [user?.id])

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true)
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Portal session error:', errorData)
        throw new Error(errorData.details || 'Failed to create portal session')
      }

      const { url } = await response.json()
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error opening billing portal:', error)
      alert(error instanceof Error ? error.message : 'Failed to open billing portal. Please try again.')
    } finally {
      setIsLoadingPortal(false)
    }
  }

  const handleUpgrade = async () => {
    // Redirect to pricing or open trial signup modal
    window.location.href = '/pricing'
  }

  const handleSignOutAllDevices = async () => {
    setIsSigningOutAll(true)
    try {
      const response = await fetch('/api/auth/signout-all-devices', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sign out all devices')
      }

      // Close the dialog and sign out current device
      setShowSignoutAllDialog(false)
      await signOut()
    } catch (error) {
      console.error('Error signing out all devices:', error)
      alert('Failed to sign out all devices. Please try again.')
    } finally {
      setIsSigningOutAll(false)
    }
  }

  if (!user) {
    return null
  }

  // Show user email immediately, even if profile is still loading
  if (!profile) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <UserAvatar email={user.email || ''} />
          <span className="hidden sm:inline">{user.email}</span>
        </Button>
      </div>
    )
  }

  const hasSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'past_due'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-accent">
            <UserAvatar email={profile.email} />
            <span className="hidden sm:inline">{profile.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 z-[9999] p-0" align="end" sideOffset={5}>
          {/* User Status Header */}
          <UserStatusHeader
            email={profile.email}
            subscriptionStatus={subscriptionStatus}
            onUpgradeClick={handleUpgrade}
          />

          <DropdownMenuSeparator className="my-0" />

          <div className="p-1">
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/new-dashboard" className="flex items-center gap-2 cursor-pointer">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            {/* Manage Subscription Link */}
            {hasSubscription && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleManageSubscription}
                  disabled={isLoadingPortal}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {isLoadingPortal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  <span>{isLoadingPortal ? 'Opening...' : 'Manage Subscription'}</span>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowSignoutAllDialog(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <LogOutIcon className="h-4 w-4" />
              <span>Log out all devices</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={isLoading}
              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>{isLoading ? 'Signing out...' : 'Sign out'}</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sign out all devices confirmation dialog */}
      <AlertDialog open={showSignoutAllDialog} onOpenChange={setShowSignoutAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will log you out from all devices where you're currently signed in, including this one. You'll need to sign in again on each device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOutAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOutAllDevices}
              disabled={isSigningOutAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSigningOutAll ? 'Logging out...' : 'Log out all devices'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function UserMenuButton() {
  const { user, profile } = useAuth()

  if (!user || !profile) {
    return null
  }

  return (
    <Button variant="ghost" size="sm" className="flex items-center gap-2">
      <UserAvatar email={profile.email} />
    </Button>
  )
}