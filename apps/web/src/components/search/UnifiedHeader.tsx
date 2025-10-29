'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoginModal } from '@/components/auth/login-modal';
import { SignUpModalEnhanced } from '@/components/auth/signup-modal-enhanced';
import { UserMenu } from '@/components/auth/user-menu';
import { UserStatusHeader } from '@/components/auth/user-status-header';
import { useAuth } from '@/contexts/auth-context';
import { SearchHeaderBar } from './SearchHeaderBar';
import { Menu, X, Sparkles, LogOut, Shield, LayoutDashboard, CreditCard, Loader2, LogOutIcon } from 'lucide-react';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

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
      onClose()
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

      setShowSignoutAllDialog(false)
      await signOut()
      onClose()
    } catch (error) {
      console.error('Error signing out all devices:', error)
      alert('Failed to sign out all devices. Please try again.')
    } finally {
      setIsSigningOutAll(false)
    }
  }

  if (!user || !profile) {
    return null
  }

  const hasSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'past_due'

  return (
    <>
      <div className="space-y-3">
        {/* User Status Header */}
        <UserStatusHeader
          email={profile.email}
          subscriptionStatus={subscriptionStatus}
          onUpgradeClick={handleUpgrade}
        />

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

          {/* Manage Subscription */}
          {hasSubscription && (
            <button
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/60 transition-all duration-200 active:scale-[0.98] violet-bloom-touch"
            >
              {isLoadingPortal ? (
                <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5 text-primary-600" />
              )}
              <span className="text-base font-medium text-foreground">
                {isLoadingPortal ? 'Opening...' : 'Manage Subscription'}
              </span>
            </button>
          )}

          {/* Log out all devices */}
          <button
            onClick={() => setShowSignoutAllDialog(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/60 transition-all duration-200 active:scale-[0.98] violet-bloom-touch"
          >
            <LogOutIcon className="h-5 w-5 text-foreground" />
            <span className="text-base font-medium text-foreground">Log out all devices</span>
          </button>

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

interface UnifiedHeaderProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  isMapView?: boolean;
  onMapViewToggle?: (isMapView: boolean) => void;
  showViewToggle?: boolean;
}

export function UnifiedHeader({
  searchFilters,
  onFiltersChange,
  isMapView = false,
  onMapViewToggle,
  showViewToggle = false
}: UnifiedHeaderProps) {
  const { user, loading, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Track scroll for navbar collapse
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const shouldCollapse = window.scrollY > 120;
          
          // Use longer debounce on mobile for smoother scrolling
          const debounceTime = window.innerWidth < 768 ? 100 : 30;
          
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setIsScrolled(shouldCollapse);
          }, debounceTime);
          
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navigationItems = [
    {
      href: '/search',
      label: 'Browse Requirements',
      primary: false,
      showWhen: 'always' as const
    },
    {
      href: '/sitesketcher/landing',
      label: 'SiteSketcher',
      primary: false,
      showWhen: 'always' as const
    },
    {
      href: '/occupier/create-listing-quick',
      label: 'Post Requirement',
      badge: '(Free!)',
      primary: true,
      showWhen: 'always' as const
    }
  ];

  const shouldShowNavItem = (item: typeof navigationItems[0]) => {
    if (item.showWhen === 'always') return true;
    if (item.showWhen === 'authenticated') return !!user;
    if (item.showWhen === 'admin') return isAdmin;
    return false;
  };

  return (
    <div className="sticky top-0 z-sticky">
      {/* Navigation Header */}
      <header className="w-full bg-background border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className={cn(
            "flex items-center justify-between transition-all duration-300",
            isScrolled ? "h-12" : "h-14"
          )}>
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

            {/* Desktop Navigation - Hide when scrolled */}
            {!isScrolled && (
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
                      {item.label}{('badge' in item) && <span style={{ color: 'var(--warning)' }}> {item.badge}</span>}
                    </Link>
                  )
                ))}
              </nav>
            )}

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
                  e.preventDefault();
                  e.stopPropagation();
                  toggleMobileMenu();
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
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block w-full px-5 py-4 rounded-xl font-semibold text-base text-center bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 violet-bloom-touch"
                >
                  {item.label}{('badge' in item) && <span style={{ color: 'var(--warning)' }}> {item.badge}</span>}
                </Link>
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

      {/* Search Header */}
      <SearchHeaderBar
        searchFilters={searchFilters}
        onFiltersChange={onFiltersChange}
        isMapView={isMapView}
        onMapViewToggle={onMapViewToggle}
        showViewToggle={showViewToggle}
      />
    </div>
  );
}