'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'

// After the trial flow (docs/design_handoff_homepage_trial, trial-07): a banner with the days
// left while trialing, and a one-off tip beside the rail on arrival (?welcome=trial).

const DAY_MS = 24 * 60 * 60 * 1000

export function TrialBanner() {
  const { isTrialing, trialEndDate } = useSubscriptionTier()
  if (!isTrialing || !trialEndDate) return null
  const days = Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / DAY_MS))
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#EAE3FF] bg-sm-violet-tint-soft px-8 py-2.5 text-[13px] font-medium text-sm-violet-deep max-md:px-4">
      <span>
        <b className="font-semibold">Free trial</b> · {days} {days === 1 ? 'day' : 'days'} left
      </span>
      <Link href="/account/billing" className="text-sm-violet hover:text-sm-violet-deep">
        Choose a plan
      </Link>
    </div>
  )
}

export function TrialWelcomeTip() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('welcome') !== 'trial') return
    url.searchParams.delete('welcome')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    const t = setTimeout(() => setShow(true), 700)
    return () => clearTimeout(t)
  }, [])

  if (!show) return null
  return (
    <div
      role="dialog"
      aria-label="Your trial includes every tool"
      className="fixed left-[92px] top-[120px] z-40 w-[300px] rounded-[14px] bg-sm-ink p-[18px] text-white shadow-[0_20px_40px_-16px_rgba(0,0,0,0.4)] motion-safe:animate-[sm-pop_.3s_ease] before:absolute before:-left-1.5 before:top-6 before:h-3 before:w-3 before:rotate-45 before:bg-sm-ink max-md:hidden"
    >
      <h4 className="text-[15px] font-semibold">Your trial includes every tool</h4>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-white/75">
        Check the catchment in Assess, find where brands are missing in Gaps, and test a layout in Sketch.
      </p>
      <button
        type="button"
        onClick={() => setShow(false)}
        className="mt-3 rounded-lg bg-sm-violet px-3 py-2 text-[13px] font-semibold text-white hover:bg-sm-violet-deep"
      >
        Got it
      </button>
    </div>
  )
}
