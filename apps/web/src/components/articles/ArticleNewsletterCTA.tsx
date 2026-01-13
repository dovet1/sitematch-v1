'use client'

import { useState } from 'react'
import { Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ArticleNewsletterCTAProps {
  compact?: boolean
}

export function ArticleNewsletterCTA({ compact = false }: ArticleNewsletterCTAProps) {
  const [email, setEmail] = useState('')
  const [persona, setPersona] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState('')

  const personaOptions = [
    { label: 'Commercial Occupier', value: 'commercial_occupier' },
    { label: 'Landlord/Developer', value: 'landlord_developer' },
    { label: 'Housebuilder', value: 'housebuilder' },
    { label: 'Agent', value: 'agent' },
    { label: 'Government', value: 'government' },
    { label: 'Other', value: 'other' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, persona })
      })

      if (response.ok) {
        setIsSubscribed(true)
        setEmail('')
        setPersona('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to subscribe')
      }
    } catch (err) {
      setError('Failed to subscribe. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubscribed) {
    return (
      <div className={cn(
        'bg-green-50 border-2 border-green-200 rounded-3xl text-center',
        compact ? 'p-6' : 'p-8 md:p-12'
      )}>
        <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-600 mx-auto mb-4" />
        <h3 className="heading-3 text-green-800 mb-2">Successfully Subscribed!</h3>
        <p className="body-base text-green-600">
          You'll receive the latest articles and insights in your inbox.
        </p>
      </div>
    )
  }

  return (
    <div className={cn(
      'bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl text-white shadow-2xl',
      compact ? 'p-6 md:p-8' : 'p-8 md:p-12'
    )}>
      <div className="max-w-2xl mx-auto text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-2xl mb-6 backdrop-blur-sm">
          <Mail className="w-8 h-8 md:w-10 md:h-10 text-white" />
        </div>

        {/* Title */}
        <h3 className={cn(
          'font-bold text-white mb-4',
          compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'
        )}>
          Stay Updated with Property Insights
        </h3>

        {/* Description */}
        <p className={cn(
          'text-white/90 mb-8',
          compact ? 'text-base' : 'text-lg'
        )}>
          Get the latest articles, market trends, and expert analysis delivered to your inbox.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full px-6 py-4 rounded-xl text-gray-900 focus:ring-4 focus:ring-white/30 focus:outline-none disabled:opacity-50 text-lg"
            />
          </div>

          {/* Persona Selection */}
          {!compact && (
            <div>
              <label className="block text-sm font-medium text-white/90 mb-3 text-left">
                What best describes you?
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {personaOptions.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center justify-center px-4 py-3 rounded-xl cursor-pointer transition-all',
                      'border-2',
                      persona === option.value
                        ? 'bg-white text-violet-700 border-white'
                        : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
                    )}
                  >
                    <input
                      type="radio"
                      name="persona"
                      value={option.value}
                      checked={persona === option.value}
                      onChange={(e) => setPersona(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Compact persona dropdown */}
          {compact && (
            <div>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-6 py-4 rounded-xl text-gray-900 focus:ring-4 focus:ring-white/30 focus:outline-none disabled:opacity-50 text-lg"
              >
                <option value="">Select your role...</option>
                {personaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-200 bg-red-900/30 rounded-lg p-3">
              {error}
            </p>
          )}

          {/* Privacy Checkbox */}
          <div className="text-xs text-white/80 text-left">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                required
                disabled={isSubmitting}
                className="mt-1"
              />
              <span>
                I agree to receive marketing emails and acknowledge the{' '}
                <a
                  href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c"
                  className="text-white hover:underline font-semibold"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  privacy policy
                </a>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-violet-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-6 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isSubmitting ? 'Subscribing...' : 'Subscribe to Newsletter'}
          </Button>
        </form>
      </div>
    </div>
  )
}
