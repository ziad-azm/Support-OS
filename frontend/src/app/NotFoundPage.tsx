import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div>
      <p>{t('states.notFound')}</p>
      <Link to="/">{t('actions.goHome')}</Link>
    </div>
  )
}
