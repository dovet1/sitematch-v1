'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { createClientClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

export function DevLogin() {
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('testpassword123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useAuth()
  const supabase = createClientClient()

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        setError(error.message)
      } else {
        console.log('Dev login successful:', data)
        await refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <Card className="p-4 max-w-md mx-auto mt-8">
      <h3 className="text-lg font-semibold mb-4">🔧 Dev Login</h3>
      <form onSubmit={handleDevLogin} className="space-y-4">
        <div>
          <Label htmlFor="dev-email">Email</Label>
          <Input
            id="dev-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <Label htmlFor="dev-password">Password</Label>
          <Input
            id="dev-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in...' : 'Dev Sign In'}
        </Button>
      </form>
    </Card>
  )
}