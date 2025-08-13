'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface WizardData {
  name: string
  description: string
  website: string
  logoFile: File | null
  logoUrl: string
  coverageAreas: string
  specialisms: string[]
  directAgents: Array<{
    email: string
    name: string
    phone: string
    role: 'admin' | 'member'
    headshotFile: File | null
    headshotUrl: string
  }>
  inviteAgents: Array<{
    email: string
    name: string
    role: 'admin' | 'member'
  }>
}

interface BasicInfoStepProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
  errors: string[]
}

export function BasicInfoStep({ data, updateData, errors }: BasicInfoStepProps) {
  const [nameCheckStatus, setNameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [nameCheckTimer, setNameCheckTimer] = useState<NodeJS.Timeout | null>(null)

  const checkNameAvailability = async (name: string) => {
    if (name.length < 2) {
      setNameCheckStatus('idle')
      return
    }

    setNameCheckStatus('checking')

    try {
      const response = await fetch('/api/agencies/check-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })

      if (response.ok) {
        const result = await response.json()
        setNameCheckStatus(result.available ? 'available' : 'taken')
      } else {
        setNameCheckStatus('idle')
      }
    } catch (error) {
      console.error('Name check error:', error)
      setNameCheckStatus('idle')
    }
  }

  const handleNameChange = (value: string) => {
    updateData({ name: value })
    
    // Clear existing timer
    if (nameCheckTimer) {
      clearTimeout(nameCheckTimer)
    }

    // Reset status immediately
    setNameCheckStatus('idle')

    // Set new timer for debounced check
    if (value.length >= 2) {
      const timer = setTimeout(() => {
        checkNameAvailability(value)
      }, 500) // 500ms debounce
      setNameCheckTimer(timer)
    }
  }

  const handleWebsiteChange = (value: string) => {
    let processedUrl = value.trim()
    
    // Auto-add https:// if no protocol specified
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = `https://${processedUrl}`
    }
    
    updateData({ website: processedUrl })
  }

  const getNameInputStatus = () => {
    if (errors.some(error => error.includes('name'))) return 'error'
    if (nameCheckStatus === 'available') return 'success'
    if (nameCheckStatus === 'taken') return 'error'
    return 'default'
  }

  const getNameHelperText = () => {
    if (errors.some(error => error.includes('name'))) {
      return errors.find(error => error.includes('name'))
    }
    if (nameCheckStatus === 'checking') return 'Checking availability...'
    if (nameCheckStatus === 'available') return 'Great! This name is available.'
    if (nameCheckStatus === 'taken') return 'This name is already taken. Please try another.'
    return 'This will be your public agency name'
  }

  const getNameInputIcon = () => {
    if (nameCheckStatus === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
    if (nameCheckStatus === 'available') return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (nameCheckStatus === 'taken') return <AlertCircle className="h-4 w-4 text-red-500" />
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Basic Information
        </h3>
        <p className="text-gray-600">
          Let's start with the essential details about your agency.
        </p>
      </div>

      {/* Agency Name */}
      <div className="space-y-2">
        <Label htmlFor="agency-name" className="text-sm font-medium text-gray-700">
          Agency Name *
        </Label>
        <div className="relative">
          <Input
            id="agency-name"
            type="text"
            value={data.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter your agency name"
            className={`pr-10 ${
              getNameInputStatus() === 'error' 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : getNameInputStatus() === 'success'
                  ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                  : ''
            }`}
            maxLength={100}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getNameInputIcon()}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <p className={`text-xs ${
            getNameInputStatus() === 'error' 
              ? 'text-red-600' 
              : getNameInputStatus() === 'success'
                ? 'text-green-600'
                : 'text-gray-500'
          }`}>
            {getNameHelperText()}
          </p>
          <p className="text-xs text-gray-400">
            {data.name.length}/100
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="agency-description" className="text-sm font-medium text-gray-700">
          Agency Description
        </Label>
        <Textarea
          id="agency-description"
          value={data.description}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="Tell potential clients about your agency, your approach, and what makes you unique..."
          rows={4}
          maxLength={1000}
          className="resize-none"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Optional - This will appear on your agency profile
          </p>
          <div className="flex items-center space-x-2">
            <div className={`h-1 w-16 rounded-full bg-gray-200 overflow-hidden ${
              data.description.length > 800 ? 'bg-orange-200' : ''
            }`}>
              <div 
                className={`h-full transition-all duration-300 ${
                  data.description.length > 900 
                    ? 'bg-red-500' 
                    : data.description.length > 800 
                      ? 'bg-orange-500' 
                      : 'bg-blue-500'
                }`}
                style={{ width: `${(data.description.length / 1000) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {data.description.length}/1000
            </p>
          </div>
        </div>
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="agency-website" className="text-sm font-medium text-gray-700">
          Website URL
        </Label>
        <Input
          id="agency-website"
          type="url"
          value={data.website}
          onChange={(e) => handleWebsiteChange(e.target.value)}
          placeholder="www.youragency.com"
          className={errors.some(error => error.includes('website')) ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
        />
        <div className="flex items-center space-x-2">
          <p className="text-xs text-gray-500">
            Optional - Your agency website (https:// will be added automatically)
          </p>
          {data.website && !errors.some(error => error.includes('website')) && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
        </div>
        {errors.some(error => error.includes('website')) && (
          <p className="text-xs text-red-600">
            {errors.find(error => error.includes('website'))}
          </p>
        )}
      </div>

    </div>
  )
}