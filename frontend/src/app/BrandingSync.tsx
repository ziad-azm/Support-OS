import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { setBranding, useBranding } from '@/shared/branding'

/**
 * Fetches branding once per session and pushes it into `shared/branding`'s
 * store, which writes the two custom properties and refreshes the cache
 * for the next cold start. Renders nothing.
 *
 * Lives in `app/` and is mounted inside `QueryClientProvider` (a
 * react-query hook cannot run above it) and above the router, so it
 * covers every route — including `/`, `/login`, and `/portal`, which is
 * the whole point: those are the surfaces that cannot read
 * `/api/settings/`.
 *
 * Deliberately NOT inside `shared/branding/`: that module must stay
 * free of any API-client import so it can run as a boot-time side effect
 * before providers exist. Same split `shared/theme` keeps.
 */
export function BrandingSync() {
  const { data } = useBranding()
  const { t } = useTranslation('common')

  useEffect(() => {
    if (data) setBranding(data)
  }, [data])

  useEffect(() => {
    // The one place document.title is written — nothing managed it before
    // this story (index.html's static tag was it).
    document.title = data?.name || t('app.name')
  }, [data, t])

  return null
}
