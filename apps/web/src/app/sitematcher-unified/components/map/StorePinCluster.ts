import mapboxgl from 'mapbox-gl'
import Supercluster from 'supercluster'
import type { NearbyStore } from '../../lib/services/gaps-service'
import { applyStoreBadgeHighlight, buildStoreBadge } from './store-badges'

type LeafProps = { store: NearbyStore }

const CLUSTER_RADIUS_PX = 40
const CLUSTER_MAX_ZOOM = 14

// Builds the count-bubble element shown for an aggregated cluster.
function buildClusterBubble(count: number): HTMLDivElement {
  const el = document.createElement('div')
  const size = count >= 100 ? 44 : count >= 25 ? 38 : 32
  el.style.cssText =
    `width:${size}px;height:${size}px;border-radius:50%;` +
    'display:flex;align-items:center;justify-content:center;' +
    'background:#7033FF;color:#fff;font-weight:600;font-size:13px;' +
    'box-shadow:0 0 0 3px rgba(112,51,255,0.35),0 2px 6px rgba(0,0,0,0.3);' +
    'cursor:pointer;pointer-events:auto;'
  el.textContent = count >= 1000 ? `${Math.round(count / 100) / 10}k` : String(count)
  return el
}

// Client-side clustering for the find-gaps store pins. Reconciles HTML markers
// (logo badges for leaves, count bubbles for clusters) against the current
// viewport + zoom on every map move, reusing the shared badge helpers so the pins
// look identical to the Assess store pins.
export class StorePinCluster {
  private map: mapboxgl.Map
  private index: Supercluster<LeafProps> | null = null
  private markers = new Map<string | number, mapboxgl.Marker>()
  private markerStores = new Map<string | number, NearbyStore>()
  private markerClusterIds = new Map<string | number, number>()
  private hoveredBrandId: string | null = null
  private boundRender = () => this.render()

  constructor(map: mapboxgl.Map) {
    this.map = map
    this.map.on('moveend', this.boundRender)
    this.map.on('zoomend', this.boundRender)
  }

  // Swap the pin set. Rebuilds the cluster index and re-renders immediately.
  setPins(pins: NearbyStore[]) {
    if (pins.length === 0) {
      this.index = null
      this.clearMarkers()
      return
    }
    this.index = new Supercluster<LeafProps>({
      radius: CLUSTER_RADIUS_PX,
      maxZoom: CLUSTER_MAX_ZOOM,
    })
    this.index.load(
      pins
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
        .map((store) => ({
          type: 'Feature' as const,
          properties: { store },
          geometry: {
            type: 'Point' as const,
            coordinates: [store.lon, store.lat],
          },
        }))
    )
    this.render()
  }

  private render() {
    if (!this.index) return
    const bounds = this.map.getBounds()
    if (!bounds) return
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]
    const zoom = Math.round(this.map.getZoom())
    const clusters = this.index.getClusters(bbox, zoom)

    const seen = new Set<string | number>()

    for (const feature of clusters) {
      const [lon, lat] = feature.geometry.coordinates
      const props = feature.properties as
        | Supercluster.ClusterProperties
        | LeafProps

      const isCluster = (props as Supercluster.ClusterProperties).cluster === true
      const key: string | number = isCluster
        ? `cluster-${(props as Supercluster.ClusterProperties).cluster_id}`
        : `store-${(props as LeafProps).store.id}`
      seen.add(key)

      if (this.markers.has(key)) continue

      let el: HTMLElement
      let store: NearbyStore | undefined
      if (isCluster) {
        const clusterProps = props as Supercluster.ClusterProperties
        el = buildClusterBubble(clusterProps.point_count)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const expZoom = this.index?.getClusterExpansionZoom(clusterProps.cluster_id)
          if (expZoom != null) {
            this.map.easeTo({ center: [lon, lat], zoom: expZoom })
          }
        })
      } else {
        store = (props as LeafProps).store
        el = buildStoreBadge(store)
        applyStoreBadgeHighlight(el, store, this.hoveredBrandId)
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(this.map)
      this.markers.set(key, marker)
      if (store) this.markerStores.set(key, store)
      else if (isCluster) {
        this.markerClusterIds.set(
          key,
          (props as Supercluster.ClusterProperties).cluster_id
        )
      }
    }

    this.markers.forEach((marker, key) => {
      if (!seen.has(key)) {
        marker.remove()
        this.markers.delete(key)
        this.markerStores.delete(key)
        this.markerClusterIds.delete(key)
      }
    })
  }

  applyBrandHighlight(hoveredBrandId: string | null) {
    this.hoveredBrandId = hoveredBrandId
    this.markers.forEach((marker, key) => {
      const store = this.markerStores.get(key)
      if (store) {
        applyStoreBadgeHighlight(marker.getElement(), store, hoveredBrandId)
        return
      }
      const clusterId = this.markerClusterIds.get(key)
      const el = marker.getElement()
      if (!hoveredBrandId || !this.index || clusterId == null) {
        el.style.opacity = '1'
        el.style.zIndex = ''
        return
      }
      const hasHoveredBrand = this.index
        .getLeaves(clusterId, Number.MAX_SAFE_INTEGER)
        .some((leaf) => leaf.properties.store.brand_id === hoveredBrandId)
      el.style.opacity = hasHoveredBrand ? '1' : '0.35'
      el.style.zIndex = hasHoveredBrand ? '2' : ''
    })
  }

  private clearMarkers() {
    this.markers.forEach((marker) => marker.remove())
    this.markers.clear()
    this.markerStores.clear()
    this.markerClusterIds.clear()
  }

  destroy() {
    this.map.off('moveend', this.boundRender)
    this.map.off('zoomend', this.boundRender)
    this.clearMarkers()
    this.index = null
  }
}
