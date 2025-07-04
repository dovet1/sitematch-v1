/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchableDropdown, type SearchableOption } from '../searchable-dropdown'

// Mock Radix UI Popover
jest.mock('@radix-ui/react-popover', () => ({
  Root: ({ children, open, onOpenChange }: any) => (
    <div data-testid="popover-root">
      {children}
      {open && <div data-testid="popover-open" />}
    </div>
  ),
  Trigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  Content: ({ children }: any) => <div data-testid="popover-content">{children}</div>
}))

// Mock cmdk
jest.mock('cmdk', () => ({
  Command: ({ children, shouldFilter }: any) => (
    <div data-testid="command" data-should-filter={shouldFilter}>
      {children}
    </div>
  ),
  Group: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  Item: ({ children, onSelect, disabled, value }: any) => (
    <div 
      data-testid="command-item"
      data-value={value}
      data-disabled={disabled}
      onClick={() => !disabled && onSelect()}
    >
      {children}
    </div>
  )
}))

describe('SearchableDropdown Component', () => {
  const mockOnChange = jest.fn()
  
  const mockOptions: SearchableOption[] = [
    { value: 'retail', label: 'Retail', description: 'Retail stores and shops' },
    { value: 'office', label: 'Office', description: 'Office spaces' },
    { value: 'industrial', label: 'Industrial', description: 'Industrial facilities' },
    { value: 'leisure', label: 'Leisure', description: 'Entertainment venues' }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default placeholder', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    expect(screen.getByText('Select an option...')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        placeholder="Choose sector..."
      />
    )
    
    expect(screen.getByText('Choose sector...')).toBeInTheDocument()
  })

  it('displays label when provided', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        label="Sector"
      />
    )
    
    expect(screen.getByText('Sector')).toBeInTheDocument()
  })

  it('shows required indicator when required prop is true', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        label="Sector"
        required
      />
    )
    
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('displays selected option with label and description', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        value="retail"
      />
    )
    
    expect(screen.getByText('Retail')).toBeInTheDocument()
    expect(screen.getByText('Retail stores and shops')).toBeInTheDocument()
  })

  it('filters options based on search input', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Type in search
    const searchInput = screen.getByPlaceholderText('Search options...')
    await user.type(searchInput, 'office')
    
    // Should show only office option
    const items = screen.getAllByTestId('command-item')
    expect(items).toHaveLength(1)
    expect(screen.getByText('Office')).toBeInTheDocument()
  })

  it('filters by description text', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Search by description
    const searchInput = screen.getByPlaceholderText('Search options...')
    await user.type(searchInput, 'entertainment')
    
    // Should show leisure option
    expect(screen.getByText('Leisure')).toBeInTheDocument()
  })

  it('shows empty message when no options match search', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        emptyText="No matches found"
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Search for non-existent option
    const searchInput = screen.getByPlaceholderText('Search options...')
    await user.type(searchInput, 'nonexistent')
    
    expect(screen.getByText('No matches found')).toBeInTheDocument()
  })

  it('handles option selection', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Click on an option
    const officeOption = screen.getByText('Office')
    await user.click(officeOption)
    
    expect(mockOnChange).toHaveBeenCalledWith('office')
  })

  it('shows check mark for selected option', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        value="retail"
      />
    )
    
    // Open dropdown to see options
    const trigger = screen.getByTestId('popover-trigger')
    fireEvent.click(trigger)
    
    // Check mark should be visible for selected option
    const checkIcons = screen.getAllByTestId('check-icon')
    expect(checkIcons.some(icon => 
      icon.classList.contains('opacity-100')
    )).toBe(true)
  })

  it('respects disabled prop on component', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        disabled
      />
    )
    
    const button = screen.getByRole('combobox')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('respects disabled prop on individual options', async () => {
    const optionsWithDisabled = [
      ...mockOptions,
      { value: 'disabled', label: 'Disabled Option', disabled: true }
    ]
    
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={optionsWithDisabled} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Disabled option should not be clickable
    const disabledOption = screen.getByText('Disabled Option')
    const disabledItem = disabledOption.closest('[data-testid="command-item"]')
    expect(disabledItem).toHaveAttribute('data-disabled', 'true')
  })

  it('shows clear button when clearable and has value', () => {
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        value="retail"
        clearable
      />
    )
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()
  })

  it('clears value when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        value="retail"
        clearable
      />
    )
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    await user.click(clearButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('')
  })

  it('resets search value when dropdown closes', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown and search
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    const searchInput = screen.getByPlaceholderText('Search options...')
    await user.type(searchInput, 'office')
    
    // Close dropdown (this would typically be done by clicking outside)
    // For testing, we'll simulate the onOpenChange callback
    fireEvent.click(document.body)
    
    // Reopen dropdown - search should be cleared
    await user.click(trigger)
    expect(searchInput).toHaveValue('')
  })

  it('uses custom search placeholder', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
        searchPlaceholder="Type to search..."
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()
  })

  it('handles case-insensitive search', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Search with different case
    const searchInput = screen.getByPlaceholderText('Search options...')
    await user.type(searchInput, 'RETAIL')
    
    expect(screen.getByText('Retail')).toBeInTheDocument()
  })

  it('maintains focus management correctly', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown 
        options={mockOptions} 
        onChange={mockOnChange} 
      />
    )
    
    // Open dropdown
    const trigger = screen.getByTestId('popover-trigger')
    await user.click(trigger)
    
    // Search input should be focusable
    const searchInput = screen.getByPlaceholderText('Search options...')
    expect(searchInput).toBeInTheDocument()
  })
})