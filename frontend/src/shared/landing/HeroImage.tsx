import { useState } from 'react'

/**
 * The admin-set hero image — Story 96 (`LAND-4`). A plain external URL, not
 * an upload; `## The hero image decision` in that plan records why.
 *
 * Copies `shared/branding/BrandMark.tsx`'s three defences verbatim, for the
 * same reasons it records:
 *  - `object-cover` + a fixed aspect ratio, because the image's own
 *    dimensions are unknown and an arbitrary URL must not dictate the hero's
 *    height;
 *  - `onError` → render nothing, because a rotted URL, a private host, or an
 *    `http://` image blocked as mixed content on an `https://` page all land
 *    there. The hero degrades to its single-column form rather than showing a
 *    broken-image glyph on the product's front door;
 *  - `alt` from real content, never a filename.
 *
 * Returns `null` for a blank URL, so `LandingHero` can render it
 * unconditionally and let this component decide.
 */
export function HeroImage({ url, alt }: { url: string; alt: string }) {
  // Tracks the URL that failed, not a plain boolean (F-29, QA-REPORT-1),
  // for the same reason `BrandMark` does: `LandingContentPage`'s live
  // preview re-renders this on every keystroke of the url field
  // (`form.watch()`), so a boolean latched by the first, still-incomplete
  // character typed and never cleared as the rest of a valid url followed.
  // Comparing against the CURRENT url instead makes each keystroke its own
  // fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (url === '' || url === failedUrl) return null
  return (
    <img
      src={url}
      alt={alt}
      loading="eager"
      className="aspect-[4/3] w-full rounded-xl border object-cover shadow-lg"
      onError={() => setFailedUrl(url)}
    />
  )
}
