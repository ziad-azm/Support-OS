import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3Icon,
  BookOpenIcon,
  Building2Icon,
  ChevronDownIcon,
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
  MapPinIcon,
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
import { BrandMark } from '@/shared/branding'
import { cn } from '@/shared/lib/cn'
import { Button, buttonVariants } from '@/shared/ui/primitives/button'

const COLLAPSE_STORAGE_KEY = 'supportos.sidebar.collapsed'
const SECTION_COLLAPSE_STORAGE_KEY = 'supportos.sidebar.sections.collapsed'

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

/** Per-section open/closed state, keyed by `NavSection`'s `id`. Every
 *  section defaults to open (unchanged behavior) until a viewer folds one
 *  away — same per-viewer, non-critical persistence as `COLLAPSE_STORAGE_KEY`. */
function readCollapsedSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(SECTION_COLLAPSE_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Record<string, boolean>
  } catch {
    // Per-viewer convenience only — fall back to every section open.
  }
  return {}
}

function writeCollapsedSections(value: Record<string, boolean>) {
  try {
    localStorage.setItem(SECTION_COLLAPSE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Per-viewer convenience only — a private window or blocked storage just
    // means the preference doesn't persist, not a broken sidebar.
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

/** Labeled, collapsible wrapper around a multi-link nav group (`UX-002`) —
 *  the label and its toggle hide when the whole sidebar is `collapsed` to
 *  icons-only, matching every other text label in this file. When the
 *  sidebar itself is expanded, a viewer can fold a section closed to shrink
 *  the overall list instead of scrolling past groups they don't use. */
function NavSection({
  label,
  collapsed,
  open,
  onToggle,
  children,
}: {
  label: string
  collapsed: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  if (collapsed) {
    return <div className="flex flex-col gap-1">{children}</div>
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span>{label}</span>
        <ChevronDownIcon className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
      </button>
      {open ? children : null}
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
    can('departments.view') ||
    can('branches.view') ||
    can('integrations.manage') ||
    can('communications.manage') ||
    can('webhooks.manage')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [collapsedSections, setCollapsedSections] = useState(readCollapsedSections)

  function toggleSection(id: string) {
    setCollapsedSections((current) => {
      const next = { ...current, [id]: !current[id] }
      writeCollapsedSections(next)
      return next
    })
  }

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
        {collapsed ? null : <BrandMark className="flex-1" />}
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
        <NavSection
          label={t('sidebar.sections.support')}
          collapsed={collapsed}
          open={!collapsedSections.support}
          onToggle={() => toggleSection('support')}
        >
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
            {user?.department ? (
              <SidebarLink
                to="/tickets/department"
                icon={Building2Icon}
                label={t('tickets:departmentQueue.title')}
                collapsed={collapsed}
              />
            ) : null}
            {/* A distinct icon from the department queue above on purpose:
                when the sidebar collapses to icons only, two adjacent
                Building2Icon links would be indistinguishable. */}
            {user?.branch ? (
              <SidebarLink
                to="/tickets/branch"
                icon={MapPinIcon}
                label={t('tickets:branchQueue.title')}
                collapsed={collapsed}
              />
            ) : null}
          </Can>
          <Can permission="tickets.manage">
            <SidebarLink
              to="/categories"
              icon={TagIcon}
              label={t('tickets:categories.title')}
              collapsed={collapsed}
            />
          </Can>
          {/* Deliberately ungated, unlike every other link in this file:
              TaskViewSet scopes to request.user's own rows (personal, safe
              for any staff account), and after Story 84 a portal-only
              account never reaches this sidebar at all — RedirectPortalOnly
              sends it to /portal before RootLayout ever renders. */}
          <SidebarLink
            to="/tasks"
            icon={ListTodoIcon}
            label={t('tasks:title')}
            collapsed={collapsed}
          />
        </NavSection>
        <Can permission="knowledge_base.view">
          <NavSection
            label={t('knowledgeBase:title')}
            collapsed={collapsed}
            open={!collapsedSections.knowledgeBase}
            onToggle={() => toggleSection('knowledgeBase')}
          >
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
          <NavSection
            label={t('sidebar.sections.administration')}
            collapsed={collapsed}
            open={!collapsedSections.administration}
            onToggle={() => toggleSection('administration')}
          >
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
            <Can permission="departments.view">
              <SidebarLink
                to="/settings/departments"
                icon={Building2Icon}
                label={t('organization:departments.title')}
                collapsed={collapsed}
              />
            </Can>
            <Can permission="branches.view">
              <SidebarLink
                to="/settings/branches"
                icon={MapPinIcon}
                label={t('organization:branches.title')}
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
          <NavSection
            label={t('reports:navSection')}
            collapsed={collapsed}
            open={!collapsedSections.reports}
            onToggle={() => toggleSection('reports')}
          >
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
