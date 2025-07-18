import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import ConsultantProfileCard from '../consultant-profile-card';

// Mock the dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockUser = { id: 'test-user-id', email: 'test@example.com' };

beforeEach(() => {
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  jest.clearAllMocks();
});

describe('ConsultantProfileCard', () => {
  it('renders loading state initially', () => {
    render(<ConsultantProfileCard />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders nothing for non-consultant users', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { is_consultant: false, profile_completed: false, profile_exists: false }
      })
    });

    const { container } = render(<ConsultantProfileCard />);
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders profile completion card for consultant without completed profile', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { is_consultant: true, profile_completed: false, profile_exists: false }
      })
    });

    render(<ConsultantProfileCard />);

    await waitFor(() => {
      expect(screen.getByText('Want to be added to the agent directory for free?')).toBeInTheDocument();
      expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Takes 3 minutes')).toBeInTheDocument();
    });
  });

  it('renders profile complete card for consultant with completed profile', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { is_consultant: true, profile_completed: true, profile_exists: true }
      })
    });

    render(<ConsultantProfileCard />);

    await waitFor(() => {
      expect(screen.getByText('Profile Complete')).toBeInTheDocument();
      expect(screen.getByText('Your professional profile is now live in the agent directory.')).toBeInTheDocument();
      expect(screen.getByText('View Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });
  });

  it('renders error state when API call fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(<ConsultantProfileCard />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Profile')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('navigates to correct routes when buttons are clicked', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { is_consultant: true, profile_completed: false, profile_exists: false }
      })
    });

    render(<ConsultantProfileCard />);

    await waitFor(() => {
      const completeButton = screen.getByText('Complete Your Profile');
      completeButton.click();
      expect(mockPush).toHaveBeenCalledWith('/consultant/profile/complete');
    });
  });
});