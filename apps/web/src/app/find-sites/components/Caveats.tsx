'use client'

// Persistent, non-dismissable caveats. Find Sites is a broad-brush prospecting instrument — the
// output is an evidence-backed shortlist worth investigating, never available or development-ready
// sites. These four unknowns stay explicit everywhere.
const CAVEATS = [
  'Registered freehold extent — not a development plot.',
  'Availability is unknown.',
  'Lawful access requires investigation.',
  'Planning consent & commercial viability require investigation.',
]

export function Caveats() {
  return (
    <div className="rounded-lg border border-sm-border bg-sm-violet-tint-soft p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-sm-ink2">Always unknown</div>
      <ul className="mt-1 space-y-0.5">
        {CAVEATS.map((c) => (
          <li key={c} className="flex gap-1.5 text-[11px] leading-snug text-sm-ink2">
            <span className="text-sm-ink3">•</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}
