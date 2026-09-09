/**
 * The branding contract. Everything else imports from here — no module
 * hardcodes the storage key or a token name.
 */

/** Mirrors `apps.organization.models.HEX_COLOR_VALIDATOR`. */
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Also read by the inline anti-FOUC script in index.html — keep in sync.
 * Unlike the theme and language keys, this one holds JSON. */
export const BRANDING_STORAGE_KEY = 'supportos.branding'

/** The four custom properties this module is allowed to write, and the only
 * runtime exception to CONVENTIONS.md §19's "colours come from tokens"
 * rule. Declared in index.css and mapped to Tailwind by `@theme inline` —
 * which is why overriding them reaches every `bg-primary`/`text-primary`
 * utility in the app with no class changes. */
export const PRIMARY_TOKEN = '--primary'
export const PRIMARY_FOREGROUND_TOKEN = '--primary-foreground'

/** The brand colour as TEXT, one per theme — see `brandTextFor`.
 *
 * Two variables rather than one, and this is load-bearing: an inline style
 * beats both `:root` and `.dark` (a class selector on the same element), so
 * a single inline `--primary-text` would apply to BOTH themes and could not
 * be correct in either. Instead this module writes the two source values and
 * `index.css` selects between them per theme, which also means switching
 * theme needs no JavaScript at all. Story 101 (F-6). */
export const BRAND_TEXT_LIGHT_TOKEN = '--brand-text-light'
export const BRAND_TEXT_DARK_TOKEN = '--brand-text-dark'

/** Picked for contrast against the brand colour, never configured. */
export const ON_LIGHT = '#000000'
export const ON_DARK = '#FFFFFF'

/** WCAG 2.x AA for body text. Icons and other non-text UI are held to 3:1
 * and are deliberately NOT run through `brandTextFor` — see index.css. */
export const AA_TEXT_RATIO = 4.5

/** Blend granularity for `readableOn`. 40 steps was ample for every brand
 * colour measured in Story 101; finer buys nothing visible. */
export const BLEND_STEPS = 40

/** The surfaces brand text is actually rendered on, per theme — the
 * `--background`/`--card` pairs from index.css. Named here rather than
 * inlined in the algorithm so a theme change updates one place. */
export const LIGHT_SURFACES = ['#F8FAFC', '#FFFFFF'] as const
export const DARK_SURFACES = ['#0A1018', '#171D26'] as const
