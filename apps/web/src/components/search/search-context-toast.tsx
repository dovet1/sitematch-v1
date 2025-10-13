'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SearchContextToast() {
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Check if we just authenticated and have search params
    const query = searchParams?.get('query')
    const location = searchParams?.get('location')
    
    // Check for authentication marker in cookies
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    
    const justAuthenticated = cookies.justAuthenticated === 'true'
    
    if (justAuthenticated && (query || location)) {
      // Clear the cookie
      document.cookie = 'justAuthenticated=; path=/; max-age=0'
      
      let searchMessage = 'Continuing your search'
      if (query && location) {
        searchMessage = `Continuing your search for '${query}' in ${location}`
      } else if (query) {
        searchMessage = `Continuing your search for '${query}'`
      } else if (location) {
        searchMessage = `Continuing your search in ${location}`
      }
      
      setMessage(searchMessage)
      setVisible(true)
      
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "bg-background border rounded-lg shadow-lg p-4 pr-12",
        "flex items-center gap-3 max-w-sm",
        "animate-in slide-in-from-bottom-2 fade-in duration-300"
      )}
    >
      <Search className="h-5 w-5 text-primary flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-2 top-2 p-1 rounded-md hover:bg-muted"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}