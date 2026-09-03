import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

import { getBranding } from './branding'
import { useBranding } from './useBranding'

/**
 * The organisation's logo, or its name, or the product default — in that
 * order. ORG-3's single brand surface: `Sidebar`, `PortalLayout`,
 * `LandingPage`, and `LoginPage` all render this, because a second copy of
 * this fallback chain is how one surface ends up silently blank when a
 * logo URL rots.
 *
 * A PascalCase component inside `shared/<domain>/` rather than
 * `shared/ui/`, the same placement `shared/auth/Can.tsx` established:
 * `shared/ui/` is for generic primitives, a domain folder owns its own
 * component (CONVENTIONS.md §19/§23).
 */
export function BrandMark({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const branding = useBranding().data ?? getBranding()
  const [imageFailed, setImageFailed] = useState(false)
  const name = branding.name || t('app.name')

  if (branding.logo_url !== '' && !imageFailed) {
    return (
      <img
        src={branding.logo_url}
        alt={name}
        // Height-capped and `object-contain`: `logo_url` is an arbitrary
        // external URL, so the image's own dimensions are unknown and a
        // 2000px-wide banner must not blow out the sidebar.
        className={cn('h-6 w-auto max-w-32 object-contain', className)}
        // A rotted URL, a private host, or an http:// logo blocked as
        // mixed content on an https:// page all land here. Falling back to
        // the name is the difference between a rebrand and a blank header.
        onError={() => setImageFailed(true)}
      />
    )
  }
  return <span className={cn('truncate font-semibold', className)}>{name}</span>
}
