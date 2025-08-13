import { ReactNode } from 'react'

interface AgencyGridProps {
  children: ReactNode
}

export function AgencyGrid({ children }: AgencyGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
      {children}
    </div>
  )
}