import { render, screen } from '@testing-library/react'
import Home from '../app/page'

jest.mock('../components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

describe('Home', () => {
  it('renders the main heading', () => {
    render(<Home />)
    
    const heading = screen.getByRole('heading', {
      name: /welcome to sitematch/i,
    })
    
    expect(heading).toBeInTheDocument()
  })

  it('renders the directory browse button', () => {
    render(<Home />)
    
    const button = screen.getByRole('button', {
      name: /browse directory/i,
    })
    
    expect(button).toBeInTheDocument()
  })

  it('renders all feature cards', () => {
    render(<Home />)
    
    expect(screen.getByText('Directory')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
  })
})