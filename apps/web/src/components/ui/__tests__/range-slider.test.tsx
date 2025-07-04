/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeSlider } from '../range-slider'

// Mock Radix UI Slider
jest.mock('@radix-ui/react-slider', () => ({
  Root: ({ children, onValueChange, value, ...props }: any) => (
    <div data-testid="slider-root" onClick={() => onValueChange([500, 2000])} {...props}>
      {children}
    </div>
  ),
  Track: ({ children, ...props }: any) => <div data-testid="slider-track" {...props}>{children}</div>,
  Range: (props: any) => <div data-testid="slider-range" {...props} />,
  Thumb: (props: any) => <div data-testid="slider-thumb" {...props} />
}))

describe('RangeSlider Component', () => {
  const mockOnChange = jest.fn()
  const defaultValue: [number, number] = [1000, 5000]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    expect(screen.getByTestId('slider-root')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
  })

  it('displays label when provided', () => {
    render(
      <RangeSlider 
        value={defaultValue} 
        onChange={mockOnChange} 
        label="Site Size" 
      />
    )
    
    expect(screen.getByText('Site Size')).toBeInTheDocument()
  })

  it('shows formatted range display', () => {
    render(
      <RangeSlider 
        value={defaultValue} 
        onChange={mockOnChange} 
        label="Site Size" 
        unit="sq ft"
      />
    )
    
    expect(screen.getByText('1,000 - 5,000 sq ft')).toBeInTheDocument()
  })

  it('shows "Any size" when values span full range', () => {
    render(
      <RangeSlider 
        value={[0, 10000]} 
        onChange={mockOnChange} 
        label="Site Size" 
        min={0}
        max={10000}
      />
    )
    
    expect(screen.getByText('Any size')).toBeInTheDocument()
  })

  it('shows "Up to X" when min is at minimum', () => {
    render(
      <RangeSlider 
        value={[0, 5000]} 
        onChange={mockOnChange} 
        label="Site Size" 
        min={0}
        max={10000}
      />
    )
    
    expect(screen.getByText('Up to 5,000 sq ft')).toBeInTheDocument()
  })

  it('shows "X+" when max is at maximum', () => {
    render(
      <RangeSlider 
        value={[2000, 10000]} 
        onChange={mockOnChange} 
        label="Site Size" 
        min={0}
        max={10000}
      />
    )
    
    expect(screen.getByText('2,000+ sq ft')).toBeInTheDocument()
  })

  it('handles slider value changes', () => {
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const slider = screen.getByTestId('slider-root')
    fireEvent.click(slider)
    
    expect(mockOnChange).toHaveBeenCalledWith([500, 2000])
  })

  it('handles minimum input changes', async () => {
    const user = userEvent.setup()
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const minInput = screen.getByDisplayValue('1000')
    await user.clear(minInput)
    await user.type(minInput, '1500')
    fireEvent.blur(minInput)
    
    expect(mockOnChange).toHaveBeenCalledWith([1500, 5000])
  })

  it('handles maximum input changes', async () => {
    const user = userEvent.setup()
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const maxInput = screen.getByDisplayValue('5000')
    await user.clear(maxInput)
    await user.type(maxInput, '8000')
    fireEvent.blur(maxInput)
    
    expect(mockOnChange).toHaveBeenCalledWith([1000, 8000])
  })

  it('prevents min from being greater than max', async () => {
    const user = userEvent.setup()
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const minInput = screen.getByDisplayValue('1000')
    await user.clear(minInput)
    await user.type(minInput, '6000') // Greater than current max of 5000
    fireEvent.blur(minInput)
    
    expect(mockOnChange).toHaveBeenCalledWith([5000, 5000])
  })

  it('prevents max from being less than min', async () => {
    const user = userEvent.setup()
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const maxInput = screen.getByDisplayValue('5000')
    await user.clear(maxInput)
    await user.type(maxInput, '500') // Less than current min of 1000
    fireEvent.blur(maxInput)
    
    expect(mockOnChange).toHaveBeenCalledWith([1000, 1000])
  })

  it('clamps values to min/max bounds', async () => {
    const user = userEvent.setup()
    render(
      <RangeSlider 
        value={defaultValue} 
        onChange={mockOnChange} 
        min={0}
        max={10000}
      />
    )
    
    const maxInput = screen.getByDisplayValue('5000')
    await user.clear(maxInput)
    await user.type(maxInput, '15000') // Greater than max
    fireEvent.blur(maxInput)
    
    expect(mockOnChange).toHaveBeenCalledWith([1000, 10000])
  })

  it('handles invalid input gracefully', async () => {
    const user = userEvent.setup()
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const minInput = screen.getByDisplayValue('1000')
    await user.clear(minInput)
    await user.type(minInput, 'invalid')
    fireEvent.blur(minInput)
    
    // Should reset to original value
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument()
  })

  it('handles Enter key to confirm input', async () => {
    const user = userEvent.setup()
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} />)
    
    const minInput = screen.getByDisplayValue('1000')
    await user.clear(minInput)
    await user.type(minInput, '1500')
    fireEvent.keyDown(minInput, { key: 'Enter' })
    
    expect(mockOnChange).toHaveBeenCalledWith([1500, 5000])
  })

  it('respects disabled prop', () => {
    render(<RangeSlider value={defaultValue} onChange={mockOnChange} disabled />)
    
    const slider = screen.getByTestId('slider-root')
    expect(slider).toHaveAttribute('aria-disabled', 'true')
    
    const inputs = screen.getAllByRole('spinbutton')
    inputs.forEach(input => {
      expect(input).toBeDisabled()
    })
  })

  it('hides inputs when showInputs is false', () => {
    render(
      <RangeSlider 
        value={defaultValue} 
        onChange={mockOnChange} 
        showInputs={false} 
      />
    )
    
    expect(screen.queryByDisplayValue('1000')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('5000')).not.toBeInTheDocument()
  })

  it('uses custom unit in input labels', () => {
    render(
      <RangeSlider 
        value={defaultValue} 
        onChange={mockOnChange} 
        unit="acres"
      />
    )
    
    expect(screen.getByText('Minimum acres')).toBeInTheDocument()
    expect(screen.getByText('Maximum acres')).toBeInTheDocument()
  })

  it('uses custom formatValue function', () => {
    const formatValue = (value: number) => `$${value}`
    render(
      <RangeSlider 
        value={defaultValue} 
        onChange={mockOnChange} 
        formatValue={formatValue}
        label="Price Range"
      />
    )
    
    expect(screen.getByText('$1,000 - $5,000 sq ft')).toBeInTheDocument()
  })

  it('handles zero values correctly', () => {
    render(
      <RangeSlider 
        value={[0, 1000]} 
        onChange={mockOnChange} 
        label="Range"
      />
    )
    
    expect(screen.getByText('0 - 1,000 sq ft')).toBeInTheDocument()
  })
})