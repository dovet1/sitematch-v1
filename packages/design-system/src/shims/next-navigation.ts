export function useRouter() {
  return {
    push: (_href: string, _options?: unknown) => {},
    replace: (_href: string, _options?: unknown) => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: (_href: string, _options?: unknown) => {},
  };
}

export function usePathname() {
  return '/';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}
