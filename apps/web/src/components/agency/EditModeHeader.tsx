'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, ArrowLeft } from 'lucide-react'

interface EditModeHeaderProps {
  agencyName: string
  agencyStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  onCancel: () => void
}

export function EditModeHeader({ agencyName, agencyStatus, onCancel }: EditModeHeaderProps) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-gradient-to-r from-violet-50 to-blue-50 border-l-4 border-violet-500 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editing Agency Listing
            </h1>
            <div className="flex items-center space-x-3 mt-2">
              <span className="text-lg text-gray-700 font-medium">{agencyName}</span>
              <Badge className={getStatusColor(agencyStatus)}>
                {agencyStatus}
              </Badge>
            </div>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex items-center hover:bg-white/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Exit Edit Mode
        </Button>
      </div>
    </div>
  )
}