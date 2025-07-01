#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://***REMOVED***.supabase.co'
const serviceRoleKey = '***REMOVED***'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function testAdminAccess() {
  console.log('🧪 Testing RLS policy fix...\n')
  
  try {
    // Check the admin user's JWT claims
    console.log('1. Checking admin user JWT claims...')
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError) {
      console.error('❌ Error listing users:', usersError)
      return
    }
    
    const adminUser = users.users.find(u => u.email === 'dovet@live.com')
    if (adminUser) {
      console.log('✅ Admin user found:', adminUser.email)
      console.log('   App metadata:', adminUser.app_metadata)
      console.log('   User metadata:', adminUser.user_metadata)
      
      if (adminUser.app_metadata?.role === 'admin') {
        console.log('✅ Admin role is set in JWT claims')
      } else {
        console.log('⚠️  Admin role not set in JWT claims - updating...')
        
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
          app_metadata: {
            role: 'admin',
            email: adminUser.email
          }
        })
        
        if (updateError) {
          console.error('❌ Failed to update admin metadata:', updateError)
        } else {
          console.log('✅ Admin metadata updated')
        }
      }
    } else {
      console.log('❌ Admin user not found')
      return
    }
    
    console.log('\n2. Testing RLS policies with service role...')
    
    // Test users table access
    const { data: allUsers, error: allUsersError } = await supabaseAdmin
      .from('users')
      .select('*')
    
    if (allUsersError) {
      console.error('❌ Error accessing users table:', allUsersError)
    } else {
      console.log(`✅ Users table accessible - found ${allUsers.length} users`)
    }
    
    // Test organizations table access
    const { data: allOrgs, error: allOrgsError } = await supabaseAdmin
      .from('organisations')  
      .select('*')
    
    if (allOrgsError) {
      console.error('❌ Error accessing organisations table:', allOrgsError)
    } else {
      console.log(`✅ Organisations table accessible - found ${allOrgs.length} organizations`)
    }
    
    console.log('\n🎉 RLS policy test completed!')
    console.log('\n💡 Next step: Test with actual admin user session in the app')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testAdminAccess()