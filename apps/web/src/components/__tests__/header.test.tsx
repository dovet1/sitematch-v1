import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Header } from '../header'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

jest.mock('next/link', () => {
  return ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
})

jest.mock('next/image', () => {
  return function MockImage({ alt, priority: _priority, ...props }: { alt: string; priority?: boolean }) {
    return <img alt={alt} {...props} />
  }
})

jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/hooks/useSubscriptionAccess', () => ({
  useSubscriptionAccess: jest.fn(),
}))

jest.mock('@/components/auth/login-modal', () => ({
  LoginModal: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/auth/signup-modal-enhanced', () => ({
  SignUpModalEnhanced: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/auth/auth-choice-modal', () => ({
  AuthChoiceModal: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div>User menu</div>,
}))

jest.mock('@/components/auth/user-status-header', () => ({
  UserStatusHeader: () => <div>User status</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

const { usePathname } = require('next/navigation')
const { useAuth } = require('@/contexts/auth-context')
const { useSubscriptionAccess } = require('@/hooks/useSubscriptionAccess')

describe('Header GapFinder visibility', () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue('/articles')
    ;(useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
    })
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: false,
      loading: false,
      error: null,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('shows the header on normal routes', () => {
    render(<Header />)

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('shows the header on the logged-out GapFinder landing page', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/gapfinder')

    render(<Header />)

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('shows the header on the logged-in unpaid GapFinder landing page', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/gapfinder')
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      isAdmin: false,
    })
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: false,
      loading: false,
      error: null,
    })

    render(<Header />)

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('hides the header for paid GapFinder users', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/gapfinder')
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      isAdmin: false,
    })
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: true,
      loading: false,
      error: null,
    })

    render(<Header />)

    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('hides the header while paid GapFinder access is loading for logged-in users', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/gapfinder')
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      isAdmin: false,
    })
    ;(useSubscriptionAccess as jest.Mock).mockReturnValue({
      hasAccess: false,
      loading: true,
      error: null,
    })

    render(<Header />)

    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })
})
