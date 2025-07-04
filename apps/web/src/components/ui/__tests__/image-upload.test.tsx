/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUpload } from '../image-upload'

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

describe('ImageUpload Component', () => {
  const mockOnChange = jest.fn()
  const mockOnPreviewChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default placeholder', () => {
    render(<ImageUpload onChange={mockOnChange} />)
    expect(screen.getByText('Upload company logo')).toBeInTheDocument()
    expect(screen.getByText('Drag and drop or click to browse')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(
      <ImageUpload 
        onChange={mockOnChange} 
        placeholder="Upload profile picture" 
      />
    )
    expect(screen.getByText('Upload profile picture')).toBeInTheDocument()
  })

  it('shows file size and type restrictions', () => {
    render(<ImageUpload onChange={mockOnChange} />)
    expect(screen.getByText(/PNG, JPEG, JPG, SVG/)).toBeInTheDocument()
    expect(screen.getByText(/Max 2MB/)).toBeInTheDocument()
  })

  it('handles file selection through click', async () => {
    const user = userEvent.setup()
    render(<ImageUpload onChange={mockOnChange} />)
    
    const file = new File(['mock content'], 'test.png', { type: 'image/png' })
    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    
    await user.upload(input, file)
    
    expect(mockOnChange).toHaveBeenCalledWith(file)
  })

  it('handles drag and drop', async () => {
    render(<ImageUpload onChange={mockOnChange} />)
    
    const dropZone = screen.getByText('Upload company logo').closest('div')!
    const file = new File(['mock content'], 'test.png', { type: 'image/png' })
    
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [file]
      }
    })
    
    fireEvent(dropZone, dropEvent)
    
    expect(mockOnChange).toHaveBeenCalledWith(file)
  })

  it('validates file type and shows error for invalid types', async () => {
    const user = userEvent.setup()
    render(<ImageUpload onChange={mockOnChange} />)
    
    const file = new File(['mock content'], 'test.txt', { type: 'text/plain' })
    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    
    await user.upload(input, file)
    
    expect(screen.getByText(/Invalid file type/)).toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('validates file size and shows error for large files', async () => {
    const user = userEvent.setup()
    render(<ImageUpload onChange={mockOnChange} maxSize={1024} />)
    
    // Create a file larger than maxSize
    const largeContent = 'x'.repeat(2048)
    const file = new File([largeContent], 'large.png', { type: 'image/png' })
    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    
    await user.upload(input, file)
    
    expect(screen.getByText(/File too large/)).toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('shows preview when file is uploaded', () => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' })
    render(<ImageUpload value={file} onChange={mockOnChange} />)
    
    expect(screen.getByAltText('Upload preview')).toBeInTheDocument()
    expect(screen.getByText('test.png')).toBeInTheDocument()
  })

  it('shows remove button when file is present', () => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' })
    render(<ImageUpload value={file} onChange={mockOnChange} />)
    
    const removeButton = screen.getByRole('button', { name: /remove image/i })
    expect(removeButton).toBeInTheDocument()
  })

  it('removes file when remove button is clicked', async () => {
    const user = userEvent.setup()
    const file = new File(['mock content'], 'test.png', { type: 'image/png' })
    render(<ImageUpload value={file} onChange={mockOnChange} />)
    
    const removeButton = screen.getByRole('button', { name: /remove image/i })
    await user.click(removeButton)
    
    expect(mockOnChange).toHaveBeenCalledWith(null)
  })

  it('calls onPreviewChange when preview changes', () => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' })
    render(
      <ImageUpload 
        value={file} 
        onChange={mockOnChange} 
        onPreviewChange={mockOnPreviewChange} 
      />
    )
    
    expect(mockOnPreviewChange).toHaveBeenCalledWith('mock-url')
  })

  it('shows drag over state during drag operation', () => {
    render(<ImageUpload onChange={mockOnChange} />)
    
    const dropZone = screen.getByText('Upload company logo').closest('div')!
    
    fireEvent.dragOver(dropZone)
    
    // Check if drag over styles are applied (this would depend on your specific implementation)
    expect(dropZone).toHaveClass('border-primary')
  })

  it('respects disabled prop', () => {
    render(<ImageUpload onChange={mockOnChange} disabled />)
    
    const dropZone = screen.getByText('Upload company logo').closest('div')!
    expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('formats file size correctly', () => {
    const file = new File(['x'.repeat(1536)], 'test.png', { type: 'image/png' }) // 1.5 KB
    render(<ImageUpload value={file} onChange={mockOnChange} />)
    
    expect(screen.getByText(/1.5 KB/)).toBeInTheDocument()
  })

  it('accepts custom file types', () => {
    render(
      <ImageUpload 
        onChange={mockOnChange} 
        acceptedTypes={['image/webp']} 
      />
    )
    
    expect(screen.getByText(/WEBP/)).toBeInTheDocument()
  })
})