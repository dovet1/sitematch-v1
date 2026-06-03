import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { MissingFasciaInfo } from '@/lib/stores'
import { MissingFasciaTree } from '../MissingFasciaTree'

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, className }: { children: ReactNode; className?: string }) => (
    <button className={className}>{children}</button>
  ),
}))

describe('MissingFasciaTree', () => {
  it('shows long fascia names without truncating them', () => {
    const longFasciaName =
      'Extraordinarily Long Missing Fascia Name With Multiple Words That Must Wrap Instead Of Being Truncated'

    const missingFascias: MissingFasciaInfo[] = [
      {
        fasciaId: 'fascia-1',
        fasciaName: longFasciaName,
        brandId: 'brand-1',
        brandName: 'Long Brand',
        categoryId: 'category-1',
        categoryName: 'Retail',
      },
    ]

    render(
      <MissingFasciaTree
        missingFascias={missingFascias}
        defaultExpanded="all"
      />
    )

    const fasciaName = screen.getByText(longFasciaName)

    expect(fasciaName).toBeInTheDocument()
    expect(fasciaName).toHaveClass('whitespace-normal')
    expect(fasciaName).toHaveClass('break-words')
    expect(fasciaName).not.toHaveClass('truncate')
  })
})
