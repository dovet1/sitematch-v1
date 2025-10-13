import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkSubscriptionAccess } from '@/lib/subscription'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Cannot set cookies in GET request
          },
          remove(name: string, options: any) {
            // Cannot remove cookies in GET request
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ hasAccess: false }, { status: 200 })
    }

    const hasAccess = await checkSubscriptionAccess(user.id)

    return NextResponse.json({ hasAccess }, { status: 200 })
  } catch (error) {
    console.error('Subscription check error:', error)
    return NextResponse.json(
      { hasAccess: false, error: 'Failed to check subscription' },
      { status: 500 }
    )
  }
}