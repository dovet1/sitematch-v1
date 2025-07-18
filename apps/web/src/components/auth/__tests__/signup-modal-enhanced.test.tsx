import { render, screen } from '@testing-library/react'
import { SignUpModalEnhanced } from '../signup-modal-enhanced'

// Mock the auth context
jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    signIn: jest.fn(),
  }),
}))

describe('SignUpModalEnhanced', () => {
  it('renders the trigger button', () => {
    render(
      <SignUpModalEnhanced>
        <button>Sign Up</button>
      </SignUpModalEnhanced>
    )
    
    expect(screen.getByText('Sign Up')).toBeInTheDocument()
  })
})