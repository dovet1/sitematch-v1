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
        <Link href="/" className="heading-4 violet-bloom-link">
          SiteMatch
        </Link>
        
        <nav className="hidden md:flex items-center space-x-2">
          <Link href="/directory" className="violet-bloom-nav-item">
            Directory
          </Link>
          <Link href="/search" className="violet-bloom-nav-item">
            Search
          </Link>
          <Link href="/occupier/create-listing" className="violet-bloom-nav-item">
            List Property
          </Link>
          {isAdmin && (
            <Link href="/admin" className="violet-bloom-nav-item active">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {loading && !user ? (
            <div className="h-9 w-20 bg-muted animate-pulse violet-bloom-loading" style={{ borderRadius: "var(--radius-md)" }} />
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