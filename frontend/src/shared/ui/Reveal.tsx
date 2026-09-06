import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

/**
 * Reveals its children once they scroll into view, using the `tw-animate-css`
 * classes already installed for the shadcn primitives — no new dependency
 * (CONVENTIONS.md § 17), and `index.css`'s `prefers-reduced-motion` block
 * already collapses `.animate-in` to 0.01ms.
 *
 * The reduced-motion check here is belt-and-braces on top of that CSS rule:
 * it skips the `opacity-0` starting state entirely, so a reduced-motion
 * visitor never depends on an IntersectionObserver callback to see content.
 *
 * `disabled` is the same escape hatch for the admin editor's live preview
 * (Story 94). The observer has no `root`, so it keys on the VIEWPORT — inside
 * a bounded, scaled preview panel a section can sit at `opacity-0`
 * indefinitely. A blank preview is worse than an unanimated one, so the
 * editor passes `disabled` and every section paints immediately.
 *
 * `slide-in-from-bottom-*` is vertical and therefore direction-neutral —
 * `slide-in-from-left/right` would need an `rtl:` counterpart and is not used
 * anywhere on this page.
 *
 * Promoted from `shared/landing/` to `shared/ui/` by MOTION-0 (Story 97) —
 * a scroll reveal is a generic primitive, not a landing-page concern, and
 * `shared/ui/` is where generic primitives live (the same placement rule
 * `shared/branding/BrandMark.tsx` records in reverse for domain
 * components). Behaviour is unchanged from LAND-1: same observer, same
 * `rootMargin`, same `disabled` escape hatch, same reduced-motion
 * short-circuit. Only the 700ms literal became `--motion-reveal`.
 */
export function Reveal({
  children,
  delayMs = 0,
  disabled = false,
}: {
  children: ReactNode
  delayMs?: number
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(
    () => disabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (revealed) return
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [revealed])

  return (
    <div
      ref={ref}
      style={revealed && delayMs > 0 ? { animationDelay: `${String(delayMs)}ms` } : undefined}
      className={cn(
        revealed
          ? 'animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-(--motion-reveal)'
          : 'opacity-0',
      )}
    >
      {children}
    </div>
  )
}
