import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

export function PortalHomePage() {
  const { t } = useTranslation('portal')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('home.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('home.intro')}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/faqs">{t('nav.faqs')}</Link>
        </Button>
      </div>
    </div>
  )
}
