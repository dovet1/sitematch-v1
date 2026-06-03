export const SITE_DEMOGRAPHER_MIN_WIDTH = 768

export function isSiteDemographerViewportSupported(width: number) {
  return width >= SITE_DEMOGRAPHER_MIN_WIDTH
}
