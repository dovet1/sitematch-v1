'use client'

import { useState, useEffect } from 'react'
import { createClientClient } from '@/lib/supabase'

// MINIMAL test page - bypasses our auth context entirely
export default function TestResetPassword() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClientClient()
      
      console.log('Direct Supabase session check...')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      console.log('Session result:', { 
        hasSession: !!session, 
        hasUser: !!session?.user, 
        error: error?.message 
      })
      
      if (session?.user) {
        setUser(session.user)
        setMessage('✅ Session found! You can reset your password.')
      } else {
        setMessage('❌ No session found')
      }
      
      setLoading(false)
    }
    
    checkSession()
  }, [])

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    const supabase = createClientClient()
    
    const { error } = await supabase.auth.updateUser({
      password: password
    })
    
    if (error) {
      setMessage(`❌ Password update failed: ${error.message}`)
    } else {
      setMessage('✅ Password updated successfully!')
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2>Direct Supabase Test</h2>
      <p>{message}</p>
      
      {user && (
        <form onSubmit={handlePasswordUpdate}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', margin: '10px 0', padding: '8px' }}
          />
          <button type="submit" style={{ padding: '8px 16px' }}>
            Update Password
          </button>
        </form>
      )}
      
      <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '10px' }}>
        User: {user ? 'Found' : 'None'}
        <br />
        Email: {user?.email || 'N/A'}
      </pre>
    </div>
  )
}