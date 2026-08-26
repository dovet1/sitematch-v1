/**
 * Parking Layout Lab — local metre projection + small geometry helpers.
 *
 * Pure module: no React, no Mapbox instances, no Zustand, no browser globals.
 * We project lng/lat onto a local tangent plane (equirectangular about an
 * origin) so all layout maths happen in metres, then unproject back for output.
 *
 * This is accurate to well under a metre across the size of an ordinary
 * commercial plot, which is all this conceptual tool requires.
 */

import type { LngLat, Ring } from './types';

const EARTH_RADIUS_M = 6_378_137; // WGS84 semi-major axis
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export type LocalPoint = [number, number]; // [x, y] in metres
export type LocalRing = LocalPoint[];

/** Projection anchored at a lng/lat origin. */
export type LocalProjection = {
  origin: LngLat;
  toLocal: (p: LngLat) => LocalPoint;
  toLngLat: (p: LocalPoint) => LngLat;
};

/**
 * Build an equirectangular projection about `origin`. x runs east, y runs north.
 */
export function createProjection(origin: LngLat): LocalProjection {
  const [lon0, lat0] = origin;
  const cosLat0 = Math.cos(lat0 * DEG2RAD);

  const toLocal = ([lon, lat]: LngLat): LocalPoint => {
    const x = (lon - lon0) * DEG2RAD * cosLat0 * EARTH_RADIUS_M;
    const y = (lat - lat0) * DEG2RAD * EARTH_RADIUS_M;
    return [x, y];
  };

  const toLngLat = ([x, y]: LocalPoint): LngLat => {
    const lat = lat0 + (y / EARTH_RADIUS_M) * RAD2DEG;
    const lon = lon0 + (x / (EARTH_RADIUS_M * cosLat0)) * RAD2DEG;
    return [lon, lat];
  };

  return { origin, toLocal, toLngLat };
}

/** Arithmetic mean of a ring's vertices (ignoring a duplicated closing vertex). */
export function ringCentroidLngLat(ring: Ring): LngLat {
  const pts = dropClosing(ring);
  let sx = 0;
  let sy = 0;
  for (const [lon, lat] of pts) {
    sx += lon;
    sy += lat;
  }
  return [sx / pts.length, sy / pts.length];
}

/** Remove a trailing vertex that duplicates the first (GeoJSON closing point). */
export function dropClosing(ring: Ring): Ring {
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return ring.slice(0, -1);
    }
  }
  return ring;
}

export function dropClosingLocal(ring: LocalRing): LocalRing {
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return ring.slice(0, -1);
    }
  }
  return ring;
}

/** Ensure a ring is explicitly closed (first === last). Returns a new array. */
export function closeRing(ring: LocalRing): LocalRing {
  const open = dropClosingLocal(ring);
  return [...open, open[0]];
}

export function projectRing(ring: Ring, proj: LocalProjection): LocalRing {
  return dropClosing(ring).map(proj.toLocal);
}

export function unprojectRing(ring: LocalRing, proj: LocalProjection): Ring {
  const closed = closeRing(ring);
  return closed.map(proj.toLngLat);
}

/** Signed area (shoelace); positive for counter-clockwise. */
export function signedArea(ring: LocalRing): number {
  const pts = dropClosingLocal(ring);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

export function polygonAreaLocal(ring: LocalRing): number {
  return Math.abs(signedArea(ring));
}

/** Axis-aligned bounding box of a local ring: [minX, minY, maxX, maxY]. */
export function bboxLocal(ring: LocalRing): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Point-in-polygon (ray casting) in local coordinates. Boundary counts as inside. */
export function pointInRing(pt: LocalPoint, ring: LocalRing): boolean {
  const pts = dropClosingLocal(ring);
  const [px, py] = pt;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Euclidean distance between two local points. */
export function dist(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Distance from point `p` to segment `a`-`b`, plus the closest point on it.
 */
export function pointToSegment(
  p: LocalPoint,
  a: LocalPoint,
  b: LocalPoint,
): { distance: number; closest: LocalPoint; t: number } {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closest: LocalPoint = [a[0] + t * abx, a[1] + t * aby];
  return { distance: dist(p, closest), closest, t };
}

/** Rotate a local point about the origin by angleDeg (counter-clockwise). */
export function rotate(p: LocalPoint, angleDeg: number): LocalPoint {
  const a = angleDeg * DEG2RAD;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

export { DEG2RAD, RAD2DEG };
