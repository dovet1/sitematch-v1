'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoginModal } from '@/components/auth/login-modal'
import { SignUpModal } from '@/components/auth/signup-modal'
import { UserMenu } from '@/components/auth/user-menu'
import { useAuth } from '@/contexts/auth-context'
import { Menu, X, Sparkles } from 'lucide-react'

export function Header() {
  const { user, loading, isAdmin } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const navigationItems = [
    {
      href: '/occupier/create-listing',
      label: 'List Property',
      primary: true,
      showWhen: 'always'
    },
    {
      href: '/occupier/dashboard',
      label: 'Dashboard',
      primary: false,
      showWhen: 'authenticated'
    },
    {
      href: '/admin',
      label: 'Admin',
      primary: false,
      showWhen: 'admin'
    }
  ]

  const shouldShowNavItem = (item: typeof navigationItems[0]) => {
    if (item.showWhen === 'always') return true
    if (item.showWhen === 'authenticated') return !!user
    if (item.showWhen === 'admin') return isAdmin
    return false
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              href="/" 
              className="flex items-center space-x-2 violet-bloom-link hover:opacity-80 transition-opacity"
              aria-label="SiteMatch Home"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="heading-4 font-bold text-foreground">SiteMatch</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1" aria-label="Main navigation">
            {navigationItems.map((item) => (
              shouldShowNavItem(item) && (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all duration-200 violet-bloom-touch
                    ${item.primary 
                      ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 hover:text-primary-800' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 focus-visible:outline-offset-2
                  `}
                >
                  {item.label}
                </Link>
              )
            ))}
          </nav>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex items-center space-x-3">
            {loading && !user ? (
              <div className="flex items-center space-x-2">
                <div className="h-9 w-16 bg-muted animate-pulse rounded-md violet-bloom-loading" />
                <div className="h-9 w-20 bg-muted animate-pulse rounded-md violet-bloom-loading" />
              </div>
            ) : user ? (
              <UserMenu />
            ) : (
              <div className="flex items-center space-x-2">
                <LoginModal>
                  <Button variant="ghost" size="sm" className="font-medium">
                    Sign In
                  </Button>
                </LoginModal>
                <SignUpModal>
                  <Button size="sm" className="font-medium shadow-sm">
                    Sign Up
                  </Button>
                </SignUpModal>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleMobileMenu()
              }}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
              className="p-2 violet-bloom-touch"
              type="button"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div 
          id="mobile-menu"
          className="md:hidden bg-background border-t border-border shadow-lg"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="px-4 py-3 space-y-1">
            {navigationItems.map((item) => (
              shouldShowNavItem(item) && (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`
                    block px-4 py-3 rounded-lg font-medium transition-all duration-200 violet-bloom-touch
                    ${item.primary 
                      ? 'bg-primary-50 text-primary-700 hover:bg-primary-100' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 focus-visible:outline-offset-2
                  `}
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>

          {/* Mobile Auth Section */}
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            {loading && !user ? (
              <div className="space-y-2">
                <div className="h-10 bg-muted animate-pulse rounded-md violet-bloom-loading" />
                <div className="h-10 bg-muted animate-pulse rounded-md violet-bloom-loading" />
              </div>
            ) : user ? (
              <div className="flex items-center justify-between">
                <UserMenu />
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <LoginModal>
                  <Button variant="ghost" className="w-full justify-start font-medium violet-bloom-touch">
                    Sign In
                  </Button>
                </LoginModal>
                <SignUpModal>
                  <Button className="w-full font-medium shadow-sm violet-bloom-touch">
                    Sign Up
                  </Button>
                </SignUpModal>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}