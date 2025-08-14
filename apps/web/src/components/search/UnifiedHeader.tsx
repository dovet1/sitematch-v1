'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LoginModal } from '@/components/auth/login-modal';
import { SignUpModalEnhanced } from '@/components/auth/signup-modal-enhanced';
import { UserMenu } from '@/components/auth/user-menu';
import { useAuth } from '@/contexts/auth-context';
import { SearchHeaderBar } from './SearchHeaderBar';
import { Menu, X, Sparkles } from 'lucide-react';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

interface UnifiedHeaderProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onLocationSelect: (locationData: { name: string; coordinates: { lat: number; lng: number } }) => void;
  isMapView?: boolean;
  onMapViewToggle?: (isMapView: boolean) => void;
  showViewToggle?: boolean;
}

export function UnifiedHeader({
  searchFilters,
  onFiltersChange,
  onLocationSelect,
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
      href: '/sitesketcher/landing',
      label: 'SiteSketcher',
      primary: false,
      showWhen: 'always' as const
    },
    {
      href: '/agents',
      label: 'Agents',
      primary: false,
      showWhen: 'always' as const
    },
    {
      href: '/occupier/create-listing?fresh=true',
      label: 'Post Requirement',
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
                className="flex items-center space-x-2 violet-bloom-link hover:opacity-80 transition-opacity"
                aria-label="SiteMatcher Home"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="heading-4 font-bold text-foreground">SiteMatcher</span>
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
                      {item.label}
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
                  <SignUpModalEnhanced>
                    <Button className="w-full font-medium shadow-sm violet-bloom-touch">
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
        onLocationSelect={onLocationSelect}
        isMapView={isMapView}
        onMapViewToggle={onMapViewToggle}
        showViewToggle={showViewToggle}
      />
    </div>
  );
}