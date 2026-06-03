'use client'

import { ReactNode } from 'react'

interface LeftPanelProps {
  children: ReactNode
}

export function LeftPanel({ children }: LeftPanelProps) {
  return (
    <aside className="w-80 border-r border-sm-border bg-sm-surface flex flex-col overflow-hidden shrink-0">
      {children}
    </aside>
  )
}
