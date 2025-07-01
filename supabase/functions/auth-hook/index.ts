import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Auth hook function started")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record, type, table } = await req.json()
    console.log(`Webhook received: ${type} on ${table}`, { record: record?.id })

    // Only process INSERT and UPDATE events on auth.users or public.users tables
    if (type !== 'INSERT' && type !== 'UPDATE') {
      console.log('Ignoring webhook type:', type)
      return new Response('OK')
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let userId: string
    let userProfile: any = null

    if (table === 'auth.users') {
      // Event from auth.users table (user signup/login)
      userId = record.id
      console.log('Processing auth.users event for user:', userId)
      
      // Fetch user profile from public.users table
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('role, org_id, email')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        // If profile doesn't exist yet, skip updating claims (will be handled by public.users webhook)
        return new Response('Profile not found, skipping claims update')
      }

      userProfile = profile
    } else if (table === 'public.users') {
      // Event from public.users table (profile updated)
      userId = record.id
      userProfile = record
      console.log('Processing public.users event for user:', userId)
    } else {
      console.log('Ignoring webhook from table:', table)
      return new Response('OK')
    }

    if (!userProfile) {
      console.log('No user profile found, skipping claims update')
      return new Response('No profile found')
    }

    // Update user metadata with custom claims
    console.log('Updating JWT claims for user:', userId, { role: userProfile.role, org_id: userProfile.org_id })
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: userProfile.role,
        org_id: userProfile.org_id,
        email: userProfile.email
      }
    })

    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      return new Response(`Error updating metadata: ${updateError.message}`, { 
        status: 500,
        headers: corsHeaders 
      })
    }

    console.log('Successfully updated JWT claims for user:', userId)
    return new Response('JWT claims updated successfully', { headers: corsHeaders })

  } catch (error) {
    console.error('Auth hook error:', error)
    return new Response(`Webhook error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    })
  }
})