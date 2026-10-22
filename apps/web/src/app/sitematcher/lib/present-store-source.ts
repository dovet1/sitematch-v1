import type { WorkspaceArea } from '../types/unified-workspace'
import type { NearbyStore } from './services/gaps-service'

// Present-brand cards count stores from the BUA polygon when a BUA is selected.
// Other contexts keep using the existing landscape/catchment store source.
export function selectPresentStoreSource(
  area: WorkspaceArea | null,
  landscapeStores: NearbyStore[],
  buaStorePins: NearbyStore[]
): NearbyStore[] {
  return area?.kind === 'bua' || area?.kind === 'retail_centre'
    ? buaStorePins
    : landscapeStores
}
