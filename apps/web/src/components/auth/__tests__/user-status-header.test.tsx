import { render, screen } from '@testing-library/react';
import { UserStatusHeader, type SubscriptionTier } from '../user-status-header';

jest.mock('@/components/AlreadySubscribedModal', () => ({
  AlreadySubscribedModal: () => null,
}));

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | null;

function renderHeader(subscriptionStatus: SubscriptionStatus, subscriptionTier?: SubscriptionTier) {
  render(
    <UserStatusHeader
      email="dovet@live.com"
      subscriptionStatus={subscriptionStatus}
      subscriptionTier={subscriptionTier}
    />
  );
}

describe('UserStatusHeader', () => {
  it('shows the free plan badge for users without a subscription', () => {
    renderHeader(null);

    expect(screen.getByText('Free Plan')).toBeInTheDocument();
  });

  it('shows the free plan badge for canceled users', () => {
    renderHeader('canceled', 'pro');

    expect(screen.getByText('Free Plan')).toBeInTheDocument();
  });

  it('shows the pro member badge for active pro users', () => {
    renderHeader('active', 'pro');

    expect(screen.getByText('Pro Member')).toBeInTheDocument();
  });

  it('shows the plus member badge for active plus users', () => {
    renderHeader('active', 'plus');

    expect(screen.getByText('Plus Member')).toBeInTheDocument();
  });

  it('shows the pro trial badge for trialing pro users', () => {
    renderHeader('trialing', 'pro');

    expect(screen.getByText('Pro Trial')).toBeInTheDocument();
  });

  it('shows the plus trial badge for trialing plus users', () => {
    renderHeader('trialing', 'plus');

    expect(screen.getByText('Plus Trial')).toBeInTheDocument();
  });

  it('shows the payment issue badge for past due users', () => {
    renderHeader('past_due', 'plus');

    expect(screen.getByText('Payment Issue')).toBeInTheDocument();
  });
});
