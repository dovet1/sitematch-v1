'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'
import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { TrialModal } from '@/components/trial/TrialModal'
import { ENTERPRISE_FEATURES, PRO_FEATURES } from '@/data/homepage-bm/content'
import { parseProPlan, PRO_PLANS, type ProPlan } from '@/lib/pro-plan'
import { workspaceHref } from '@/lib/brand-matcher-link'
import { Check, Eyebrow, H2, SECTION } from './ui'

// "One plan. Or one built for you." The Pro CTA opens the trial flow with the chosen billing
// period preselected on the card step. Also used by /pricing.
export function Pricing({ id = 'pricing' }: { id?: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const { hasPlusAccess } = useSubscriptionTier()
  const [plan, setPlan] = useState<ProPlan>('monthly')
  const [modal, setModal] = useState<null | 'account' | 'card'>(null)

  // Back from Google / Microsoft sign-in, started here: reopen on the card step.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('trial') !== 'card' || !user) return
    setPlan(parseProPlan(q.get('plan')))
    setModal('card')
    q.delete('trial')
    q.delete('plan')
    window.history.replaceState(null, '', `${window.location.pathname}${q.size ? `?${q}` : ''}#${id}`)
  }, [user, id])

  const done = useCallback(() => router.push(workspaceHref(null, { welcome: 'trial' })), [router])
  const annual = plan === 'annual'
  const P = PRO_PLANS[plan]

  return (
    <section id={id} className={`${SECTION} text-center`}>
      <RevealWrapper>
        <Eyebrow>Pricing</Eyebrow>
        <h2 className={H2}>One plan. Or one built for you.</h2>
        <div role="tablist" className="mt-7 inline-flex gap-1 rounded-full border border-sm-border bg-sm-surface p-1">
          {(['monthly', 'annual'] as ProPlan[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={plan === p}
              onClick={() => setPlan(p)}
              className={
                'inline-flex items-center gap-2 rounded-full px-[18px] py-[9px] text-[14px] font-semibold ' +
                (plan === p ? 'bg-sm-ink text-white' : 'text-sm-ink2')
              }
            >
              {PRO_PLANS[p].label}
              {p === 'annual' && (
                <span className="rounded-full bg-[#E9F7EE] px-[7px] py-0.5 text-[11px] font-semibold text-[#2F855A]">2 months free</span>
              )}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-7 grid max-w-[920px] grid-cols-2 gap-[18px] text-left max-md:grid-cols-1 max-md:gap-3.5">
          <div className="flex flex-col rounded-[18px] border border-sm-border bg-sm-surface p-9 text-sm-ink max-md:p-[26px]">
            <div className="text-[18px] font-semibold">Pro</div>
            <div className="mt-0.5 text-[14px] text-sm-ink3">For agents &amp; landlords</div>
            <div className="mt-[26px] flex items-baseline gap-1.5">
              <span className="text-[52px] font-semibold tracking-[-0.035em]">{P.price}</span>
              <span className="text-[15px] text-sm-ink3">{P.per} per person</span>
            </div>
            <div className="mt-1.5 text-[13px] text-sm-ink3">
              {annual ? 'Works out at £166/month · 14-day free trial' : '14-day free trial'}
            </div>
            {hasPlusAccess ? (
              <Link href={workspaceHref(null)} className={`${BTN} mt-[22px] bg-sm-violet text-white hover:bg-sm-violet-deep`}>
                Open SiteMatcher
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setModal(user ? 'card' : 'account')}
                className={`${BTN} mt-[22px] bg-sm-violet text-white hover:bg-sm-violet-deep`}
              >
                Start 14-day free trial
              </button>
            )}
            <ul className="mt-[22px] flex flex-col gap-[11px]">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[15px] leading-[1.45]">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col rounded-[18px] bg-sm-ink p-9 text-white max-md:p-[26px]">
            <div className="text-[18px] font-semibold">Enterprise</div>
            <div className="mt-0.5 text-[14px] text-white/65">For teams and portfolios</div>
            <div className="mt-[26px] flex items-baseline gap-1.5">
              <span className="text-[52px] font-semibold tracking-[-0.035em]">Custom</span>
            </div>
            <a href="mailto:rob@sitematcher.co.uk?subject=SiteMatcher%20Enterprise" className={`${BTN} mt-[22px] bg-white text-sm-ink hover:bg-white/90`}>
              Talk to us
            </a>
            <div className="mt-[22px] text-[13px] font-medium text-white/70">Everything in Pro, plus</div>
            <ul className="mt-3 flex flex-col gap-[11px]">
              {ENTERPRISE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[15px] leading-[1.45]">
                  <Check color="#B9A0FF" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6 text-[13px] text-sm-ink3">Occupiers can post requirements free, forever.</div>
      </RevealWrapper>
      <TrialModal
        open={modal !== null}
        initialStep={modal ?? 'account'}
        initialPlan={plan}
        onClose={() => setModal(null)}
        onSuccess={done}
      />
    </section>
  )
}

const BTN =
  'inline-flex items-center justify-center rounded-sm-btn px-5 py-[13px] text-[15px] font-medium tracking-[-0.1px] transition-colors'
