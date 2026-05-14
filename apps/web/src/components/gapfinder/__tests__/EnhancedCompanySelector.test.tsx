import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { EnhancedCompanySelector } from '../EnhancedCompanySelector'

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: ReactNode; value: string }) => (
    <button role="tab" type="button" data-value={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

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
      json: async () => ({ categories: [] }),
    } as Response)
  }

  if (url === '/api/public/brands?limit=1000') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        brands: [
          { id: 'single-brand', name: 'Single Brand' },
          { id: 'multi-brand', name: 'Multi Brand' },
        ],
      }),
    } as Response)
  }

  if (url === '/api/public/fascias/search?brandId=single-brand&limit=100') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        fascias: [
          { id: 'single-fascia', name: 'Single Brand Main', brand_id: 'single-brand' },
        ],
      }),
    } as Response)
  }

  if (url === '/api/public/fascias/search?brandId=multi-brand&limit=100') {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        fascias: [
          { id: 'multi-fascia-1', name: 'Multi Brand Main', brand_id: 'multi-brand' },
          { id: 'multi-fascia-2', name: 'Multi Brand Express', brand_id: 'multi-brand' },
        ],
      }),
    } as Response)
  }

  return Promise.reject(new Error(`Unexpected fetch: ${url}`))
}

describe('EnhancedCompanySelector', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn(mockFetch) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('renders single-fascia brands without type count or dropdown while keeping selection behavior', async () => {
    const user = userEvent.setup()
    const handleCompaniesChange = jest.fn()

    render(
      <EnhancedCompanySelector
        selectedCompanies={[]}
        selectedCategories={[]}
        onCompaniesChange={handleCompaniesChange}
        onCategoriesChange={jest.fn()}
        mode="include"
      />
    )

    await user.click(screen.getByRole('tab', { name: /stores/i }))

    expect(await screen.findByText('Single Brand')).toBeInTheDocument()
    expect(screen.getByText('Multi Brand')).toBeInTheDocument()

    expect(screen.queryByText('(1 type)')).not.toBeInTheDocument()
    expect(screen.queryByText('(1 types)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Expand Single Brand' })).not.toBeInTheDocument()

    expect(screen.getByText('(2 types)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Multi Brand' })).toBeInTheDocument()

    await user.click(screen.getByLabelText('Single Brand'))

    await waitFor(() => {
      expect(handleCompaniesChange).toHaveBeenCalledWith(['single-fascia'])
    })
  })
})
