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
  const [hasApprovedVersion, setHasApprovedVersion] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      fetchVersions()
    } else {
      setIsLoading(false)
    }
  }, [agencyId, isAdmin])

  const fetchVersions = async () => {
    try {
      // Get all versions to determine the latest one
      const allVersionsResponse = await fetch(`/api/agencies/${agencyId}/versions`)
      if (allVersionsResponse.ok) {
        const allData = await allVersionsResponse.json()
        const versions = allData.versions || []
        
        // Find the latest version by version_number
        const latestVersion = versions.reduce((latest: any, current: any) => {
          return current.version_number > (latest?.version_number || 0) ? current : latest
        }, null)
        
        // Only show pending status if the latest version is pending
        if (latestVersion && latestVersion.status === 'pending') {
          setPendingVersion(latestVersion)
        } else {
          setPendingVersion(null)
        }

        // Check for approved versions
        setHasApprovedVersion(versions.some((v: any) => v.status === 'approved'))
      }
    } catch (error) {
      console.error('Error fetching versions:', error)
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
              {hasApprovedVersion 
                ? "Changes pending admin approval. Your live listing remains unchanged until approved."
                : "An admin will review your changes before they go live on your public listing."
              }
            </p>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}