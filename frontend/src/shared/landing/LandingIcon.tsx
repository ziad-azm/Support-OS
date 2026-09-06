import { createElement } from 'react'

import { landingIcon } from './config'

/**
 * Renders a highlight's icon from its stored key — the one place that turns
 * a `LandingHighlight.icon` string into something on screen, shared by the
 * public page, the admin list, and the form's picker preview.
 *
 * `createElement`, not `const Icon = landingIcon(icon)` + `<Icon />`: the
 * latter reads to `oxlint`'s `react/static-components` as a component built
 * during render. Here it never is — `landingIcon` only ever returns one of
 * twelve module-level `lucide-react` imports, so the element type is stable
 * across renders for a given key. This form says that plainly instead of
 * carrying a suppression comment.
 *
 * An unknown key degrades to a real icon rather than a hole — see
 * `landingIcon`.
 */
export function LandingIcon({ icon, className }: { icon: string; className?: string }) {
  return createElement(landingIcon(icon), { className })
}
