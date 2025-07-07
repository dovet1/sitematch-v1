'use client'

import { useState } from 'react'
import { LogOut, User, Settings, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/auth-context'

export function UserMenu() {
  const { user, profile, signOut, isAdmin, loading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

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
          <User className="h-4 w-4" />
          {user.email}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {profile.email}
            {isAdmin && <Shield className="h-3 w-3 text-primary" />}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
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
            
            <div className="border-t pt-4">
              <Button
                onClick={handleSignOut}
                disabled={isLoading}
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {isLoading ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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