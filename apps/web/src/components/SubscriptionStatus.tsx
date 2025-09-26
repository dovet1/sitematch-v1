'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, CreditCard, AlertCircle, CheckCircle } from 'lucide-react'

interface SubscriptionData {
  subscription: {
    status: string
    trial_start_date?: string
    trial_end_date?: string
    stripe_customer_id?: string
    stripe_subscription_id?: string
    payment_method_added: boolean
  }
  display: {
    status: string
    message: string
    daysRemaining?: number
  }
}

interface SubscriptionStatusProps {
  userId: string
}

export function SubscriptionStatus({ userId }: SubscriptionStatusProps) {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [managingSubscription, setManagingSubscription] = useState(false)

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [userId])

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/stripe/subscription-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        const data = await response.json()
        setSubscriptionData(data)
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!subscriptionData?.subscription.stripe_customer_id) {
      return
    }

    setManagingSubscription(true)
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
    } finally {
      setManagingSubscription(false)
    }
  }

  const getStatusBadge = () => {
    if (!subscriptionData) return null

    const { status } = subscriptionData.display

    switch (status) {
      case 'trial':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Free Trial</Badge>
      case 'active':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
      case 'expired':
      case 'canceled':
        return <Badge variant="destructive">Expired</Badge>
      case 'past_due':
        return <Badge variant="destructive">Payment Failed</Badge>
      default:
        return <Badge variant="outline">No Subscription</Badge>
    }
  }

  const getStatusIcon = () => {
    if (!subscriptionData) return null

    const { status } = subscriptionData.display

    switch (status) {
      case 'trial':
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'expired':
      case 'canceled':
      case 'past_due':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!subscriptionData) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Unable to load subscription status</p>
        </CardContent>
      </Card>
    )
  }

  const { subscription, display } = subscriptionData

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Subscription</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-start gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{display.message}</p>

            {display.status === 'trial' && subscription.trial_end_date && (
              <p className="text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3 inline mr-1" />
                Trial ends {new Date(subscription.trial_end_date).toLocaleDateString()}
              </p>
            )}

            {(display.status === 'expired' || display.status === 'canceled') && (
              <p className="text-xs text-muted-foreground mt-1">
                Start a subscription to access premium features
              </p>
            )}

            {display.status === 'past_due' && (
              <p className="text-xs text-muted-foreground mt-1">
                Update your payment method to restore access
              </p>
            )}
          </div>
        </div>

        {subscription.stripe_customer_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageSubscription}
            disabled={managingSubscription}
            className="mt-3 w-full"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {managingSubscription ? 'Loading...' : 'Manage Subscription'}
          </Button>
        )}

        {!subscription.stripe_customer_id && display.status !== 'active' && (
          <Button
            size="sm"
            onClick={() => window.location.href = '/pricing'}
            className="mt-3 w-full"
          >
            Start Free Trial
          </Button>
        )}
      </CardContent>
    </Card>
  )
}