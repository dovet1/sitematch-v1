'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchLocations, type LocationResult } from '@/lib/mapbox'
import { extractPostcode, HOME_USE_CLASSES, previewHref, type HomeUseClass } from '@/lib/brand-matcher-link'

// The homepage's 4-part search (address, size, use class, submit), in the hero and, dark, in the
// final CTA band. Submitting opens Brand Matcher for the site: /brand-matcher sends members on to
// the workspace and shows everyone else the preview.

interface Suggestion {
  id: string
  label: string
  postcode: string | null
  center: [number, number]
}

function toSuggestion(f: LocationResult): Suggestion {
  const own = f.place_type.includes('postcode') ? extractPostcode(f.text) : null
  const ctx = f.context?.find((c) => c.id.startsWith('postcode'))
  return {
    id: f.id,
    label: f.place_name.replace(/, United Kingdom$/, ''),
    postcode: own ?? extractPostcode(f.place_name) ?? (ctx ? extractPostcode(ctx.text) : null),
    center: f.center,
  }
}

// Mapbox sometimes knows an address without its full postcode; postcodes.io fills it in.
async function nearestPostcode([lon, lat]: [number, number]): Promise<string | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1`)
    const body = (await res.json()) as { result?: { postcode: string }[] | null }
    return body.result?.[0]?.postcode ?? null
  } catch {
    return null
  }
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d="M8 14.5S3 9.8 3 6.5a5 5 0 0110 0c0 3.3-5 8-5 8z" stroke="#7C7588" strokeWidth="1.5" />
      <circle cx="8" cy="6.5" r="1.8" stroke="#7C7588" strokeWidth="1.5" />
    </svg>
  )
}

export function SiteSearch({ dark = false }: { dark?: boolean }) {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [sqft, setSqft] = useState('')
  const [useClass, setUseClass] = useState<HomeUseClass>('all')
  const [focus, setFocus] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [picked, setPicked] = useState<Suggestion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sizeRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const q = address.trim()
    if (q.length < 3 || picked?.label === address) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      searchLocations(q, { country: ['GB'], types: ['address', 'postcode', 'poi'], limit: 5 })
        .then((r) => !cancelled && setSuggestions(r.map(toSuggestion)))
        .catch(() => !cancelled && setSuggestions([]))
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [address, picked])

  const go = async (choice: Suggestion | null) => {
    setError(null)
    const text = (choice?.label ?? address).trim()
    if (!text) {
      addressRef.current?.focus()
      return setError('Enter the site address or postcode')
    }
    const size = Number(sqft.replace(/[^0-9]/g, ''))
    if (!size) {
      sizeRef.current?.focus()
      return setError('Add the unit size in sq ft')
    }
    setBusy(true)
    const fallback = choice ?? suggestions[0] ?? null
    let postcode = extractPostcode(text) ?? choice?.postcode ?? null
    if (!postcode && fallback) postcode = fallback.postcode ?? (await nearestPostcode(fallback.center))
    setBusy(false)
    if (!postcode) {
      addressRef.current?.focus()
      return setError('We couldn’t find a postcode for that address. Try adding it.')
    }
    router.push(previewHref({ site: choice?.label ?? text, postcode, sqft: size, useClass }))
  }

  const open = focus && address.trim().length > 0 && picked?.label !== address
  const divider = dark ? 'border-white/[0.14]' : 'border-sm-border'

  return (
    <form
      className="relative mx-auto mt-[34px] max-w-[820px] text-left"
      onSubmit={(e) => {
        e.preventDefault()
        setFocus(false)
        void go(picked)
      }}
    >
      <div
        className={
          'flex gap-2 rounded-[14px] border p-1.5 max-md:flex-col max-md:gap-0 max-md:p-2 ' +
          (dark
            ? 'border-white/[0.14] bg-white/[0.06]'
            : 'border-sm-border bg-sm-surface shadow-[0_10px_30px_-18px_rgba(20,10,40,0.25)]')
        }
      >
        <input
          ref={addressRef}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setPicked(null)
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 120)}
          placeholder="Site address or postcode"
          aria-label="Site address or postcode"
          autoComplete="off"
          className={
            'min-w-0 flex-1 bg-transparent px-3.5 text-[16px] outline-none max-md:px-2.5 max-md:py-3 ' +
            (dark ? 'text-white placeholder:text-white/55' : 'text-sm-ink placeholder:text-sm-ink3')
          }
        />
        <label
          className={`flex w-[112px] shrink-0 cursor-text items-center gap-1.5 border-l pl-3 pr-3.5 max-md:w-auto max-md:border-l-0 max-md:border-t max-md:px-2.5 max-md:py-3 ${divider}`}
        >
          <input
            ref={sizeRef}
            inputMode="numeric"
            value={sqft}
            onChange={(e) => setSqft(e.target.value.replace(/[^0-9,]/g, ''))}
            placeholder="Size"
            aria-label="Size in sq ft"
            className={
              'w-full min-w-0 bg-transparent p-0 text-[16px] outline-none ' +
              (dark ? 'text-white placeholder:text-white/55' : 'text-sm-ink placeholder:text-sm-ink3')
            }
          />
          <span className={`whitespace-nowrap text-[14px] ${dark ? 'text-white/55' : 'text-sm-ink3'}`}>sq ft</span>
        </label>
        <label
          className={`relative flex shrink-0 cursor-pointer items-center border-l max-md:border-l-0 max-md:border-t ${divider} ${dark ? 'text-white/55' : 'text-sm-ink3'}`}
        >
          <select
            value={useClass}
            onChange={(e) => setUseClass(e.target.value as HomeUseClass)}
            aria-label="Use class"
            className={
              'h-full cursor-pointer appearance-none bg-transparent py-0 pl-3.5 pr-8 text-[15px] outline-none max-md:w-full max-md:py-3 max-md:pl-2.5 ' +
              (dark ? 'text-white [&>option]:text-sm-ink' : 'text-sm-ink')
            }
          >
            {HOME_USE_CLASSES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden className="pointer-events-none absolute right-3">
            <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="whitespace-nowrap rounded-sm-btn border border-sm-violet bg-sm-violet px-5 py-[13px] text-[15px] font-medium tracking-[-0.1px] text-white transition-colors hover:bg-sm-violet-deep disabled:opacity-70 max-md:mt-1.5"
        >
          Find matching brands
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl border border-sm-border bg-sm-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(20,10,40,0.22)]">
          {suggestions.slice(0, 4).map((s) => (
            <button
              type="button"
              key={s.id}
              onMouseDown={(e) => {
                e.preventDefault()
                setFocus(false)
                setAddress(s.label)
                setPicked(s)
                void go(s)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] text-sm-ink hover:bg-sm-violet-tint-soft"
            >
              <PinIcon />
              {s.label}
            </button>
          ))}
          {suggestions.length === 0 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setFocus(false)
                void go(null)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] text-sm-ink hover:bg-sm-violet-tint-soft"
            >
              <PinIcon />
              Search <span className="text-sm-ink3">“{address}”</span>
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className={`mt-2.5 text-center text-[13px] ${dark ? 'text-[#FFB4AE]' : 'text-[#A33A35]'}`}>
          {error}
        </p>
      )}
    </form>
  )
}
