'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoginModal } from '@/components/auth/login-modal'
import { SignUpModal } from '@/components/auth/signup-modal'
import { UserMenu } from '@/components/auth/user-menu'
import { useAuth } from '@/contexts/auth-context'

export function Header() {
  const { user, loading, isAdmin } = useAuth()

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          SiteMatch
        </Link>
        
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/directory" className="text-muted-foreground hover:text-foreground">
            Directory
          </Link>
          <Link href="/search" className="text-muted-foreground hover:text-foreground">
            Search
          </Link>
          <Link href="/list" className="text-muted-foreground hover:text-foreground">
            List Property
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-blue-600 hover:text-blue-700 font-medium">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {loading ? (
            <div className="h-9 w-20 bg-muted animate-pulse rounded" />
          ) : user ? (
            <UserMenu />
          ) : (
            <div className="flex items-center space-x-2">
              <LoginModal>
                <Button variant="ghost">
                  Sign In
                </Button>
              </LoginModal>
              <SignUpModal>
                <Button>
                  Sign Up
                </Button>
              </SignUpModal>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}