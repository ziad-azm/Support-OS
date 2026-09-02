import type { ComponentType } from 'react'
import {
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  ContactIcon,
  InboxIcon,
  ListTodoIcon,
  TicketIcon,
  UserCogIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useTasks } from '@/features/tasks/api/useTasks'
import { useTickets } from '@/features/tickets/api/useTickets'
import { ticketStatusVariant } from '@/features/tickets/lib/statusBadge'
import { useUnreadCount } from '@/features/notifications/api/useUnreadCount'
import { Can, useAuth } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { PageHeader } from '@/shared/ui/PageHeader'

/** One curated quick-link card, gated the same way its `Sidebar.tsx`
 * counterpart is — this page picks a handful of high-value destinations
 * rather than mirroring every nav item. */
function QuickLinkCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Link to={to}>
      <Card className="h-full transition-colors hover:bg-accent">
        <CardContent className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/** `to` is omitted for a stat with no dedicated page to link to (e.g.
 * unread notifications — only the sidebar's `NotificationBell` dropdown
 * shows them, there is no `/notifications` route). */
function StatTile({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number | undefined
  to?: string
}) {
  const content = (
    <Card className={to ? 'h-full transition-colors hover:bg-accent' : 'h-full'}>
      <CardContent className="flex items-center gap-3">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tabular-nums">{value ?? '—'}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  )

  return to ? <Link to={to}>{content}</Link> : content
}

/**
 * The app's landing screen (`index: true` under `/`) — replaces the
 * FND-2/FND-3 reference `HealthPage`, which was never meant to be the real
 * home page. A greeting, a few at-a-glance stats, permission-gated quick
 * links, and two short "what's next" lists — deliberately not a full KPI
 * dashboard (that stays at `/reports/dashboard`, `reports.view`-gated);
 * everything here works for any authenticated role.
 */
export function HomePage() {
  const { t } = useTranslation([
    'common',
    'tickets',
    'tasks',
    'customers',
    'knowledgeBase',
    'accounts',
  ])
  const { user, can } = useAuth()
  const { date, dateTime } = useFormatters()

  const name = user ? `${user.first_name} ${user.last_name}`.trim() || user.email : ''
  const canViewTickets = can('tickets.view')

  const openTicketsQuery = useTickets(
    { page: 1, page_size: 1, assigned_to_me: 'true', status: 'open' },
    { enabled: canViewTickets },
  )
  const openTasksQuery = useTasks({ page: 1, page_size: 1, completed: 'false' })
  const unreadQuery = useUnreadCount()

  const recentTicketsQuery = useTickets(
    { page: 1, page_size: 5, assigned_to_me: 'true', ordering: '-created_at' },
    { enabled: canViewTickets },
  )
  const upcomingTasksQuery = useTasks({
    page: 1,
    page_size: 5,
    completed: 'false',
    ordering: 'due_at',
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('home.greeting', { name })}
        action={user?.role ? <Badge variant="secondary">{user.role.name}</Badge> : undefined}
      />
      <p className="text-muted-foreground">{t('home.subtitle')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Can permission="tickets.view">
          <StatTile
            icon={TicketIcon}
            label={t('home.stats.openTickets')}
            value={openTicketsQuery.data?.pagination.count}
            to="/tickets/my-tickets"
          />
        </Can>
        <StatTile
          icon={ListTodoIcon}
          label={t('home.stats.openTasks')}
          value={openTasksQuery.data?.pagination.count}
          to="/tasks"
        />
        <StatTile
          icon={BellIcon}
          label={t('home.stats.unreadNotifications')}
          value={unreadQuery.data?.count}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Can permission="tickets.view">
          <QuickLinkCard
            to="/tickets/my-tickets"
            icon={InboxIcon}
            title={t('tickets:myQueue.title')}
            description={t('home.links.myTickets')}
          />
        </Can>
        <QuickLinkCard
          to="/tasks"
          icon={ListTodoIcon}
          title={t('tasks:title')}
          description={t('home.links.tasks')}
        />
        <Can permission="customers.view">
          <QuickLinkCard
            to="/customers"
            icon={ContactIcon}
            title={t('customers:title')}
            description={t('home.links.customers')}
          />
        </Can>
        <Can permission="knowledge_base.view">
          <QuickLinkCard
            to="/knowledge-base"
            icon={BookOpenIcon}
            title={t('knowledgeBase:title')}
            description={t('home.links.knowledgeBase')}
          />
        </Can>
        <Can permission="reports.view">
          <QuickLinkCard
            to="/reports/dashboard"
            icon={BarChart3Icon}
            title={t('home.links.dashboardTitle')}
            description={t('home.links.dashboard')}
          />
        </Can>
        <Can permission="users.view">
          <QuickLinkCard
            to="/users"
            icon={UserCogIcon}
            title={t('accounts:users.title')}
            description={t('home.links.users')}
          />
        </Can>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('home.upcomingTasks.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasksQuery.data?.items.length ? (
              <ul className="flex flex-col gap-2">
                {upcomingTasksQuery.data.items.map((taskItem) => {
                  const overdue = new Date(taskItem.due_at) < new Date()
                  return (
                    <li key={taskItem.id}>
                      <Link
                        to={`/tasks/${taskItem.id}/edit`}
                        className="flex items-center justify-between gap-4 rounded-md p-2 text-sm hover:bg-accent"
                      >
                        <span className="truncate">{taskItem.title}</span>
                        <span
                          className={
                            overdue
                              ? 'shrink-0 font-medium text-destructive'
                              : 'shrink-0 text-muted-foreground'
                          }
                        >
                          {dateTime(taskItem.due_at)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('home.upcomingTasks.empty')}</p>
            )}
          </CardContent>
        </Card>

        <Can permission="tickets.view">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('home.recentTickets.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentTicketsQuery.data?.items.length ? (
                <ul className="flex flex-col gap-2">
                  {recentTicketsQuery.data.items.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="flex items-center justify-between gap-4 rounded-md p-2 text-sm hover:bg-accent"
                      >
                        <span className="truncate">{ticket.subject}</span>
                        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                          <Badge variant={ticketStatusVariant(ticket.status)}>
                            {t(`tickets:statuses.${ticket.status}`)}
                          </Badge>
                          {date(ticket.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('home.recentTickets.empty')}</p>
              )}
            </CardContent>
          </Card>
        </Can>
      </div>
    </div>
  )
}
