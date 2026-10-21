// Small pieces shared by the Brand Matcher preview and the trial modal
// (docs/design_handoff_homepage_trial). Icons are the handoff's 1.6px strokes.

export const TRIAL_TOOLS = ['Assess', 'Gaps', 'Sketch', 'Planning', 'Directory'] as const
export type TrialTool = (typeof TRIAL_TOOLS)[number]

export function LockIcon({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={color} strokeWidth="1.7" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

export function CheckIcon({ color = '#7033FF', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d="M3.5 8.5l3 3 6-7" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 2l8 8M10 2l-8 8" stroke="#4A4451" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function ToolIcon({ tool, color, size = 22 }: { tool: TrialTool | 'Match'; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {tool === 'Assess' && (
        <g {...p}>
          <path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z" />
          <circle cx="12" cy="10" r="2.2" />
        </g>
      )}
      {tool === 'Gaps' && (
        <g {...p}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4.5-4.5" />
        </g>
      )}
      {tool === 'Sketch' && (
        <g {...p}>
          <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" />
          <path d="M13 7l3 3" />
        </g>
      )}
      {tool === 'Planning' && (
        <g {...p}>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M9 9h6M9 13h6M9 17h3" />
        </g>
      )}
      {tool === 'Match' && (
        <g {...p}>
          <path d="M4 9l2-5h12l2 5" />
          <path d="M4 9h16v3a3 3 0 01-6 0 3 3 0 01-4 0 3 3 0 01-6 0V9z" />
          <path d="M6 14v6h12v-6" />
        </g>
      )}
      {tool === 'Directory' && (
        <g {...p}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M8.5 16a3.5 3.5 0 017 0" />
        </g>
      )}
    </svg>
  )
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1px] text-sm-violet-deep">
      <LockIcon color="#5421CC" size={12} />
      {children}
    </div>
  )
}

export function SiteMatcherLogo({ height = 24 }: { height?: number }) {
  return (
    <span className="flex items-center gap-2 text-[20px] font-medium tracking-[-0.3px] text-sm-violet">
      <svg height={height} viewBox="0 0 64 64" aria-hidden>
        <g fill="#7033ff">
          <path d="M2.61,37.02a1.45852,1.45852,0,0,1-.11-.55V4A1.498,1.498,0,0,1,4,2.5H15.77a1.50728,1.50728,0,0,1,1.06.44L27.18,13.29a1.49682,1.49682,0,0,1,0,2.12L5.06,37.53A1.50653,1.50653,0,0,1,2.61,37.02Z" />
          <path d="M61.5,4V15.77a1.809,1.809,0,0,1-.11.57,1.62577,1.62577,0,0,1-.33.49L50.71,27.18a1.50713,1.50713,0,0,1-2.12,0L26.47,5.06a1.5155,1.5155,0,0,1,.4901-2.45,1.79313,1.79313,0,0,1,.57-.11L60,2.5A1.498,1.498,0,0,1,61.5,4Z" />
          <path d="M61.39,26.98a1.45841,1.45841,0,0,1,.11.55V60A1.498,1.498,0,0,1,60,61.5H48.23a1.50747,1.50747,0,0,1-1.06-.44L36.82,50.71a1.49678,1.49678,0,0,1,0-2.12L58.94,26.47A1.50658,1.50658,0,0,1,61.39,26.98Z" />
          <path d="M19.17,30.94,30.94,19.17a1.509,1.509,0,0,1,2.12,0L44.83,30.94a1.50907,1.50907,0,0,1,0,2.12L33.06,44.83a1.51876,1.51876,0,0,1-2.12,0L19.17,33.06A1.50906,1.50906,0,0,1,19.17,30.94Z" />
          <path d="M37.86,59.45a1.50661,1.50661,0,0,1-1.39,2.05L4,61.5A1.498,1.498,0,0,1,2.5,60V48.23a1.81029,1.81029,0,0,1,.11-.57,1.62669,1.62669,0,0,1,.33-.49L13.29,36.82a1.54761,1.54761,0,0,1,2.12,0L37.53,58.94A1.28931,1.28931,0,0,1,37.86,59.45Z" />
        </g>
      </svg>
      SiteMatcher
    </span>
  )
}
