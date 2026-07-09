'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search,
  Download,
  ChevronDown,
  MapPin,
  Loader2,
  Shield,
  CreditCard,
  LogOut,
  LogOutIcon,
} from 'lucide-react'
import {
  createDebouncedLocationSearch,
  formatLocationDisplay,
  type LocationResult,
} from '@/lib/mapbox'
import { useAuth } from '@/contexts/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
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

export function UChrome({
  onSelectLocation,
}: {
  onSelectLocation?: (center: [number, number]) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useRef(createDebouncedLocationSearch(300))

  const { user, profile, signOut, isAdmin } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [showSignoutAllDialog, setShowSignoutAllDialog] = useState(false)
  const [isSigningOutAll, setIsSigningOutAll] = useState(false)

  const email = profile?.email || user?.email || ''
  const initials = email
    ? email
        .split('@')[0]
        .split('.')
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2)
    : 'N'

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
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
        throw new Error(errorData.details || 'Failed to create portal session')
      }
      const { url } = await response.json()
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error opening billing portal:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to open billing portal. Please try again.'
      )
    } finally {
      setIsLoadingPortal(false)
    }
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
    } catch (error) {
      console.error('Error signing out all devices:', error)
      alert('Failed to sign out all devices. Please try again.')
    } finally {
      setIsSigningOutAll(false)
    }
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    let active = true
    setIsSearching(true)
    debouncedSearch.current(query, {
      limit: 5,
      country: ['GB', 'IE'],
      types: ['place', 'locality', 'neighborhood', 'address', 'postcode', 'poi', 'region'],
    })
      .then((res) => {
        if (!active) return
        setResults(res)
        setShowResults(res.length > 0)
        setFocusedIndex(-1)
      })
      .catch((err) => {
        if (!active) return
        console.error('Location search error:', err)
        setResults([])
        setShowResults(false)
      })
      .finally(() => {
        if (active) setIsSearching(false)
      })
    return () => {
      active = false
    }
  }, [query])

  const handleSelect = (location: LocationResult) => {
    onSelectLocation?.(location.center)
    setQuery('')
    setResults([])
    setShowResults(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        handleSelect(results[focusedIndex >= 0 ? focusedIndex : 0])
        break
      case 'Escape':
        setShowResults(false)
        setFocusedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // ⌘K / Ctrl+K focuses the search field.
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  // Close the dropdown on outside click.
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <header className="flex h-14 items-center gap-4 border-b border-sm-border bg-sm-surface px-4">
      {/* Logo / wordmark */}
      <div className="flex items-center">
        <Image
          src="/logos/logo.svg"
          alt="SiteMatcher"
          width={200}
          height={40}
          className="h-9 w-auto"
          priority
        />
      </div>

      {/* Location search */}
      <div className="relative mx-auto w-full max-w-[460px]">
        <div className="flex h-[42px] w-full items-center gap-2 rounded-lg bg-sm-bg px-3 text-sm-ink3">
          <Search size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowResults(results.length > 0)}
            placeholder="Search a town, postcode or address…"
            className="w-full bg-transparent text-sm text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
            aria-label="Search a location"
            aria-expanded={showResults}
            role="combobox"
            aria-controls="uchrome-location-results"
          />
          {isSearching ? (
            <Loader2 size={14} className="animate-spin text-sm-ink4" />
          ) : (
            <span className="font-mono text-[11px] text-sm-ink4">⌘K</span>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div
            ref={resultsRef}
            id="uchrome-location-results"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-sm-border bg-white shadow-lg"
          >
            {results.map((location, index) => (
              <button
                key={location.id}
                type="button"
                role="option"
                aria-selected={index === focusedIndex}
                onClick={() => handleSelect(location)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  index === focusedIndex ? 'bg-sm-violet/10' : 'hover:bg-sm-bg'
                } ${index !== results.length - 1 ? 'border-b border-sm-border' : ''}`}
              >
                <MapPin size={16} className="flex-shrink-0 text-sm-ink3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sm-ink">{location.text}</p>
                  <p className="truncate text-xs text-sm-ink3">
                    {formatLocationDisplay(location)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-sm-violet px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sm-violet-deep"
        >
          <Download size={15} />
          Export
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex items-center gap-1 text-sm-ink2 focus:outline-none"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sm-violet text-sm font-semibold text-white">
                {initials}
              </span>
              <ChevronDown size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 z-[9999]" align="end" sideOffset={5}>
            {email && (
              <>
                <div className="px-2 py-1.5 text-xs text-sm-ink3 truncate">{email}</div>
                <DropdownMenuSeparator />
              </>
            )}
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              </DropdownMenuItem>
            )}
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
              <span>{isLoadingPortal ? 'Opening…' : 'Manage subscription'}</span>
            </DropdownMenuItem>
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
              disabled={isSigningOut}
              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showSignoutAllDialog} onOpenChange={setShowSignoutAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will log you out from all devices where you&apos;re currently signed in,
              including this one. You&apos;ll need to sign in again on each device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOutAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOutAllDevices}
              disabled={isSigningOutAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSigningOutAll ? 'Logging out…' : 'Log out all devices'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
