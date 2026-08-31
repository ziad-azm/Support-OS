import { SearchXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <SearchXIcon className="size-6 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('states.notFound')}</h1>
      <Card className="w-full">
        <CardContent className="flex justify-center py-4">
          <Button asChild>
            <Link to="/">{t('actions.goHome')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
