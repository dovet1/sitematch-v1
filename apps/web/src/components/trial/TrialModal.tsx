'use client'

import { useEffect, useMemo, useState } from 'react'
import { Elements, CardCvcElement, CardExpiryElement, CardNumberElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripeCardElementOptions } from '@stripe/stripe-js'
import { useAuth } from '@/contexts/auth-context'
import { getStripeJs } from '@/lib/stripe-client'
import {
  PRO_PLANS,
  formatLongDate,
  formatShortDate,
  trialEndDate,
  type ProPlan,
} from '@/lib/pro-plan'
import { CheckIcon, CloseIcon, Kicker, TRIAL_TOOLS, ToolIcon } from './trial-ui'

// The two-step Start free trial flow (docs/design_handoff_homepage_trial, trial-03 to trial-06):
// 1. account (Google / Microsoft / work email), 2. plan + card via Stripe Elements, then a
// short "You're in." before the caller unlocks. Card details never touch our servers: the card
// form confirms a SetupIntent, then /api/stripe/trial/start opens the subscription on a trial.

export interface TrialGateCopy {
  title: string
  body: string
}

export const DEFAULT_GATE_COPY: TrialGateCopy = {
  title: 'Start your free 14-day trial',
  body: 'See every brand ranked for your site, with the people who handle property at each one.',
}

const MICROSOFT_ENABLED = process.env.NEXT_PUBLIC_MICROSOFT_OAUTH_ENABLED === 'true'

// Where OAuth should bring the visitor back to: the same page, reopened on the card step.
export function trialReturnPath(plan: ProPlan): string {
  if (typeof window === 'undefined') return '/'
  const url = new URL(window.location.href)
  url.searchParams.set('trial', 'card')
  url.searchParams.set('plan', plan)
  return `${url.pathname}?${url.searchParams.toString()}`
}

// ---------------------------------------------------------------------------
// Step 1: account. Also used inline in the preview's sign-up card.

export function AccountStep({
  copy,
  plan,
  onDone,
  kicker = 'Free 14-day trial',
}: {
  copy: TrialGateCopy
  plan: ProPlan
  onDone: () => void
  kicker?: string
}) {
  const { user, signUp, signIn, signUpWithOAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // 'email' until an address is entered; then a password, to create the account or sign in.
  const [stage, setStage] = useState<'email' | 'create' | 'signin'>('email')
  const [busy, setBusy] = useState<null | 'google' | 'microsoft' | 'email'>(null)
  const [error, setError] = useState<string | null>(null)

  const oauth = async (provider: 'google' | 'microsoft') => {
    setError(null)
    setBusy(provider)
    try {
      await signUpWithOAuth(provider, trialReturnPath(plan))
    } catch (e) {
      setBusy(null)
      setError(e instanceof Error ? e.message : 'Could not continue. Please try again.')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (stage === 'email') {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter your work email')
      setStage('create')
      return
    }
    if (password.length < 8 && stage === 'create') return setError('Use at least 8 characters')
    setBusy('email')
    try {
      if (stage === 'create') await signUp(email.trim(), password, 'SKIP_REDIRECT')
      else await signIn(email.trim(), password, 'SKIP_REDIRECT')
      onDone()
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (stage === 'create' && /already|registered|exists|invalid login/i.test(message)) {
        setStage('signin')
        setError('You already have an account. Enter your password to sign in.')
      } else {
        setError(stage === 'signin' ? 'That email and password don’t match.' : message || 'Could not create your account.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Kicker>{kicker}</Kicker>
      <h3 className="mt-3 text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-sm-ink [text-wrap:balance]">
        {copy.title}
      </h3>
      <p className="mt-2 text-[14.5px] leading-[1.5] text-sm-ink2 [text-wrap:pretty]">{copy.body}</p>
      <ul className="mt-4 grid gap-2">
        {['Every brand name, ranked by fit', 'Property contacts and agents for each brand', 'Export the list as a spreadsheet'].map(
          (t) => (
            <li key={t} className="flex items-center gap-[9px] text-[14px] text-sm-ink">
              <CheckIcon />
              {t}
            </li>
          )
        )}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#F1EFF4] pt-3.5">
        <span className="text-[12px] text-sm-ink3">Also included</span>
        <div className="flex flex-wrap gap-1.5">
          {TRIAL_TOOLS.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-[5px] rounded-full bg-sm-violet-tint-soft py-1 pl-1.5 pr-[9px] text-[12px] font-medium text-sm-violet-deep"
            >
              <ToolIcon tool={t} color="#5421CC" size={15} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {user ? (
        <div className="mt-5">
          <p className="text-[13px] text-sm-ink2">
            Signed in as <span className="font-semibold text-sm-ink">{user.email}</span>
          </p>
          <button type="button" onClick={onDone} className={`${BTN_PRIMARY} mt-3 h-11 w-full justify-center`}>
            Continue
          </button>
        </div>
      ) : (
        <>
          <div className={`mt-5 grid gap-2 ${MICROSOFT_ENABLED ? 'grid-cols-2 max-sm:grid-cols-1' : 'grid-cols-1'}`}>
            <button type="button" onClick={() => oauth('google')} disabled={busy !== null} className={BTN_GHOST}>
              <GoogleMark />
              {busy === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>
            {MICROSOFT_ENABLED && (
              <button type="button" onClick={() => oauth('microsoft')} disabled={busy !== null} className={BTN_GHOST}>
                <MicrosoftMark />
                {busy === 'microsoft' ? 'Redirecting…' : 'Continue with Microsoft'}
              </button>
            )}
          </div>
          <div className="my-3.5 flex items-center gap-2.5 text-[12px] text-sm-ink3 before:h-px before:flex-1 before:bg-[#EFEDF2] after:h-px after:flex-1 after:bg-[#EFEDF2]">
            or with your work email
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2">
            <div className="flex gap-2 max-sm:flex-col">
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (stage !== 'email') setStage('email')
                }}
                placeholder="you@agency.co.uk"
                aria-label="Work email"
                className={INPUT}
              />
              {stage === 'email' && (
                <button type="submit" className={`${BTN_PRIMARY} h-11 px-4`}>
                  Continue
                </button>
              )}
            </div>
            {stage !== 'email' && (
              <div className="flex gap-2 max-sm:flex-col">
                <input
                  type="password"
                  autoFocus
                  autoComplete={stage === 'create' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={stage === 'create' ? 'Create a password' : 'Password'}
                  aria-label={stage === 'create' ? 'Create a password' : 'Password'}
                  className={INPUT}
                />
                <button type="submit" disabled={busy !== null} className={`${BTN_PRIMARY} h-11 px-4`}>
                  {busy === 'email' ? 'One moment…' : stage === 'create' ? 'Continue' : 'Sign in'}
                </button>
              </div>
            )}
          </form>
        </>
      )}
      {error && <p className="mt-2.5 text-[13px] text-[#A33A35]">{error}</p>}
      <div className="mt-3 flex flex-wrap justify-between gap-2.5 text-[12px] leading-[1.5] text-sm-ink3">
        <span>
          Step 1 of 2. 14 days free, card required. Then £199/month, or £1,990/year with 2 months free. Cancel any time
          before day 14.
        </span>
        {!user && (
          <span>
            Have an account?{' '}
            <button
              type="button"
              className="font-medium text-sm-violet hover:text-sm-violet-deep"
              onClick={() => {
                setStage('signin')
                setError(null)
              }}
            >
              Sign in
            </button>
          </span>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Step 2: plan and card.

const CARD_STYLE: StripeCardElementOptions['style'] = {
  base: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    color: '#171419',
    '::placeholder': { color: '#7C7588' },
  },
  invalid: { color: '#A33A35' },
}

function CardStep({
  plan,
  onPlan,
  onBack,
  onDone,
}: {
  plan: ProPlan
  onPlan: (p: ProPlan) => void
  onBack: () => void
  onDone: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { user } = useAuth()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadySubscribed, setAlreadySubscribed] = useState(false)
  const firstCharge = useMemo(() => trialEndDate(), [])
  const P = PRO_PLANS[plan]

  useEffect(() => {
    let cancelled = false
    fetch('/api/stripe/trial/setup-intent', { method: 'POST' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { clientSecret?: string; error?: string; code?: string } | null
        if (cancelled) return
        if (res.ok && body?.clientSecret) setClientSecret(body.clientSecret)
        else if (body?.code === 'already_subscribed') setAlreadySubscribed(true)
        else setError(body?.error ?? 'Could not load the card form. Please try again.')
      })
      .catch(() => !cancelled && setError('Could not load the card form. Please try again.'))
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return
    const card = elements.getElement(CardNumberElement)
    if (!card) return
    if (!name.trim()) return setError('Enter the name on the card')
    setBusy(true)
    setError(null)
    try {
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card, billing_details: { name: name.trim(), email: user?.email ?? undefined } },
      })
      if (stripeError || !setupIntent) throw new Error(stripeError?.message ?? 'Your card could not be confirmed.')
      const res = await fetch('/api/stripe/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: setupIntent.id, plan }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(body?.error ?? 'Could not start your trial.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start your trial.')
      setBusy(false)
    }
  }

  if (alreadySubscribed) {
    return (
      <>
        <Kicker>Step 2 of 2 · Start your trial</Kicker>
        <h3 className="mt-3 text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-sm-ink">You already have a plan.</h3>
        <p className="mt-2 text-[14.5px] leading-[1.5] text-sm-ink2">Your account is already subscribed, so there’s nothing to add.</p>
        <button type="button" onClick={onDone} className={`${BTN_PRIMARY} mt-[18px] w-full justify-center py-[13px] text-[15px]`}>
          Continue
        </button>
      </>
    )
  }

  return (
    <>
      <Kicker>Step 2 of 2 · Start your trial</Kicker>
      <h3 className="mt-3 text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-sm-ink [text-wrap:balance]">
        Add a card to unlock the full list.
      </h3>
      <p className="mt-2 text-[14.5px] leading-[1.5] text-sm-ink2 [text-wrap:pretty]">
        Nothing is charged today. Your first payment is taken on day 14, {formatLongDate(firstCharge)}. Cancel any time
        before then and you won&apos;t pay.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan">
        {(Object.keys(PRO_PLANS) as ProPlan[]).map((k) => {
          const v = PRO_PLANS[k]
          const on = plan === k
          return (
            <button
              type="button"
              role="radio"
              aria-checked={on}
              key={k}
              onClick={() => onPlan(k)}
              className={
                'flex flex-col gap-[3px] rounded-xl border px-3.5 py-3 text-left transition-colors ' +
                (on ? 'border-sm-violet bg-sm-violet-tint-soft shadow-[0_0_0_1px_#7033FF]' : 'border-[#E3E0E8] bg-white hover:border-[#CFC6F0]')
              }
            >
              <span className="flex items-center justify-between gap-1.5 text-[13px] font-semibold text-sm-ink">
                {v.label}
                {k === 'annual' && (
                  <span className="whitespace-nowrap rounded-md bg-[#E9F7EE] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#2F855A]">
                    2 months free
                  </span>
                )}
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.2px] text-sm-ink">
                {v.price}
                {v.per}
              </span>
              <span className="text-[12px] text-sm-ink3">{v.note}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 rounded-xl border border-[#ECEAF0] bg-[#FAFAFB] px-3.5 py-1">
        <SummaryRow label={`Pro · ${P.label}`} value={`${P.price}${P.per}`} />
        <SummaryRow label="Due today" value="£0.00" bold />
        <SummaryRow label={`First charge · ${formatShortDate(firstCharge)}`} value={P.firstCharge} />
      </div>
      <form onSubmit={submit}>
        <label className={LABEL}>
          Card number
          <div className={FIELD}>
            <CardNumberElement options={{ style: CARD_STYLE, placeholder: '1234 1234 1234 1234', showIcon: false }} className="flex-1" />
            <span className="flex gap-1">
              {['VISA', 'MC', 'AMEX'].map((b) => (
                <i key={b} className="rounded border border-[#E3E0E8] px-1 py-0.5 text-[9px] font-bold not-italic text-sm-ink3">
                  {b}
                </i>
              ))}
            </span>
          </div>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className={LABEL}>
            Expiry
            <div className={FIELD}>
              <CardExpiryElement options={{ style: CARD_STYLE }} className="flex-1" />
            </div>
          </label>
          <label className={LABEL}>
            CVC
            <div className={FIELD}>
              <CardCvcElement options={{ style: CARD_STYLE, placeholder: '123' }} className="flex-1" />
            </div>
          </label>
        </div>
        <label className={LABEL}>
          Name on card
          <div className={FIELD}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="cc-name"
              placeholder="Full name"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-sm-ink outline-none placeholder:text-sm-ink3"
            />
          </div>
        </label>
        {error && <p className="mt-2.5 text-[13px] text-[#A33A35]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !stripe || !clientSecret}
          className={`${BTN_PRIMARY} mt-[18px] w-full justify-center py-[13px] text-[15px] disabled:opacity-60`}
        >
          {busy ? 'Starting your trial…' : 'Start free trial'}
        </button>
      </form>
      <div className="mt-3 text-[12px] leading-[1.5] text-sm-ink3">
        We&apos;ll email you a reminder before your trial ends. Payments secured by Stripe.
      </div>
      <div className="mt-1.5 text-[12px]">
        <button type="button" onClick={onBack} className="font-medium text-sm-violet hover:text-sm-violet-deep">
          ← Back
        </button>
      </div>
    </>
  )
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-[7px] text-[14px] [&+&]:border-t [&+&]:border-[#ECEAF0] ${bold ? 'font-semibold text-sm-ink' : 'text-sm-ink2'}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The modal.

export function TrialModal({
  open,
  initialStep = 'account',
  copy = DEFAULT_GATE_COPY,
  initialPlan = 'monthly',
  unlockLabel = 'Unlocking every tool…',
  onClose,
  onSuccess,
}: {
  open: boolean
  initialStep?: 'account' | 'card'
  copy?: TrialGateCopy
  initialPlan?: ProPlan
  unlockLabel?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'account' | 'card' | 'success'>(initialStep)
  const [plan, setPlan] = useState<ProPlan>(initialPlan)
  const stripePromise = useMemo(() => getStripeJs(), [])

  useEffect(() => {
    if (open) {
      setStep(initialStep)
      setPlan(initialPlan)
    }
  }, [open, initialStep, initialPlan])

  useEffect(() => {
    if (step !== 'success') return
    const t = setTimeout(onSuccess, 1100)
    return () => clearTimeout(t)
  }, [step, onSuccess])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && step !== 'success' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[rgba(23,20,25,0.45)] p-5 motion-safe:animate-[sm-fade_.2s_ease]"
      onClick={() => step !== 'success' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative m-auto w-full max-w-[480px] rounded-[20px] border border-[#E3E0E8] bg-white p-[30px] shadow-[0_30px_70px_-30px_rgba(20,10,40,0.4)] motion-safe:animate-[sm-pop_.25s_cubic-bezier(.22,1,.36,1)] max-sm:p-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sm-violet-tint">
              <CheckIcon size={24} />
            </div>
            <h3 className="text-[26px] font-semibold tracking-[-0.03em] text-sm-ink">You&apos;re in.</h3>
            <p className="text-[14.5px] text-sm-ink2">{unlockLabel}</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-[#E3E0E8] bg-white"
            >
              <CloseIcon />
            </button>
            {step === 'account' ? (
              <AccountStep copy={copy} plan={plan} onDone={() => setStep('card')} />
            ) : stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{ fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap' }] }}
              >
                <CardStep plan={plan} onPlan={setPlan} onBack={() => setStep('account')} onDone={() => setStep('success')} />
              </Elements>
            ) : (
              <p className="text-[14px] text-sm-ink2">Card payments aren&apos;t set up on this site yet. Please contact us.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const BTN_PRIMARY =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] border border-transparent bg-sm-violet text-[14px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:cursor-not-allowed'
const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#E3E0E8] bg-white px-4 py-2.5 text-[14px] font-medium text-sm-ink transition-colors hover:bg-[#FAF9FB] disabled:opacity-60'
const INPUT =
  'h-11 min-w-0 flex-1 rounded-[10px] border border-[#E3E0E8] px-3 text-[14px] text-sm-ink outline-none placeholder:text-sm-ink3 focus:border-sm-violet'
const LABEL = 'mt-2.5 block text-[13px] font-medium text-sm-ink2'
const FIELD =
  'mt-1.5 flex h-11 items-center gap-2 rounded-[10px] border border-[#E3E0E8] bg-white px-3 focus-within:border-sm-violet [&_.StripeElement--focus]:outline-none'

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M18.17 8.37h-.67v-.04H10v3.34h4.71A5 5 0 1110 5c1.27 0 2.43.48 3.32 1.27l2.35-2.36A8.33 8.33 0 1018.33 10c0-.56-.05-1.1-.16-1.63z" fill="#FFC107" />
      <path d="M2.63 6.12l2.74 2.01A5 5 0 0110 5c1.27 0 2.43.48 3.32 1.27l2.35-2.36A8.32 8.32 0 0010 1.67a8.33 8.33 0 00-7.37 4.45z" fill="#FF3D00" />
      <path d="M10 18.33c2.15 0 4.11-.82 5.59-2.16l-2.58-2.18A4.96 4.96 0 0110 15a5 5 0 01-4.7-3.31l-2.72 2.1A8.33 8.33 0 0010 18.33z" fill="#4CAF50" />
      <path d="M18.17 8.37h-.67v-.04H10v3.34h4.71a5.02 5.02 0 01-1.7 2.32l2.58 2.18c-.18.17 2.74-2 2.74-6.17 0-.56-.05-1.1-.16-1.63z" fill="#1976D2" />
    </svg>
  )
}

function MicrosoftMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <rect x="1" y="1" width="6.5" height="6.5" fill="#F25022" />
      <rect x="8.5" y="1" width="6.5" height="6.5" fill="#7FBA00" />
      <rect x="1" y="8.5" width="6.5" height="6.5" fill="#00A4EF" />
      <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFB900" />
    </svg>
  )
}
