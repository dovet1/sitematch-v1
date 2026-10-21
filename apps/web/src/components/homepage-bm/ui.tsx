// Shared bits of the Brand Matcher-led homepage (docs/design_handoff_homepage_trial).

export const SECTION = 'px-[clamp(20px,5vw,80px)] py-[clamp(72px,9vw,120px)]'
export const NARROW = 'mx-auto max-w-[1280px]'
export const H2 = 'mt-4 text-[clamp(32px,4.4vw,56px)] font-semibold leading-[1.02] tracking-[-0.035em] text-sm-ink [text-wrap:balance]'

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.4px] text-sm-ink3">
      <span className="h-1.5 w-1.5 rounded-full bg-sm-violet" />
      {children}
    </div>
  )
}

export function Check({ color = '#7033FF', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <path d="M3.5 8.5l3 3 6-7" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
