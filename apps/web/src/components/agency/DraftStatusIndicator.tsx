'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface PendingVersion {
  id: string
  version_number: number
  status: string
  submitted_for_review_at: string
}

interface DraftStatusIndicatorProps {
  agencyId: string
  isAdmin: boolean
  onDraftChange?: (hasDraft: boolean) => void
}

export function DraftStatusIndicator({ 
  agencyId, 
  isAdmin
}: DraftStatusIndicatorProps) {
  const [pendingVersion, setPendingVersion] = useState<PendingVersion | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      fetchPendingVersion()
    } else {
      setIsLoading(false)
    }
  }, [agencyId, isAdmin])

  const fetchPendingVersion = async () => {
    try {
      const response = await fetch(`/api/agencies/${agencyId}/versions?status=pending`)
      if (response.ok) {
        const data = await response.json()
        setPendingVersion(data.versions?.[0] || null)
      }
    } catch (error) {
      console.error('Error fetching pending version:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-16 w-full" />
    )
  }

  if (!pendingVersion || !isAdmin) {
    return null
  }

  const submittedAt = new Date(pendingVersion.submitted_for_review_at)
  const timeAgo = formatDistanceToNow(submittedAt, { addSuffix: true })

  return (
    <Alert className="border-yellow-200 bg-yellow-50">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-900 mb-1">
            Pending Approval
          </h4>
          
          <AlertDescription className="text-yellow-800">
            <p className="text-sm mb-1">
              Submitted {timeAgo}
            </p>
            <p className="text-sm text-yellow-700">
              An admin will review your changes before they go live on your public listing.
            </p>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}