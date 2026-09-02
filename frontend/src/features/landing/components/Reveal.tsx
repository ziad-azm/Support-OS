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
 * `slide-in-from-bottom-*` is vertical and therefore direction-neutral —
 * `slide-in-from-left/right` would need an `rtl:` counterpart and is not used
 * anywhere on this page.
 */
export function Reveal({ children, delayMs = 0 }: { children: ReactNode; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
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
          ? 'animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-700'
          : 'opacity-0',
      )}
    >
      {children}
    </div>
  )
}
