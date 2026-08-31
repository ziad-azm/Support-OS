import { useState } from 'react'
import {
  BookOpenIcon,
  ChartNoAxesColumnIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ContactIcon,
  FileTextIcon,
  HistoryIcon,
  InboxIcon,
  ListTodoIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TagIcon,
  TicketIcon,
  UserCogIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { Can, useAuth } from '@/shared/auth'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/primitives/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

const COLLAPSE_STORAGE_KEY = 'supportos.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Every nav link, exactly as `RootLayout.tsx` rendered it before this story —
 * same `<Can>` gates, same `t(...)` keys, same `Link to`. Only the wrapper
 * (`SidebarLink` below) and the container (`<aside>` in `RootLayout.tsx`)
 * changed. See Story 51 `## Story Goal`.
 */
function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  icon: typeof ContactIcon
  label: string
  collapsed: boolean
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn('justify-start gap-2', collapsed && 'justify-center px-0')}
    >
      <Link
        to={to}
        aria-label={collapsed ? label : undefined}
        title={collapsed ? label : undefined}
      >
        <Icon />
        {collapsed ? null : label}
      </Link>
    </Button>
  )
}

export function Sidebar() {
  const { t } = useTranslation([
    'common',
    'customers',
    'tickets',
    'tasks',
    'knowledgeBase',
    'accounts',
    'auditLog',
    'organization',
    'reports',
  ])
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next))
      } catch {
        // Per-viewer convenience only — a private window or blocked storage
        // just means the preference doesn't persist, not a broken sidebar.
      }
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex h-dvh flex-col border-e bg-card transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-3">
        {collapsed ? null : <span className="flex-1 truncate font-semibold">{t('app.name')}</span>}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleCollapsed}
          aria-label={t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}
        >
          {collapsed ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
        </Button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <Can permission="customers.view">
          <SidebarLink
            to="/customers"
            icon={ContactIcon}
            label={t('customers:title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="tickets.view">
          <SidebarLink
            to="/tickets"
            icon={TicketIcon}
            label={t('tickets:title')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/tickets/my-tickets"
            icon={InboxIcon}
            label={t('tickets:myQueue.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="tickets.manage">
          <SidebarLink
            to="/categories"
            icon={TagIcon}
            label={t('tickets:categories.title')}
            collapsed={collapsed}
          />
        </Can>
        <SidebarLink
          to="/tasks"
          icon={ListTodoIcon}
          label={t('tasks:title')}
          collapsed={collapsed}
        />
        <Can permission="knowledge_base.view">
          <SidebarLink
            to="/knowledge-base"
            icon={BookOpenIcon}
            label={t('knowledgeBase:title')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/knowledge-base/articles"
            icon={FileTextIcon}
            label={t('knowledgeBase:articles.title')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/knowledge-base/search"
            icon={SearchIcon}
            label={t('knowledgeBase:search.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="users.view">
          <SidebarLink
            to="/users"
            icon={UserCogIcon}
            label={t('accounts:users.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="roles.manage">
          <SidebarLink
            to="/roles"
            icon={ShieldCheckIcon}
            label={t('accounts:roles.title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="reports.view">
          <SidebarLink
            to="/reports/tickets"
            icon={ChartNoAxesColumnIcon}
            label={t('reports:title')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/reports/sla"
            icon={ChartNoAxesColumnIcon}
            label={t('reports:sidebarSla')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/reports/agents"
            icon={ChartNoAxesColumnIcon}
            label={t('reports:sidebarAgents')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/reports/csat"
            icon={ChartNoAxesColumnIcon}
            label={t('reports:sidebarCsat')}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/reports/dashboard"
            icon={ChartNoAxesColumnIcon}
            label={t('reports:sidebarDashboard')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="audit_log.view">
          <SidebarLink
            to="/audit-log"
            icon={HistoryIcon}
            label={t('auditLog:title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="settings.manage">
          <SidebarLink
            to="/settings"
            icon={SettingsIcon}
            label={t('organization:settings.title')}
            collapsed={collapsed}
          />
        </Can>
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t p-3">
        {user ? (
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
            <NotificationBell />
            {collapsed ? null : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
        ) : null}
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        {user ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn('justify-start gap-2', collapsed && 'justify-center px-0')}
            onClick={() => void logout()}
          >
            <LogOutIcon />
            {collapsed ? null : t('actions.logout')}
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
