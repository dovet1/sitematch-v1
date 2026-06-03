'use client'

import { LayoutDashboard, Users, Briefcase, GraduationCap, Car, Heart, FolderOpen } from 'lucide-react'
import { clsx } from 'clsx'

type NavigationSection = 'overview' | 'demographics' | 'employment' | 'education' | 'mobility' | 'health'
type LeftPanelType = 'saved-analyses' | null

interface LeftRailProps {
  activeSection?: NavigationSection
  activePanel?: LeftPanelType
  onNavigationClick?: (section: NavigationSection) => void
  onSavedAnalysesClick?: () => void
  hasResults?: boolean
}

const NAVIGATION_SECTIONS = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'demographics' as const, label: 'Demographics', icon: Users },
  { id: 'employment' as const, label: 'Employment', icon: Briefcase },
  { id: 'education' as const, label: 'Education', icon: GraduationCap },
  { id: 'mobility' as const, label: 'Mobility', icon: Car },
  { id: 'health' as const, label: 'Health', icon: Heart },
]

export function LeftRail({
  activeSection = 'overview',
  activePanel = null,
  onNavigationClick,
  onSavedAnalysesClick,
  hasResults = false,
}: LeftRailProps) {
  const savedAnalysesActive = activePanel === 'saved-analyses'

  return (
    <aside className="w-14 border-r border-sm-border bg-sm-surface flex flex-col items-center py-4 shrink-0">
      <div className="flex flex-col items-center gap-2">
        {NAVIGATION_SECTIONS.map((section) => {
          const Icon = section.icon
          const isActive = activePanel === null && activeSection === section.id

          return (
            <button
              key={section.id}
              className={clsx(
                'w-10 h-10 flex items-center justify-center rounded-md transition-all',
                'hover:bg-sm-surface-hover',
                isActive && 'bg-sm-violet text-white',
                !hasResults && 'opacity-50 cursor-not-allowed'
              )}
              title={section.label}
              onClick={() => hasResults && onNavigationClick?.(section.id)}
              disabled={!hasResults}
              aria-label={section.label}
              aria-current={isActive ? 'true' : undefined}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      <button
        className={clsx(
          'w-10 h-10 flex items-center justify-center rounded-md transition-all',
          'hover:bg-sm-surface-hover',
          savedAnalysesActive && 'bg-sm-violet text-white'
        )}
        title="Saved Analyses"
        onClick={onSavedAnalysesClick}
        aria-label="Saved Analyses"
        aria-current={savedAnalysesActive ? 'true' : undefined}
      >
        <FolderOpen className="w-5 h-5" />
      </button>
    </aside>
  )
}
