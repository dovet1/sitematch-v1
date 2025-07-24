/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import SiteSketcherPage from '../page';

// Mock the dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../components/MapboxMap', () => {
  return {
    MapboxMap: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="mapbox-map">Mocked MapboxMap {children}</div>
    ),
  };
});

jest.mock('../components/ResponsiveControls', () => ({
  ResponsiveControls: () => <div data-testid="responsive-controls">Mocked ResponsiveControls</div>,
}));

jest.mock('../components/ModeIndicator', () => ({
  ModeIndicator: () => <div data-testid="mode-indicator">Mocked ModeIndicator</div>,
}));

jest.mock('../components/MobileFAB', () => ({
  MobileFAB: () => <div data-testid="mobile-fab">Mocked MobileFAB</div>,
}));

jest.mock('../components/WelcomeOnboarding', () => {
  return function WelcomeOnboarding({ isOpen, userProfile }: { isOpen: boolean; userProfile: any }) {
    return isOpen ? (
      <div data-testid="welcome-onboarding">
        Welcome {userProfile?.user_type || 'User'}!
      </div>
    ) : null;
  };
});

jest.mock('@/lib/sitesketcher/mapbox-utils', () => ({
  getMapboxToken: jest.fn(() => 'mock-token'),
}));

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};

const mockSearchParams = {
  get: jest.fn(),
};

describe('SiteSketcher Authentication Flow', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    mockRouter.push.mockClear();
    mockSearchParams.get.mockClear();
  });

  it('should show loading state while authentication is being checked', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      profile: null,
      loading: true,
    });
    (mockSearchParams.get as jest.Mock).mockReturnValue(null);

    render(<SiteSketcherPage />);

    expect(screen.getByText('Loading SiteSketcher...')).toBeInTheDocument();
  });

  it('should redirect to landing page if user is not authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
    });
    (mockSearchParams.get as jest.Mock).mockReturnValue(null);

    render(<SiteSketcherPage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/sitesketcher/landing');
    });
  });

  it('should render SiteSketcher for authenticated user', () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockProfile = { 
      id: '123', 
      email: 'test@example.com', 
      role: 'occupier', 
      user_type: 'Commercial Occupier' 
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: false,
    });
    (mockSearchParams.get as jest.Mock).mockReturnValue(null);

    render(<SiteSketcherPage />);

    expect(screen.getByText('SiteSketcher')).toBeInTheDocument();
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-controls')).toBeInTheDocument();
  });

  it('should show welcome onboarding for new users', () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockProfile = { 
      id: '123', 
      email: 'test@example.com', 
      role: 'occupier', 
      user_type: 'Commercial Occupier' 
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: false,
    });
    (mockSearchParams.get as jest.Mock).mockReturnValue('true'); // welcome=true

    render(<SiteSketcherPage />);

    expect(screen.getByTestId('welcome-onboarding')).toBeInTheDocument();
    expect(screen.getByText('Welcome Commercial Occupier!')).toBeInTheDocument();
  });

  it('should not show welcome onboarding for returning users', () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockProfile = { 
      id: '123', 
      email: 'test@example.com', 
      role: 'occupier', 
      user_type: 'Commercial Occupier' 
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: false,
    });
    (mockSearchParams.get as jest.Mock).mockReturnValue(null); // no welcome param

    render(<SiteSketcherPage />);

    expect(screen.queryByTestId('welcome-onboarding')).not.toBeInTheDocument();
  });

  it('should show error recovery options for mapbox errors', () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      profile: null,
      loading: false,
    });
    (mockSearchParams.get as jest.Mock).mockReturnValue(null);

    // Mock mapbox error
    jest.doMock('@/lib/sitesketcher/mapbox-utils', () => ({
      getMapboxToken: jest.fn(() => {
        throw new Error('Mapbox token not found');
      }),
    }));

    render(<SiteSketcherPage />);

    expect(screen.getByText('Mapbox Configuration Error')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
    expect(screen.getByText('Back to Landing')).toBeInTheDocument();
  });
});