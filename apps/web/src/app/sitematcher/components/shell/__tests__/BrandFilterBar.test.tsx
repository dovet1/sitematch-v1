import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrandFilterBar } from '../BrandFilterBar'
import type { SizeBandId } from '../../../lib/size-filter'

const emptyFitCounts = {} as Record<SizeBandId, number>

function renderFilters() {
  return render(
    <BrandFilterBar
      categoryOptions={[
        { id: 'automotive', name: 'Automotive and roadside services' },
        { id: 'food', name: 'Food and beverage' },
      ]}
      brandOptions={[{ id: 'brand', name: 'A long occupier brand name' }]}
      selectedCategoryIds={[]}
      selectedBrandIds={[]}
      sizeBandId={null}
      sizeFitCounts={emptyFitCounts}
      sizeUnknownCount={0}
      showSizeFilter={false}
      onCategoryChange={jest.fn()}
      onBrandChange={jest.fn()}
      onSizeBandChange={jest.fn()}
      onClear={jest.fn()}
    />
  )
}

describe('BrandFilterBar dropdown readability', () => {
  it('opens Category in a wide left-aligned menu without truncating option labels', async () => {
    renderFilters()
    await userEvent.click(screen.getByRole('button', { name: 'Category' }))

    const search = screen.getByRole('textbox', { name: 'Search category' })
    const menu = search.parentElement?.parentElement
    expect(menu).toHaveClass('w-[276px]')
    expect(menu).toHaveClass('left-0')
    expect(screen.getByText('Automotive and roadside services')).not.toHaveClass(
      'truncate'
    )
  })

  it('aligns Brand to the filter-row gutter and closes an open menu with Escape', async () => {
    renderFilters()
    await userEvent.click(screen.getByRole('button', { name: 'Brand' }))

    const search = screen.getByRole('textbox', { name: 'Search brand' })
    expect(search.parentElement?.parentElement).toHaveClass('w-[276px]')
    expect(search.parentElement?.parentElement).toHaveStyle({
      left: 'calc(-100% - 0.5rem)',
    })

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Search brand' })).not.toBeInTheDocument()
  })
})
