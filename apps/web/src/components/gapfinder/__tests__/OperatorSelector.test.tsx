import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { OperatorSelector } from '../OperatorSelector'

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children, className }: { children: ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  SelectValue: () => <span>Contain</span>,
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}))

jest.mock('../DistanceSelector', () => ({
  DistanceSelector: () => <div>Distance selector</div>,
}))

const renderOperatorSelector = (targetCount?: number) => {
  return render(
    <OperatorSelector
      value="has"
      onChange={jest.fn()}
      onDistanceChange={jest.fn()}
      targetCount={targetCount}
    />
  )
}

describe('OperatorSelector', () => {
  it('only renders the match toggle when multiple targets are selected', () => {
    const { rerender } = renderOperatorSelector(1)

    expect(screen.queryByText('Match:')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Explain match options' })).not.toBeInTheDocument()

    rerender(
      <OperatorSelector
        value="has"
        onChange={jest.fn()}
        onDistanceChange={jest.fn()}
        targetCount={2}
      />
    )

    expect(screen.queryByText('Match:')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explain match options' })).toBeInTheDocument()
  })

  it('provides tooltip content that can be revealed on hover or focus', async () => {
    const user = userEvent.setup()

    renderOperatorSelector(2)

    const helpButton = screen.getByRole('button', { name: 'Explain match options' })
    await user.hover(helpButton)
    helpButton.focus()

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Any: At least one selected brand/category')
    expect(tooltip).toHaveTextContent('All: Every selected brand/category')
    expect(tooltip.parentElement).toHaveClass('group-hover:block')
    expect(tooltip.parentElement).toHaveClass('group-focus-within:block')
    expect(tooltip.parentElement).toHaveClass('right-0')
    expect(helpButton.closest('.space-y-1')).toBeInTheDocument()
  })

  it('uses viewport-safe wrapping classes for the tooltip', () => {
    renderOperatorSelector(2)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveClass('max-w-[min(18rem,calc(100vw-2rem))]')
    expect(tooltip).toHaveClass('whitespace-normal')
    expect(tooltip).not.toHaveClass('whitespace-nowrap')
  })
})
