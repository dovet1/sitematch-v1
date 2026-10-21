import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { checkPlusAccess } from '@/lib/gapfinder-access'
import { isBrandMatcherEnabled, isUnifiedWorkspaceEnabled } from '@/lib/feature-flags'
import { readSiteParams, workspaceHref } from '@/lib/brand-matcher-link'
import { BrandMatcherPreview } from './BrandMatcherPreview'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Brand Matcher',
  robots: { index: false, follow: false },
}

// Where the homepage search lands (docs/design_handoff_homepage_trial). Members go straight on
// to Brand Matcher in the workspace; everyone else sees the gated preview and the trial flow.
export default async function BrandMatcherPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isBrandMatcherEnabled()) || !(await isUnifiedWorkspaceEnabled())) notFound()

  const params = await searchParams
  const user = await getCurrentUser()
  if (user && (await checkPlusAccess(user.id))) {
    redirect(workspaceHref(readSiteParams(params)))
  }

  return (
    <Suspense fallback={null}>
      <BrandMatcherPreview />
    </Suspense>
  )
}
