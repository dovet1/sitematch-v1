import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { UnifiedCategorySelector } from '../UnifiedCategorySelector'

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CollapsibleTrigger: ({
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <button className={className} aria-label={ariaLabel} type="button">
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    onClick,
  }: {
    id?: string
    checked?: boolean | 'indeterminate'
    onCheckedChange?: (checked: boolean) => void
    onClick?: (event: React.MouseEvent<HTMLInputElement>) => void
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked === true}
      aria-checked={checked === 'indeterminate' ? 'mixed' : checked === true}
      onChange={() => onCheckedChange?.(checked !== true)}
      onClick={onClick}
    />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    className,
    htmlFor,
  }: {
    children: ReactNode
    className?: string
    htmlFor?: string
  }) => (
    <label className={className} htmlFor={htmlFor}>
      {children}
    </label>
  ),
}))

const mockFetch = (url: string) => {
  if (url === '/api/public/categories') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        categories: [
          {
            id: 'coffee-category',
            name: 'Coffee',
            parent_category_id: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    } as Response)
  }

  if (url === '/api/public/brands?limit=1000') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        brands: [
          { id: 'pret-brand', name: 'Pret A Manger', created_at: '2026-01-01T00:00:00.000Z' },
          { id: 'multi-brand', name: 'Multi Coffee', created_at: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    } as Response)
  }

  if (url === '/api/public/fascias/search?brandId=pret-brand&limit=100') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        fascias: [
          {
            id: 'pret-fascia-id',
            brand_id: 'pret-brand',
            name: 'Pret A Manger',
            definition: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    } as Response)
  }

  if (url === '/api/public/fascias/search?brandId=multi-brand&limit=100') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        fascias: [
          {
            id: 'multi-fascia-1',
            brand_id: 'multi-brand',
            name: 'Multi Coffee Standard',
            definition: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'multi-fascia-2',
            brand_id: 'multi-brand',
            name: 'Multi Coffee Express',
            definition: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    } as Response)
  }

  if (url === '/api/public/fascia-categories') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        mappings: [
          { fascia_id: 'pret-fascia-id', category_id: 'coffee-category', is_primary: true },
          { fascia_id: 'multi-fascia-1', category_id: 'coffee-category', is_primary: true },
          { fascia_id: 'multi-fascia-2', category_id: 'coffee-category', is_primary: true },
        ],
      }),
    } as Response)
  }

  return Promise.reject(new Error(`Unexpected fetch: ${url}`))
}

describe('UnifiedCategorySelector', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn(mockFetch) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('prevents drilling into single-fascia brands while selecting their child fascia', async () => {
    const user = userEvent.setup()
    const handleCompaniesChange = jest.fn()

    render(
      <UnifiedCategorySelector
        selectedCompanies={[]}
        selectedCategories={[]}
        onCompaniesChange={handleCompaniesChange}
        onCategoriesChange={jest.fn()}
        mode="include"
      />
    )

    expect(await screen.findByText('Coffee')).toBeInTheDocument()
    expect(screen.getAllByText('Pret A Manger')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Expand Pret A Manger' })).not.toBeInTheDocument()
    expect(screen.queryByText('(1 type)')).not.toBeInTheDocument()
    expect(screen.queryByText('(1 types)')).not.toBeInTheDocument()

    expect(screen.getByText('(2 types)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Multi Coffee' })).toBeInTheDocument()
    expect(screen.getByText('Multi Coffee Standard')).toBeInTheDocument()
    expect(screen.getByText('Multi Coffee Express')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Pret A Manger'))

    await waitFor(() => {
      expect(handleCompaniesChange).toHaveBeenCalledWith(['pret-fascia-id'])
    })
  })
})
