export const GAPFINDER_MIN_WIDTH = 768

export function isGapFinderViewportSupported(width: number) {
  return width >= GAPFINDER_MIN_WIDTH
}
