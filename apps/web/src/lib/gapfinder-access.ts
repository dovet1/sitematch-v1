import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkSubscriptionAccess } from '@/lib/subscription'

type GapFinderAccessGranted = {
  authorized: true
  supabase: Awaited<ReturnType<typeof createServerClient>>
  userId: string
}

type GapFinderAccessDenied = {
  authorized: false
  response: NextResponse
}

export type GapFinderAccessResult = GapFinderAccessGranted | GapFinderAccessDenied

export async function requireGapFinderAccess(): Promise<GapFinderAccessResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  const hasAccess = await checkSubscriptionAccess(user.id)

  if (!hasAccess) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Subscription required' },
        { status: 403 }
      ),
    }
  }

  return {
    authorized: true,
    supabase,
    userId: user.id,
  }
}
