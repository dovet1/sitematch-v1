/**
 * Scottish data zones on the demographics maps.
 *
 * The LSOA layers read a Mapbox vector tileset (dovet.3xo625k3) that covers England and Wales
 * only. Scotland's 2022 data zones stand in for LSOAs in the census data, so each LSOA layer gets
 * a twin drawn from a GeoJSON source of the data zones in the current analysis. Features carry the
 * same LSOA21CD property, so the twins take the same filters, paint and handlers.
 */

import type mapboxgl from 'mapbox-gl';

export const SCOTTISH_ZONES_SOURCE_ID = 'scottish-data-zones';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Outlines already fetched, by code, shared by every map on the page.
const shapeCache = new Map<string, GeoJSON.Feature>();
// What each map last showed, so a style reload (which drops sources) can restore it.
const shownByMap = new WeakMap<mapboxgl.Map, GeoJSON.FeatureCollection>();

export function scottishTwinId(layerId: string): string {
  return `${layerId}-scotland`;
}

/** The layer ids plus their Scottish twins, for registering handlers or toggling visibility. */
export function withScottishTwins(layerIds: string[]): string[] {
  return layerIds.flatMap((id) => [id, scottishTwinId(id)]);
}

/** Adds (or re-adds) a GeoJSON twin of each vector LSOA layer, drawn just above it. */
export function addScottishZoneLayers(map: mapboxgl.Map, layerIds: string[]): void {
  if (!map.getSource(SCOTTISH_ZONES_SOURCE_ID)) {
    map.addSource(SCOTTISH_ZONES_SOURCE_ID, { type: 'geojson', data: shownByMap.get(map) ?? EMPTY });
  }
  for (const id of layerIds) {
    const twin = scottishTwinId(id);
    if (map.getLayer(twin)) map.removeLayer(twin);
    const layers = map.getStyle().layers ?? [];
    const index = layers.findIndex((l) => l.id === id);
    if (index === -1) continue;
    const { 'source-layer': _sourceLayer, ...spec } = layers[index] as mapboxgl.AnyLayer & {
      'source-layer'?: string;
    };
    map.addLayer(
      { ...(spec as mapboxgl.AnyLayer), id: twin, source: SCOTTISH_ZONES_SOURCE_ID } as mapboxgl.AnyLayer,
      layers[index + 1]?.id
    );
  }
}

/** setFilter on a layer and its Scottish twin. */
export function setFilterWithTwin(map: mapboxgl.Map, layerId: string, filter: any[]): void {
  map.setFilter(layerId, filter as any);
  const twin = scottishTwinId(layerId);
  if (map.getLayer(twin)) map.setFilter(twin, filter as any);
}

/** Visibility of a layer and its Scottish twin. */
export function setVisibilityWithTwin(map: mapboxgl.Map, layerId: string, visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', value);
  const twin = scottishTwinId(layerId);
  if (map.getLayer(twin)) map.setLayoutProperty(twin, 'visibility', value);
}

/**
 * Loads outlines for the Scottish codes among `codes` into the twin source. England and Wales
 * codes are ignored (the tileset draws them), so this is a no-op outside Scotland.
 */
export async function showScottishZones(map: mapboxgl.Map, codes: string[]): Promise<void> {
  const scottish = codes.filter((c) => c.startsWith('S'));
  const missing = scottish.filter((c) => !shapeCache.has(c));

  if (missing.length > 0) {
    try {
      const res = await fetch('/api/demographics/area-shapes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: missing }),
      });
      if (res.ok) {
        const fc = (await res.json()) as GeoJSON.FeatureCollection;
        for (const f of fc.features ?? []) {
          const code = f.properties?.LSOA21CD;
          if (typeof code === 'string') shapeCache.set(code, f);
        }
      } else {
        console.error('[ScottishZones] Failed to load data zone outlines:', res.status);
      }
    } catch (error) {
      console.error('[ScottishZones] Failed to load data zone outlines:', error);
    }
  }

  const shown: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: scottish.map((c) => shapeCache.get(c)).filter((f): f is GeoJSON.Feature => !!f),
  };
  shownByMap.set(map, shown);
  const source = map.getSource(SCOTTISH_ZONES_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(shown);
}
