import { ON_DARK, ON_LIGHT } from './config'

/** WCAG 2.x relative luminance (w3.org/TR/WCAG21/#dfn-relative-luminance).
 * Channel-wise sRGB de-gamma, then the standard 0.2126/0.7152/0.0722
 * weighting — green dominates because human vision does. */
function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** Black or white, whichever is readable ON `hex`.
 *
 * 0.179 is the crossover where black and white text hit the same contrast
 * ratio against a background; above it black wins, below it white does.
 * Using it means every brand colour an admin can enter produces a legible
 * button, which is why `primary_color` has no stored companion. */
export function foregroundFor(hex: string): string {
  return relativeLuminance(hex) > 0.179 ? ON_LIGHT : ON_DARK
}
