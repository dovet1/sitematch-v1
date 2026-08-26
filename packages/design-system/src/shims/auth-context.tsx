import * as React from 'react';

const noop = () => Promise.resolve();

const mockAuthValue = {
  user: null as null,
  profile: null as null,
  loading: false,
  signOut: noop,
  resetPassword: noop,
  updatePassword: noop,
  hasRole: () => false,
  isAdmin: false,
  isOccupier: false,
  refresh: noop,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return mockAuthValue;
}
