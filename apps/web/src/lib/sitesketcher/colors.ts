// Simple color system for polygon differentiation

export const POLYGON_COLORS = [
  '#2563eb', // blue-600 (default)
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
];

export function getPolygonColor(index: number): string {
  return POLYGON_COLORS[index % POLYGON_COLORS.length];
}