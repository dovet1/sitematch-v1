'use client'

import { useState } from 'react'
import { LogOut, User, Settings, Shield, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/auth-context'
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
  const { user, profile, signOut, isAdmin, loading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-accent">
            <UserAvatar email={profile.email} />
            <span className="hidden sm:inline">{profile.email}</span>
            {isAdmin && <Shield className="h-3 w-3 text-primary" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 z-[9999]" align="end" sideOffset={5}>
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserAvatar email={profile.email} />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{profile.email}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {profile.role}
                {isAdmin && profile.role !== 'admin' && " • Admin"}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/occupier/dashboard" className="flex items-center gap-2 cursor-pointer">
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
            <DropdownMenuItem 
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isLoading}
            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>{isLoading ? 'Signing out...' : 'Sign out'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-[425px] z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Details
            </DialogTitle>
            <DialogDescription>
              Your account information and settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <span className="body-small font-medium">Email:</span>
                <span className="body-small text-muted-foreground">{profile.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="body-small font-medium">Role:</span>
                <div className="flex items-center gap-1">
                  <span className="body-small text-muted-foreground capitalize">{profile.role}</span>
                  {isAdmin && <Shield className="h-3 w-3 text-primary" />}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="body-small font-medium">Member since:</span>
                <span className="body-small text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
      <User className="h-4 w-4" />
      <span className="hidden sm:inline">{profile.email}</span>
      {profile.role === 'admin' && <Shield className="h-3 w-3 text-primary" />}
    </Button>
  )
}