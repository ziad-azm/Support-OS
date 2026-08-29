import { AtSignIcon, BellIcon, ClockIcon, TriangleAlertIcon, UserPlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'

import { cn } from '@/shared/lib/cn'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu'

import { notificationKeys } from '../api/notificationKeys'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../api/useNotificationMutations'
import { useNotificationSocket } from '../api/useNotificationSocket'
import { useNotifications } from '../api/useNotifications'
import { useUnreadCount } from '../api/useUnreadCount'
import type { Notification } from '../types/notification'

const NOTIFICATION_KIND_ICON: Record<Notification['kind'], typeof UserPlusIcon> = {
  ticket_assigned: UserPlusIcon,
  ticket_escalated: TriangleAlertIcon,
  task_due: ClockIcon,
  mentioned: AtSignIcon,
}

// ticket_escalated reuses text-destructive, not a new token — an escalation
// is the same severity Badge variant="destructive" already asserts on
// TicketDetailPage's own escalation badge (Story 50); a fourth distinct hue
// for the same severity would not be "meaningful," just noisier.
const NOTIFICATION_KIND_COLOR: Record<Notification['kind'], string> = {
  ticket_assigned: 'text-info',
  ticket_escalated: 'text-destructive',
  task_due: 'text-warning',
  mentioned: 'text-info',
}

/**
 * Header bell + dropdown notification center — Story 31. Structure copied
 * from `ThemeToggle` (icon `Button` trigger, `DropdownMenuContent
 * align="end"`, `DropdownMenuItem` per row).
 *
 * The dropdown invalidates the whole `notifications` key prefix every time
 * it opens, rather than trusting the live socket alone — `staleTime: 30_000`
 * / `refetchOnWindowFocus: false` (`shared/lib/api/queryClient.ts`) means a
 * stale list otherwise, and a notification raised from a Celery worker
 * process (the automatic assignment/escalation paths) never arrives over
 * the socket at all (`InMemoryChannelLayer` is single-process only). See
 * Story 31 `## Prerequisites`.
 */
export function NotificationBell() {
  const { t } = useTranslation('notifications')
  const { dateTime } = useFormatters()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useNotificationSocket()

  const { data: notifications } = useNotifications()
  const { data: unreadCount } = useUnreadCount()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const items = notifications?.items ?? []
  const count = unreadCount?.count ?? 0

  function handleSelect(notification: Notification) {
    if (notification.read_at === null) {
      markRead.mutate(notification.id)
    }
    if (notification.ticket !== null) {
      navigate(`/tickets/${notification.ticket}`)
    }
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('bell.label')} className="relative">
          <BellIcon />
          {count > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -end-1 h-4 min-w-4 px-1 text-[10px]"
            >
              {count}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {count > 0 ? (
          <>
            <DropdownMenuItem onClick={() => markAllRead.mutate()}>
              {t('markAllRead')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {items.length === 0 ? (
          <DropdownMenuItem disabled>{t('empty')}</DropdownMenuItem>
        ) : (
          items.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onClick={() => handleSelect(notification)}
              className={notification.read_at === null ? 'font-medium' : undefined}
            >
              <div className="flex w-full items-start gap-2">
                {(() => {
                  const KindIcon = NOTIFICATION_KIND_ICON[notification.kind]
                  return (
                    <KindIcon
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        NOTIFICATION_KIND_COLOR[notification.kind],
                      )}
                    />
                  )
                })()}
                <div className="flex flex-col gap-0.5">
                  <span>{notification.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateTime(notification.created_at)}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
