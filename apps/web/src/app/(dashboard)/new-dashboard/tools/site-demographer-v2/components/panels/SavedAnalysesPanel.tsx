'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Building2, Eye, Loader2, Lock, MapPin, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../primitives/Button'
import { SiteAnalyserLimitWarning } from '../primitives/SiteAnalyserLimitWarning'

interface SavedAnalysis {
  id: string
  name: string
  site_id: string | null
  site_name?: string
  location_name: string
  measurement_mode: string
  measurement_value: number
  created_at: string
}

interface SavedAnalysesPanelProps {
  onViewAnalysis?: () => void
  hasProAccess: boolean
  tierLoading: boolean
  onUpgradeClick: () => void
}

export function SavedAnalysesPanel({
  onViewAnalysis,
  hasProAccess,
  tierLoading,
  onUpgradeClick,
}: SavedAnalysesPanelProps) {
  const router = useRouter()
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalyses()
  }, [])

  const fetchAnalyses = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/demographic-analyses')

      if (response.status === 401) {
        setError('Please sign in to access saved analyses')
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(errorData.error || 'Failed to load analyses')
        return
      }

      const data = await response.json()
      setAnalyses(data.analyses || [])
    } catch (err) {
      console.error('Error fetching analyses:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analyses')
    } finally {
      setLoading(false)
    }
  }

  const handleView = (analysisId: string) => {
    onViewAnalysis?.()
    router.push(`/new-dashboard/tools/site-demographer-v2?analysis=${analysisId}`)
  }

  const handleDelete = async (analysis: SavedAnalysis) => {
    if (!confirm(`Delete "${analysis.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingId(analysis.id)
      const response = await fetch(`/api/demographic-analyses/${analysis.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete analysis' }))
        throw new Error(errorData.error || 'Failed to delete analysis')
      }

      toast.success('Analysis deleted')
      await fetchAnalyses()
    } catch (err) {
      console.error('Error deleting analysis:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete analysis')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sm-border p-4">
        <h2 className="text-sm font-semibold text-sm-ink">Saved Analyses</h2>
        <p className="mt-1 text-xs text-sm-ink/60">
          Load or manage your saved SiteAnalyser reports
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!tierLoading && !hasProAccess && (
          <SiteAnalyserLimitWarning
            message="Upgrade to Pro to save and load demographic analyses."
            onUpgrade={onUpgradeClick}
          />
        )}

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-sm-violet" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={fetchAnalyses}
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && analyses.length === 0 && (
          <div className="rounded-lg border border-sm-border bg-sm-bg/70 p-6 text-center">
            <BarChart3 className="mx-auto mb-3 h-8 w-8 text-sm-ink/35" />
            <p className="text-sm font-medium text-sm-ink">No saved analyses yet</p>
            <p className="mt-1 text-xs leading-5 text-sm-ink/60">
              Save an analysis from the top bar to see it here.
            </p>
          </div>
        )}

        {!loading && !error && analyses.length > 0 && (
          <div className="space-y-2">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="rounded-lg border border-sm-border bg-sm-surface p-3 transition-colors hover:bg-sm-bg"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-sm-ink">
                    {analysis.name}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-sm-ink/60">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{analysis.location_name}</span>
                    </div>
                    <div>
                      {getMeasurementLabel(analysis.measurement_mode, analysis.measurement_value)}
                      <span className="mx-1.5">-</span>
                      {formatDate(analysis.created_at)}
                    </div>
                    {analysis.site_id && (
                      <div className="flex min-w-0 items-center gap-1.5 text-sm-violet">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {analysis.site_name ? `Linked to ${analysis.site_name}` : 'Linked to site'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {hasProAccess ? (
                    <>
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="primary"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => handleView(analysis.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        isLoading={deletingId === analysis.id}
                        onClick={() => handleDelete(analysis)}
                        title="Delete analysis"
                        aria-label={`Delete ${analysis.name}`}
                      />
                    </>
                  ) : (
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="secondary"
                      icon={<Lock className="h-3.5 w-3.5" />}
                      onClick={onUpgradeClick}
                    >
                      Upgrade to View
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getMeasurementLabel(mode: string, value: number) {
  if (mode === 'distance') return `${value} mile${value !== 1 ? 's' : ''}`
  if (mode === 'drive_time') return `${value} min drive`
  if (mode === 'walk_time') return `${value} min walk`
  return `${value}`
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
