'use client'

import { CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react'

interface AutoSaveIndicatorProps {
  lastSaved: Date | null
  isAutoSaving: boolean
  hasUnsavedChanges: boolean
}

export function AutoSaveIndicator({ lastSaved, isAutoSaving, hasUnsavedChanges }: AutoSaveIndicatorProps) {
  const getTimeAgo = (date: Date): string => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 10) return 'just now'
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
    
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`
  }

  if (isAutoSaving) {
    return (
      <div className="flex items-center text-sm text-blue-600 animate-in fade-in duration-200">
        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
        <span className="font-medium">Saving changes...</span>
      </div>
    )
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center text-sm text-amber-600">
        <Clock className="w-3 h-3 mr-2" />
        <span className="font-medium">Unsaved changes</span>
        <span className="ml-1 text-amber-500">• Auto-save in progress</span>
      </div>
    )
  }

  if (lastSaved) {
    return (
      <div className="flex items-center text-sm text-green-600 animate-in fade-in duration-200">
        <CheckCircle2 className="w-3 h-3 mr-2" />
        <span className="font-medium">All changes saved</span>
        <span className="ml-1 text-green-500">• {getTimeAgo(lastSaved)}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center text-sm text-gray-500">
      <AlertCircle className="w-3 h-3 mr-2" />
      <span>No changes detected</span>
    </div>
  )
}