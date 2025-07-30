#!/usr/bin/env node

// Simple script to create a test user via Supabase Admin API
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://nunvbolbcekvtlwuacul.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bnZib2xiY2VrdnRsd3VhY3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTI5MTU2NCwiZXhwIjoyMDY2ODY3NTY0fQ.70iWlz51R6-OHAcNwMVqGapMG8Z7Tq2CIRJ9q1e21lY'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestUser() {
  const testEmail = 'test@example.com'
  const testPassword = 'testpassword123'
  
  try {
    console.log('Creating test user...')
    
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      user_metadata: { name: 'Test User' },
      email_confirm: true // Auto-confirm email
    })
    
    if (authError) {
      console.error('Error creating auth user:', authError)
      return
    }
    
    console.log('Auth user created:', authData.user.id)
    
    // Create user profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: testEmail,
        role: 'admin', // Make them admin for testing
        org_id: null
      })
      .select()
      .single()
    
    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return
    }
    
    console.log('User profile created:', profileData)
    console.log('✅ Test user created successfully!')
    console.log(`📧 Email: ${testEmail}`)
    console.log(`🔑 Password: ${testPassword}`)
    console.log(`👤 Role: admin`)
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

createTestUser()