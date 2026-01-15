'use client'

import { useState, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'

export function ArticleTopNewsletter() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Basic email validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          persona: 'other', // Default persona for newsletter signups
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to subscribe')
      }

      setIsSuccess(true)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-2 border-violet-200 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-center gap-3 text-violet-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="font-semibold">Thanks for subscribing! We'll keep you updated with our latest content.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-2 border-violet-200 rounded-2xl p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="hidden sm:flex w-10 h-10 rounded-full bg-violet-100 items-center justify-center flex-shrink-0 mt-1">
          <Mail className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <p className="text-gray-800 font-semibold mb-4">
            Want more content like this straight to your inbox (plus our latest site requirements)?
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="flex-1 bg-white border-2 border-violet-200 focus:border-violet-400 rounded-xl"
              required
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl px-6 whitespace-nowrap"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                'Subscribe'
              )}
            </Button>
          </form>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
          <p className="text-xs text-gray-600 mt-3">
            By subscribing, you agree to our{' '}
            <Link href="/privacy-policy" className="text-violet-600 hover:text-violet-700 underline font-semibold">
              Privacy Policy
            </Link>
            . We respect your privacy and will never share your information.
          </p>
        </div>
      </div>
    </div>
  )
}
