'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Loader2, Globe, Building2, FileText } from 'lucide-react'

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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 mb-4">
          <Building2 className="w-7 h-7 text-violet-600" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Tell us about your agency
        </h3>
        <p className="text-gray-600 max-w-2xl">
          Start with the foundation. These details will help property seekers and partners identify your agency.
        </p>
      </div>

      {/* Form Fields Container */}
      <div className="space-y-6">
        {/* Agency Name - Premium */}
        <div className="group">
          <div className="flex items-center justify-between mb-3">
            <Label htmlFor="agency-name" className="text-sm font-semibold text-gray-900">
              Agency Name
            </Label>
            <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">Required</span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <Building2 className="w-5 h-5 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
            </div>
            <Input
              id="agency-name"
              type="text"
              value={data.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Premier Property Partners"
              className={`pl-11 pr-12 py-3 text-base rounded-xl border-2 transition-all duration-200 ${
                getNameInputStatus() === 'error' 
                  ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : getNameInputStatus() === 'success'
                    ? 'border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                    : 'border-gray-200 hover:border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
              }`}
              maxLength={100}
              required
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {getNameInputIcon()}
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className={`text-xs flex items-center gap-1.5 ${
              getNameInputStatus() === 'error' ? 'text-red-600' : 
              getNameInputStatus() === 'success' ? 'text-green-600' : 
              nameCheckStatus === 'checking' ? 'text-gray-500' :
              'text-gray-500'
            }`}>
              {nameCheckStatus === 'checking' && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {getNameHelperText()}
            </p>
            <span className="text-xs text-gray-400">
              {data.name.length}/100
            </span>
          </div>
        </div>

        {/* Description - Premium */}
        <div className="group">
          <div className="flex items-center justify-between mb-3">
            <Label htmlFor="agency-description" className="text-sm font-semibold text-gray-900">
              Description
            </Label>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <div className="relative">
            <div className="absolute top-3 left-4 pointer-events-none">
              <FileText className="w-5 h-5 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
            </div>
            <Textarea
              id="agency-description"
              value={data.description}
              onChange={(e) => updateData({ description: e.target.value })}
              placeholder="Share your agency's story, expertise, and unique value proposition. What makes you the perfect partner for property seekers?"
              rows={5}
              maxLength={500}
              className="pl-11 pr-4 py-3 resize-none rounded-xl border-2 border-gray-200 hover:border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all duration-200 text-base"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">
              A compelling description helps build trust with potential clients
            </p>
            <span className="text-xs text-gray-400">
              {data.description.length}/500
            </span>
          </div>
        </div>

        {/* Website - Premium */}
        <div className="group">
          <div className="flex items-center justify-between mb-3">
            <Label htmlFor="agency-website" className="text-sm font-semibold text-gray-900">
              Website
            </Label>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <Globe className="w-5 h-5 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
            </div>
            <Input
              id="agency-website"
              type="url"
              value={data.website}
              onChange={(e) => handleWebsiteChange(e.target.value)}
              placeholder="https://www.youragency.com"
              className={`pl-11 pr-4 py-3 text-base rounded-xl border-2 transition-all duration-200 ${
                errors.some(error => error.includes('website')) 
                  ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-200 hover:border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
              }`}
            />
          </div>
          {errors.some(error => error.includes('website')) ? (
            <p className="text-xs text-red-600 flex items-center gap-1.5 mt-2">
              <AlertCircle className="w-3 h-3" />
              {errors.find(error => error.includes('website'))}
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-2">
              Help clients learn more about your services
            </p>
          )}
        </div>
      </div>

      {/* Success Message - Premium */}
      {data.name && nameCheckStatus === 'available' && (
        <div className="relative overflow-hidden rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
          <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-16 -translate-y-8">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-2xl" />
          </div>
          <div className="relative flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Perfect! Your agency name is available.</p>
              <p className="text-sm text-green-700 mt-1">You're ready to proceed to the next step.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}