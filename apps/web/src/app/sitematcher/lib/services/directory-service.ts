// Thin fetch wrappers for the Company Directory endpoints, matching the shape of
// requirements-service.ts. All routes are Plus-gated server-side and return 403 otherwise.

import type {
  DirectoryAgentProfile,
  DirectoryAgentSummary,
  DirectoryBrandCard,
  DirectoryBrandProfile,
  DirectoryList,
  DirectoryTeamMember,
} from '../../types/unified-workspace'

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) {
    if (res.status === 403) throw new Error('Directory requires a Plus subscription')
    throw new Error(`Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export function fetchDirectoryBrands(signal?: AbortSignal) {
  return getJson<DirectoryList<DirectoryBrandCard>>('/api/public/directory/brands', signal)
}

export function fetchDirectoryAgents(signal?: AbortSignal) {
  return getJson<DirectoryList<DirectoryAgentSummary>>('/api/public/directory/agents', signal)
}

export function fetchDirectoryInHouse(signal?: AbortSignal) {
  return getJson<DirectoryList<DirectoryTeamMember>>('/api/public/directory/in-house', signal)
}

export function fetchDirectoryBrandProfile(id: string, signal?: AbortSignal) {
  return getJson<DirectoryBrandProfile>(
    `/api/public/directory/brands/${encodeURIComponent(id)}`,
    signal
  )
}

export function fetchDirectoryAgentProfile(id: string, signal?: AbortSignal) {
  return getJson<DirectoryAgentProfile>(
    `/api/public/directory/agents/${encodeURIComponent(id)}`,
    signal
  )
}
