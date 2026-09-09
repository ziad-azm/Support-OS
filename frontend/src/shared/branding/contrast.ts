import {
  AA_TEXT_RATIO,
  BLEND_STEPS,
  DARK_SURFACES,
  LIGHT_SURFACES,
  ON_DARK,
  ON_LIGHT,
} from './config'

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

/** WCAG contrast ratio between two `#rrggbb` colours. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Blend `hex` toward `target` by `t` (0-1) in sRGB. */
function mix(hex: string, target: string, t: number): string {
  let out = '#'
  for (const offset of [0, 2, 4]) {
    const from = parseInt(hex.slice(1 + offset, 3 + offset), 16)
    const to = parseInt(target.slice(1 + offset, 3 + offset), 16)
    out += Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, '0')
  }
  return out
}

/** The smallest blend of `hex` toward `toward` that clears `AA_TEXT_RATIO`
 * against EVERY surface — not just the darkest or lightest one. Which
 * surface is hardest flips depending on which end you blend toward, so
 * checking one and assuming the other passes is wrong.
 *
 * Returns `hex` untouched when it already passes: a brand colour that is
 * legible must not be shifted for no reason. */
function readableOn(hex: string, surfaces: readonly string[], toward: string): string {
  const passes = (candidate: string) =>
    surfaces.every((surface) => contrastRatio(candidate, surface) >= AA_TEXT_RATIO)
  if (passes(hex)) return hex
  for (let step = 1; step <= BLEND_STEPS; step += 1) {
    const candidate = mix(hex, toward, step / BLEND_STEPS)
    if (passes(candidate)) return candidate
  }
  // Unreachable in practice — `toward` is pure white or black, which clears
  // AA against every surface of its opposite theme. Returned rather than
  // thrown so a brand colour can never break the page.
  return toward
}

/** The brand colour made legible AS TEXT, per theme — the other half of the
 * problem `foregroundFor` solves.
 *
 * `foregroundFor` answers "what colour goes ON this brand colour" (a button
 * label) and is correct. This answers "what does this brand colour become
 * when it IS the text" (a link on the page background), which
 * `foregroundFor` cannot: the brand colour is the foreground here, not the
 * background.
 *
 * Blends toward white for dark mode and black for light mode. That
 * desaturates — a corporate navy becomes a muted periwinkle on a near-black
 * background — and that is the unavoidable trade: a colour that dark cannot
 * be both itself and legible. An unreadable link is the worse outcome.
 * Verified across navy, maroon, forest, pink, yellow and near-black; every
 * one clears 4.5:1 on both surfaces of both themes (Story 101). */
export function brandTextFor(hex: string): { light: string; dark: string } {
  return {
    light: readableOn(hex, LIGHT_SURFACES, ON_LIGHT),
    dark: readableOn(hex, DARK_SURFACES, ON_DARK),
  }
}
