'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Eye,
  FileText,
  Calendar,
  User
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AgencyVersion {
  id: string
  version_number: number
  data: any
  status: 'pending' | 'approved' | 'rejected' | 'draft'
  admin_notes?: string
  created_at: string
  created_by: string
  reviewed_at?: string
  reviewed_by?: string
  users?: { email: string }
  reviewers?: { email: string }
}

interface VersionHistoryProps {
  agencyId: string
  isAdmin: boolean
}

export function VersionHistory({ agencyId, isAdmin }: VersionHistoryProps) {
  const [versions, setVersions] = useState<AgencyVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<AgencyVersion | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVersions()
  }, [agencyId])

  const fetchVersions = async () => {
    try {
      const response = await fetch(`/api/agencies/${agencyId}/versions`)
      if (!response.ok) {
        throw new Error('Failed to fetch version history')
      }
      const data = await response.json()
      setVersions(data.versions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'draft':
        return <AlertCircle className="w-4 h-4 text-gray-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getChangeSummary = (versionData: any) => {
    const changes = versionData._changes
    if (!changes) return 'General update'
    
    const fieldLabels: Record<string, string> = {
      name: 'Agency name',
      description: 'Description',
      website: 'Website',
      logo_url: 'Logo',
      coverage_areas: 'Coverage areas',
      specialisms: 'Specialisms'
    }

    const changedFields = changes.fields?.map((field: string) => 
      fieldLabels[field] || field
    ).join(', ')

    return changedFields || 'General update'
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      relative: formatDistanceToNow(date, { addSuffix: true }),
      absolute: date.toLocaleString()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-20" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No version history available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
        <span className="text-sm text-gray-500">{versions.length} versions</span>
      </div>

      <div className="space-y-3">
        {versions.map((version) => {
          const datetime = formatDateTime(version.created_at)
          const reviewDatetime = version.reviewed_at ? formatDateTime(version.reviewed_at) : null

          return (
            <div
              key={version.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(version.status)}
                    <span className="font-medium text-gray-900">
                      Version {version.version_number}
                    </span>
                    <Badge className={getStatusColor(version.status)}>
                      {version.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {getChangeSummary(version.data)}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{version.users?.email || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1" title={datetime.absolute}>
                      <Calendar className="w-3 h-3" />
                      <span>{datetime.relative}</span>
                    </div>
                  </div>

                  {version.status === 'approved' && reviewDatetime && (
                    <div className="mt-2 text-xs text-green-600">
                      Approved {reviewDatetime.relative} by {version.reviewers?.email || 'Admin'}
                    </div>
                  )}

                  {version.status === 'rejected' && version.admin_notes && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      <strong>Rejection reason:</strong> {version.admin_notes}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedVersion(version)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Version Detail Modal */}
      {selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Version {selectedVersion.version_number} Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedVersion(null)}
                >
                  ×
                </Button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Status:</strong> 
                  <Badge className={`ml-2 ${getStatusColor(selectedVersion.status)}`}>
                    {selectedVersion.status}
                  </Badge>
                </div>
                <div>
                  <strong>Created:</strong> {formatDateTime(selectedVersion.created_at).absolute}
                </div>
                <div>
                  <strong>Author:</strong> {selectedVersion.users?.email || 'Unknown'}
                </div>
                {selectedVersion.reviewed_at && (
                  <div>
                    <strong>Reviewed:</strong> {formatDateTime(selectedVersion.reviewed_at).absolute}
                  </div>
                )}
              </div>

              {selectedVersion.admin_notes && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <strong className="text-sm">Admin Notes:</strong>
                  <p className="mt-1 text-sm text-gray-700">{selectedVersion.admin_notes}</p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-medium">Version Data:</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-60">
                  {JSON.stringify(selectedVersion.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}