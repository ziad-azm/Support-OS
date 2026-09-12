// Fails the build if a measured token pair drops below its WCAG threshold.
// The rule this enforces is CONVENTIONS.md's DSN-17 entry; a plain Node
// script, not a lint rule, because oxlint cannot compute colour maths, and
// self-contained (no import from src/shared/branding/contrast.ts) because
// that module is hex-only and this script must read index.css's oklch
// tokens directly without a TypeScript toolchain — see the plan's own
// `## Context` item 6.
import { readFileSync } from 'node:fs'

const CSS_PATH = 'src/index.css'
const AA_TEXT_RATIO = 4.5
const AA_NONTEXT_RATIO = 3

function oklchToHex(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const ll = l_ ** 3
  const mm = m_ ** 3
  const ss = s_ ** 3
  const r = 4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss
  const g = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss
  const bl = -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss
  const enc = (v) => {
    const c2 = Math.min(1, Math.max(0, v))
    return c2 <= 0.0031308 ? 12.92 * c2 : 1.055 * Math.pow(c2, 1 / 2.4) - 0.055
  }
  const toHex = (v) =>
    Math.round(enc(v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function relativeLuminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Extracts `--token: oklch(L C H);` pairs from one `{ ... }` block. Skips
 * alpha-form values (`oklch(1 0 0 / 10%)`) deliberately — `--border`/
 * `--input`'s alpha-overlay role is a FILL, not a checked pair here. */
function parseTokens(block) {
  const tokens = {}
  const re = /--([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g
  let match
  while ((match = re.exec(block))) {
    const [, name, l, c, h] = match
    tokens[name] = oklchToHex(Number(l), Number(c), Number(h))
  }
  return tokens
}

const css = readFileSync(CSS_PATH, 'utf8')
const rootMatch = css.match(/:root\s*{([\s\S]*?)\n}/)
const darkMatch = css.match(/\.dark\s*{([\s\S]*?)\n}/)
if (!rootMatch || !darkMatch) {
  process.stderr.write('check:contrast — could not locate :root/.dark blocks in index.css.\n')
  process.exit(1)
}

const light = parseTokens(rootMatch[1])
const dark = parseTokens(darkMatch[1])

const TEXT_PAIRS = [
  ['foreground', ['background', 'card', 'muted']],
  ['muted-foreground', ['background', 'card', 'muted']],
  ['primary-text', ['background', 'card']],
  ['secondary-text', ['background', 'card']],
]

const FILL_PAIRS = [
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['success', 'success-foreground'],
  ['warning', 'warning-foreground'],
  ['info', 'info-foreground'],
]

const NONTEXT_PAIRS = [
  ['ring', ['background', 'card']],
  ['input-border', ['background', 'card']],
]

let failures = 0

function check(theme, name, surfaceName, ratio, threshold) {
  if (ratio < threshold) {
    failures += 1
    process.stdout.write(
      `${theme} --${name} on --${surfaceName}: ${ratio.toFixed(2)}:1 (needs ${threshold}:1)\n`,
    )
  }
}

for (const [theme, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [name, surfaces] of TEXT_PAIRS) {
    if (!tokens[name]) continue
    for (const surface of surfaces) {
      if (!tokens[surface]) continue
      check(theme, name, surface, contrastRatio(tokens[name], tokens[surface]), AA_TEXT_RATIO)
    }
  }
  for (const [fill, fg] of FILL_PAIRS) {
    if (!tokens[fill] || !tokens[fg]) continue
    check(theme, `${fill}+${fg}`, fill, contrastRatio(tokens[fg], tokens[fill]), AA_TEXT_RATIO)
  }
  for (const [name, surfaces] of NONTEXT_PAIRS) {
    if (!tokens[name]) continue
    for (const surface of surfaces) {
      if (!tokens[surface]) continue
      check(theme, name, surface, contrastRatio(tokens[name], tokens[surface]), AA_NONTEXT_RATIO)
    }
  }
}

if (failures > 0) {
  process.stdout.write(
    `\n${failures} contrast ${failures === 1 ? 'failure' : 'failures'} found. See CONVENTIONS.md's DSN-17 entry.\n`,
  )
  process.exit(1)
}
process.stdout.write('check:contrast — every measured token pair clears its AA threshold.\n')
