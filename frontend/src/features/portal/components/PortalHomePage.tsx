import { useTranslation } from 'react-i18next'

export function PortalHomePage() {
  const { t } = useTranslation('portal')

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">{t('home.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('home.placeholder')}</p>
    </div>
  )
}
