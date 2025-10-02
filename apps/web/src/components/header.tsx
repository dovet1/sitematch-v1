'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LoginModal } from '@/components/auth/login-modal'
import { SignUpModalEnhanced } from '@/components/auth/signup-modal-enhanced'
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal'
import { UserMenu } from '@/components/auth/user-menu'
import { useAuth } from '@/contexts/auth-context'
import { Menu, X, Sparkles, LogOut, User, Shield, LayoutDashboard } from 'lucide-react'

export function Header() {
  const { user, loading, isAdmin } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  
  // Hide header on specific pages that need full-screen experience
  // Only hide on the actual SiteSketcher app, not the landing page
  if (pathname === '/search' || pathname === '/sitesketcher') {
    return null
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const navigationItems = [
    {
      href: '/search',
      label: 'Browse Requirements',
      primary: false,
      showWhen: 'always',
      requiresAuth: false
    },
    {
      href: '/sitesketcher/landing',
      label: 'SiteSketcher',
      primary: false,
      showWhen: 'always',
      requiresAuth: false
    },
    {
      href: '/occupier/create-listing-quick',
      label: 'Post Requirement',
      badge: '(Free!)',
      primary: true,
      showWhen: 'always',
      requiresAuth: true
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
              className="flex items-center violet-bloom-link hover:opacity-80 transition-opacity"
              aria-label="SiteMatcher Home"
            >
              <Image
                src="/logos/logo.svg"
                alt="SiteMatcher"
                width={200}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1" aria-label="Main navigation">
            {navigationItems.map((item) => (
              shouldShowNavItem(item) && (
                item.requiresAuth && !user ? (
                  <AuthChoiceModal
                    key={item.href}
                    redirectTo={item.href}
                    title="Sign in to post requirements"
                    description="Access your account to create and manage property listings"
                  >
                    <button
                      className={`
                        px-4 py-2 rounded-lg font-medium transition-all duration-200 violet-bloom-touch cursor-pointer
                        ${item.primary
                          ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 hover:text-primary-800'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 focus-visible:outline-offset-2
                      `}
                    >
                      {item.label}{('badge' in item) && <span style={{ color: 'var(--warning)' }}> {item.badge}</span>}
                    </button>
                  </AuthChoiceModal>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      px-4 py-2 rounded-lg font-medium transition-all duration-200 violet-bloom-touch cursor-pointer
                      ${item.primary
                        ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 hover:text-primary-800'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }
                      focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 focus-visible:outline-offset-2
                    `}
                  >
                    {item.label}{('badge' in item) && <span style={{ color: 'var(--warning)' }}> {item.badge}</span>}
                  </Link>
                )
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
                <SignUpModalEnhanced>
                  <Button size="sm" className="font-medium shadow-sm">
                    Sign Up
                  </Button>
                </SignUpModalEnhanced>
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
          <div className="px-4 pt-4 pb-3">
            {/* Secondary Navigation Links */}
            <nav className="space-y-1 mb-4">
              {navigationItems.filter(item => !item.primary && shouldShowNavItem(item)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block px-4 py-3.5 rounded-xl text-base font-medium text-foreground hover:bg-muted/60 transition-all duration-200 violet-bloom-touch active:scale-[0.98]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Primary CTA - Prominent */}
            {navigationItems.filter(item => item.primary && shouldShowNavItem(item)).map((item) => (
              item.requiresAuth && !user ? (
                <AuthChoiceModal
                  key={item.href}
                  redirectTo={item.href}
                  title="Sign in to post requirements"
                  description="Access your account to create and manage property listings"
                >
                  <button
                    onClick={closeMobileMenu}
                    className="w-full px-5 py-4 rounded-xl font-semibold text-base bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 violet-bloom-touch"
                  >
                    {item.label}{('badge' in item) && <span style={{ color: 'var(--warning)' }}> {item.badge}</span>}
                  </button>
                </AuthChoiceModal>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block w-full px-5 py-4 rounded-xl font-semibold text-base text-center bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 violet-bloom-touch"
                >
                  {item.label}{('badge' in item) && <span style={{ color: 'var(--warning)' }}> {item.badge}</span>}
                </Link>
              )
            ))}
          </div>

          {/* Mobile Auth Section */}
          <div className="px-4 py-4 border-t border-border/60">
            {loading && !user ? (
              <div className="space-y-2.5">
                <div className="h-11 bg-muted animate-pulse rounded-xl violet-bloom-loading" />
                <div className="h-11 bg-muted animate-pulse rounded-xl violet-bloom-loading" />
              </div>
            ) : user ? (
              <MobileUserSection onClose={closeMobileMenu} />
            ) : (
              <div className="space-y-2.5">
                <LoginModal>
                  <Button variant="ghost" className="w-full h-11 justify-center text-base font-medium violet-bloom-touch rounded-xl">
                    Sign In
                  </Button>
                </LoginModal>
                <SignUpModalEnhanced>
                  <Button className="w-full h-11 text-base font-semibold shadow-sm violet-bloom-touch rounded-xl">
                    Sign Up
                  </Button>
                </SignUpModalEnhanced>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

// Mobile user avatar component
function MobileUserAvatar({ email }: { email: string }) {
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

// Mobile user section - expands profile menu items directly in hamburger menu
function MobileUserSection({ onClose }: { onClose: () => void }) {
  const { user, profile, signOut, isAdmin } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      onClose()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* User Info Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl border border-primary-200/50">
        <MobileUserAvatar email={profile.email} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {profile.email}
          </p>
          <p className="text-xs text-muted-foreground">Account</p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-1.5">
        <Link
          href="/occupier/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/60 transition-all duration-200 active:scale-[0.98] violet-bloom-touch"
        >
          <LayoutDashboard className="h-5 w-5 text-primary-600" />
          <span className="text-base font-medium text-foreground">Dashboard</span>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/60 transition-all duration-200 active:scale-[0.98] violet-bloom-touch"
          >
            <Shield className="h-5 w-5 text-primary-600" />
            <span className="text-base font-medium text-foreground">Admin</span>
          </Link>
        )}

        <button
          onClick={handleSignOut}
          disabled={isLoading}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 transition-all duration-200 text-destructive active:scale-[0.98] violet-bloom-touch"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-base font-medium">
            {isLoading ? 'Signing out...' : 'Sign out'}
          </span>
        </button>
      </div>
    </div>
  )
}