import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3Icon,
  BookOpenIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ContactIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  LogOutIcon,
  MessagesSquareIcon,
  PlugIcon,
  SearchIcon,
  Settings2Icon,
  SettingsIcon,
  ShieldCheckIcon,
  SmileIcon,
  TagIcon,
  TicketIcon,
  UserCogIcon,
  UsersIcon,
  WebhookIcon,
} from 'lucide-react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'

import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { Can, useAuth } from '@/shared/auth'
import { cn } from '@/shared/lib/cn'
import { Button, buttonVariants } from '@/shared/ui/primitives/button'

const COLLAPSE_STORAGE_KEY = 'supportos.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (stored !== null) return stored === 'true'
  } catch {
    // Fall through to the viewport check below.
  }
  // No stored preference yet (first visit, or storage blocked) — default to
  // collapsed on narrow viewports so the sidebar doesn't eat most of a
  // phone's width before the user ever gets to toggle it themselves.
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
}

/**
 * Every nav link, exactly as `RootLayout.tsx` rendered it before this story —
 * same `<Can>` gates, same `t(...)` keys, same `Link to`. Only the wrapper
 * (`SidebarLink` below) and the container (`<aside>` in `RootLayout.tsx`)
 * changed. See Story 51 `## Story Goal`.
 */
function SidebarLink({
  to,
  end,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  end?: boolean
  icon: typeof ContactIcon
  label: string
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'justify-start gap-2',
          collapsed && 'justify-center px-0',
          isActive && 'bg-accent text-accent-foreground',
        )
      }
    >
      <Icon />
      {collapsed ? null : label}
    </NavLink>
  )
}

/** Labeled wrapper around a multi-link nav group (`UX-002`) — the label
 *  hides when `collapsed`, matching every other text label in this file. */
function NavSection({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {collapsed ? null : (
        <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
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
    'integrations',
    'communications',
    'reports',
    'webhooks',
  ])
  const { user, logout, can } = useAuth()
  const showAdministration =
    can('users.view') ||
    can('roles.manage') ||
    can('audit_log.view') ||
    can('settings.manage') ||
    can('integrations.manage') ||
    can('communications.manage') ||
    can('webhooks.manage')
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
        <NavSection label={t('sidebar.sections.support')} collapsed={collapsed}>
          <Can permission="tickets.view">
            <SidebarLink
              to="/tickets"
              end
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
        </NavSection>
        <Can permission="knowledge_base.view">
          <NavSection label={t('knowledgeBase:title')} collapsed={collapsed}>
            <SidebarLink
              to="/knowledge-base"
              end
              icon={BookOpenIcon}
              label={t('knowledgeBase:faqs.title')}
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
            <Can permission="knowledge_base.manage">
              <SidebarLink
                to="/knowledge-base/categories"
                icon={TagIcon}
                label={t('knowledgeBase:categories.title')}
                collapsed={collapsed}
              />
            </Can>
          </NavSection>
        </Can>
        {showAdministration ? (
          <NavSection label={t('sidebar.sections.administration')} collapsed={collapsed}>
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
            <Can permission="integrations.manage">
              <SidebarLink
                to="/settings/erp"
                icon={PlugIcon}
                label={t('integrations:erp.navLabel')}
                collapsed={collapsed}
              />
            </Can>
            <Can permission="communications.manage">
              <SidebarLink
                to="/settings/channels"
                icon={MessagesSquareIcon}
                label={t('communications:channels.navLabel')}
                collapsed={collapsed}
              />
            </Can>
            <Can permission="webhooks.manage">
              <SidebarLink
                to="/settings/webhooks"
                icon={WebhookIcon}
                label={t('webhooks:list.navLabel')}
                collapsed={collapsed}
              />
            </Can>
          </NavSection>
        ) : null}
        <Can permission="reports.view">
          <NavSection label={t('reports:navSection')} collapsed={collapsed}>
            <SidebarLink
              to="/reports/tickets"
              icon={BarChart3Icon}
              label={t('reports:sidebarTickets')}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/reports/sla"
              icon={GaugeIcon}
              label={t('reports:sidebarSla')}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/reports/agents"
              icon={UsersIcon}
              label={t('reports:sidebarAgents')}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/reports/csat"
              icon={SmileIcon}
              label={t('reports:sidebarCsat')}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/reports/dashboard"
              icon={LayoutDashboardIcon}
              label={t('reports:sidebarDashboard')}
              collapsed={collapsed}
            />
          </NavSection>
        </Can>
        <div className="my-1 border-t" />
        <SidebarLink
          to="/preferences"
          icon={Settings2Icon}
          label={t('preferences.title')}
          collapsed={collapsed}
        />
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t p-2">
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
