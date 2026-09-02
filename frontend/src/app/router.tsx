import { createBrowserRouter } from 'react-router'

import { PublicLayout } from './PublicLayout'
import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { RedirectPortalOnly, RequireAuth, RequirePermission } from '@/shared/auth'

export const router = createBrowserRouter([
  {
    // Pathless — matched purely by its children's own paths, not nested
    // under `path: '/'`. Kept separate from the staff `RootLayout` tree
    // below so `/login`, `/chat`, `/contact` never render the staff
    // `Sidebar` (nav links, language/theme controls meant for a signed-in
    // session), the same reasoning `portal` already gets its own sibling
    // tree instead of nesting inside `RootLayout`.
    element: <PublicLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'login',
        lazy: async () => {
          const { LoginPage } = await import('@/features/auth/components/LoginPage')
          return { element: <LoginPage /> }
        },
      },
      {
        path: 'chat',
        lazy: async () => {
          const { LiveChatWidget } = await import('@/features/live-chat/components/LiveChatWidget')
          return { element: <LiveChatWidget /> }
        },
      },
      {
        path: 'contact',
        lazy: async () => {
          const { WebFormPage } = await import('@/features/web-form/components/WebFormPage')
          return { element: <WebFormPage /> }
        },
      },
      {
        path: 'set-password',
        lazy: async () => {
          const { SetPasswordPage } = await import('@/features/auth/components/SetPasswordPage')
          return { element: <SetPasswordPage /> }
        },
      },
      {
        path: 'forgot-password',
        lazy: async () => {
          const { ForgotPasswordPage } =
            await import('@/features/auth/components/ForgotPasswordPage')
          return { element: <ForgotPasswordPage /> }
        },
      },
      {
        path: 'reset-password',
        lazy: async () => {
          const { ResetPasswordPage } = await import('@/features/auth/components/ResetPasswordPage')
          return { element: <ResetPasswordPage /> }
        },
      },
    ],
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RedirectPortalOnly />,
            children: [
              {
                index: true,
                lazy: async () => {
                  const { HomePage } = await import('@/app/HomePage')
                  return { element: <HomePage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="customers.view" />,
            children: [
              {
                path: 'customers',
                lazy: async () => {
                  const { CustomerListPage } =
                    await import('@/features/customers/components/CustomerListPage')
                  return { element: <CustomerListPage /> }
                },
              },
              {
                // Must stay before `customers/:id`, or `:id` matches the
                // literal "new" and the profile page fires `/customers/new/`.
                path: 'customers/new',
                lazy: async () => {
                  const { CustomerFormPage } =
                    await import('@/features/customers/components/CustomerFormPage')
                  return { element: <CustomerFormPage /> }
                },
              },
              {
                path: 'customers/:id',
                lazy: async () => {
                  const { CustomerProfilePage } =
                    await import('@/features/customers/components/CustomerProfilePage')
                  return { element: <CustomerProfilePage /> }
                },
              },
              {
                path: 'customers/:id/edit',
                lazy: async () => {
                  const { CustomerFormPage } =
                    await import('@/features/customers/components/CustomerFormPage')
                  return { element: <CustomerFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="tickets.view" />,
            children: [
              {
                path: 'tickets',
                lazy: async () => {
                  const { TicketListPage } =
                    await import('@/features/tickets/components/TicketListPage')
                  return { element: <TicketListPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, same reason as `customers/new`.
                path: 'tickets/new',
                lazy: async () => {
                  const { TicketFormPage } =
                    await import('@/features/tickets/components/TicketFormPage')
                  return { element: <TicketFormPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, same reason as `tickets/new`.
                path: 'tickets/my-tickets',
                lazy: async () => {
                  const { MyTicketsPage } =
                    await import('@/features/tickets/components/MyTicketsPage')
                  return { element: <MyTicketsPage /> }
                },
              },
              {
                path: 'tickets/:id',
                lazy: async () => {
                  const { TicketDetailPage } =
                    await import('@/features/tickets/components/TicketDetailPage')
                  return { element: <TicketDetailPage /> }
                },
              },
              {
                path: 'tickets/:id/edit',
                lazy: async () => {
                  const { TicketFormPage } =
                    await import('@/features/tickets/components/TicketFormPage')
                  return { element: <TicketFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="knowledge_base.manage" />,
            children: [
              {
                path: 'knowledge-base/manage',
                lazy: async () => {
                  const { FaqListPage } =
                    await import('@/features/knowledge-base/components/FaqListPage')
                  return { element: <FaqListPage /> }
                },
              },
              {
                path: 'knowledge-base/manage/new',
                lazy: async () => {
                  const { FaqFormPage } =
                    await import('@/features/knowledge-base/components/FaqFormPage')
                  return { element: <FaqFormPage /> }
                },
              },
              {
                path: 'knowledge-base/manage/:id/edit',
                lazy: async () => {
                  const { FaqFormPage } =
                    await import('@/features/knowledge-base/components/FaqFormPage')
                  return { element: <FaqFormPage /> }
                },
              },
              {
                // Must stay before `knowledge-base/articles/:id` (in the
                // sibling knowledge_base.view block below) — a literal
                // "manage" would otherwise be read as the `:id` param.
                path: 'knowledge-base/articles/manage',
                lazy: async () => {
                  const { ArticleListPage } =
                    await import('@/features/knowledge-base/components/ArticleListPage')
                  return { element: <ArticleListPage /> }
                },
              },
              {
                path: 'knowledge-base/articles/manage/new',
                lazy: async () => {
                  const { ArticleFormPage } =
                    await import('@/features/knowledge-base/components/ArticleFormPage')
                  return { element: <ArticleFormPage /> }
                },
              },
              {
                path: 'knowledge-base/articles/manage/:id/edit',
                lazy: async () => {
                  const { ArticleFormPage } =
                    await import('@/features/knowledge-base/components/ArticleFormPage')
                  return { element: <ArticleFormPage /> }
                },
              },
              {
                path: 'knowledge-base/categories',
                lazy: async () => {
                  const { CategoryListPage } =
                    await import('@/features/knowledge-base/components/CategoryListPage')
                  return { element: <CategoryListPage /> }
                },
              },
              {
                // Must stay before `knowledge-base/categories/:id`, same
                // reason as `roles/new`.
                path: 'knowledge-base/categories/new',
                lazy: async () => {
                  const { CategoryFormPage } =
                    await import('@/features/knowledge-base/components/CategoryFormPage')
                  return { element: <CategoryFormPage /> }
                },
              },
              {
                path: 'knowledge-base/categories/:id/edit',
                lazy: async () => {
                  const { CategoryFormPage } =
                    await import('@/features/knowledge-base/components/CategoryFormPage')
                  return { element: <CategoryFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="knowledge_base.view" />,
            children: [
              {
                path: 'knowledge-base',
                lazy: async () => {
                  const { FaqBrowsePage } =
                    await import('@/features/knowledge-base/components/FaqBrowsePage')
                  return { element: <FaqBrowsePage /> }
                },
              },
              {
                path: 'knowledge-base/articles',
                lazy: async () => {
                  const { ArticleBrowsePage } =
                    await import('@/features/knowledge-base/components/ArticleBrowsePage')
                  return { element: <ArticleBrowsePage /> }
                },
              },
              {
                path: 'knowledge-base/articles/:id',
                lazy: async () => {
                  const { ArticleReaderPage } =
                    await import('@/features/knowledge-base/components/ArticleReaderPage')
                  return { element: <ArticleReaderPage /> }
                },
              },
              {
                path: 'knowledge-base/search',
                lazy: async () => {
                  const { SearchPage } =
                    await import('@/features/knowledge-base/components/SearchPage')
                  return { element: <SearchPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="users.view" />,
            children: [
              {
                path: 'users',
                lazy: async () => {
                  const { UserListPage } =
                    await import('@/features/accounts/components/UserListPage')
                  return { element: <UserListPage /> }
                },
              },
            ],
          },
          {
            // Split from the `users.view`-gated list route above: create/edit
            // are writes (`POST`/`PATCH /api/users/`), gated server-side by
            // `users.manage`, not `users.view` — a `users.view`-only holder
            // (e.g. the seeded `manager` role) could previously navigate to
            // and fill out these forms only to have every submit 403 as a
            // guaranteed dead end. Matches `roles`'s own single-permission
            // gate below, just split across two permissions instead of one.
            element: <RequirePermission permission="users.manage" />,
            children: [
              {
                // Must stay before `users/:id`, same reason as `customers/new`.
                path: 'users/new',
                lazy: async () => {
                  const { UserFormPage } =
                    await import('@/features/accounts/components/UserFormPage')
                  return { element: <UserFormPage /> }
                },
              },
              {
                path: 'users/:id/edit',
                lazy: async () => {
                  const { UserFormPage } =
                    await import('@/features/accounts/components/UserFormPage')
                  return { element: <UserFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="roles.manage" />,
            children: [
              {
                path: 'roles',
                lazy: async () => {
                  const { RoleListPage } =
                    await import('@/features/accounts/components/RoleListPage')
                  return { element: <RoleListPage /> }
                },
              },
              {
                // Must stay before `roles/:id`, same reason as `users/new`.
                path: 'roles/new',
                lazy: async () => {
                  const { RoleFormPage } =
                    await import('@/features/accounts/components/RoleFormPage')
                  return { element: <RoleFormPage /> }
                },
              },
              {
                path: 'roles/:id/edit',
                lazy: async () => {
                  const { RoleFormPage } =
                    await import('@/features/accounts/components/RoleFormPage')
                  return { element: <RoleFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="tickets.manage" />,
            children: [
              {
                path: 'categories',
                lazy: async () => {
                  const { CategoryListPage } =
                    await import('@/features/tickets/components/CategoryListPage')
                  return { element: <CategoryListPage /> }
                },
              },
              {
                // Must stay before `categories/:id`, same reason as `roles/new`.
                path: 'categories/new',
                lazy: async () => {
                  const { CategoryFormPage } =
                    await import('@/features/tickets/components/CategoryFormPage')
                  return { element: <CategoryFormPage /> }
                },
              },
              {
                path: 'categories/:id/edit',
                lazy: async () => {
                  const { CategoryFormPage } =
                    await import('@/features/tickets/components/CategoryFormPage')
                  return { element: <CategoryFormPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="reports.view" />,
            children: [
              {
                path: 'reports/tickets',
                lazy: async () => {
                  const { TicketReportsPage } =
                    await import('@/features/reports/components/TicketReportsPage')
                  return { element: <TicketReportsPage /> }
                },
              },
              {
                path: 'reports/sla',
                lazy: async () => {
                  const { SlaReportsPage } =
                    await import('@/features/reports/components/SlaReportsPage')
                  return { element: <SlaReportsPage /> }
                },
              },
              {
                path: 'reports/agents',
                lazy: async () => {
                  const { AgentReportsPage } =
                    await import('@/features/reports/components/AgentReportsPage')
                  return { element: <AgentReportsPage /> }
                },
              },
              {
                path: 'reports/csat',
                lazy: async () => {
                  const { CsatReportsPage } =
                    await import('@/features/reports/components/CsatReportsPage')
                  return { element: <CsatReportsPage /> }
                },
              },
              {
                path: 'reports/dashboard',
                lazy: async () => {
                  const { ManagementDashboardPage } =
                    await import('@/features/reports/components/ManagementDashboardPage')
                  return { element: <ManagementDashboardPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="audit_log.view" />,
            children: [
              {
                path: 'audit-log',
                lazy: async () => {
                  const { AuditLogListPage } =
                    await import('@/features/audit-log/components/AuditLogListPage')
                  return { element: <AuditLogListPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="settings.manage" />,
            children: [
              {
                path: 'settings',
                lazy: async () => {
                  const { SettingsPage } =
                    await import('@/features/organization/components/SettingsPage')
                  return { element: <SettingsPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="integrations.manage" />,
            children: [
              {
                path: 'settings/erp',
                lazy: async () => {
                  const { ErpSettingsPage } =
                    await import('@/features/integrations/components/ErpSettingsPage')
                  return { element: <ErpSettingsPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="communications.manage" />,
            children: [
              {
                path: 'settings/channels',
                lazy: async () => {
                  const { ChannelSettingsPage } =
                    await import('@/features/communications/components/ChannelSettingsPage')
                  return { element: <ChannelSettingsPage /> }
                },
              },
            ],
          },
          {
            element: <RequirePermission permission="webhooks.manage" />,
            children: [
              {
                path: 'settings/webhooks',
                lazy: async () => {
                  const { WebhookSubscriptionListPage } =
                    await import('@/features/webhooks/components/WebhookSubscriptionListPage')
                  return { element: <WebhookSubscriptionListPage /> }
                },
              },
              {
                // Must stay before `settings/webhooks/:id/edit`, same reason
                // `roles/new` is declared before `roles/:id/edit` above.
                path: 'settings/webhooks/new',
                lazy: async () => {
                  const { WebhookSubscriptionFormPage } =
                    await import('@/features/webhooks/components/WebhookSubscriptionFormPage')
                  return { element: <WebhookSubscriptionFormPage /> }
                },
              },
              {
                path: 'settings/webhooks/:id/edit',
                lazy: async () => {
                  const { WebhookSubscriptionFormPage } =
                    await import('@/features/webhooks/components/WebhookSubscriptionFormPage')
                  return { element: <WebhookSubscriptionFormPage /> }
                },
              },
            ],
          },
          {
            path: 'tasks',
            lazy: async () => {
              const { TaskListPage } = await import('@/features/tasks/components/TaskListPage')
              return { element: <TaskListPage /> }
            },
          },
          {
            // Must stay before `tasks/:id/edit`, same reason
            // `tickets/new` is declared before `tickets/:id`.
            path: 'tasks/new',
            lazy: async () => {
              const { TaskFormPage } = await import('@/features/tasks/components/TaskFormPage')
              return { element: <TaskFormPage /> }
            },
          },
          {
            path: 'tasks/:id/edit',
            lazy: async () => {
              const { TaskFormPage } = await import('@/features/tasks/components/TaskFormPage')
              return { element: <TaskFormPage /> }
            },
          },
          {
            path: 'preferences',
            lazy: async () => {
              const { PreferencesPage } = await import('./PreferencesPage')
              return { element: <PreferencesPage /> }
            },
          },
        ],
      },
      {
        path: '*',
        lazy: async () => {
          const { NotFoundPage } = await import('./NotFoundPage')
          return { element: <NotFoundPage /> }
        },
      },
    ],
  },
  {
    // Sibling of the `path: '/'` tree above, not nested inside it — a
    // customer-facing shell must not render inside the staff `RootLayout`
    // (staff nav, `NotificationBell`). See Story 42 `## Story Goal`.
    path: 'portal',
    lazy: async () => {
      const { PortalLayout } = await import('@/features/portal/components/PortalLayout')
      return { element: <PortalLayout /> }
    },
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequirePermission permission="portal.access" />,
            children: [
              {
                index: true,
                lazy: async () => {
                  const { PortalHomePage } =
                    await import('@/features/portal/components/PortalHomePage')
                  return { element: <PortalHomePage /> }
                },
              },
              {
                path: 'faqs',
                lazy: async () => {
                  const { PortalFaqPage } =
                    await import('@/features/portal/components/PortalFaqPage')
                  return { element: <PortalFaqPage /> }
                },
              },
              {
                path: 'chat',
                lazy: async () => {
                  const { PortalChatbotPage } =
                    await import('@/features/portal/components/PortalChatbotPage')
                  return { element: <PortalChatbotPage /> }
                },
              },
              {
                path: 'articles',
                lazy: async () => {
                  const { PortalArticleListPage } =
                    await import('@/features/portal/components/PortalArticleListPage')
                  return { element: <PortalArticleListPage /> }
                },
              },
              {
                path: 'articles/:id',
                lazy: async () => {
                  const { PortalArticleReaderPage } =
                    await import('@/features/portal/components/PortalArticleReaderPage')
                  return { element: <PortalArticleReaderPage /> }
                },
              },
              {
                path: 'tickets',
                lazy: async () => {
                  const { PortalTicketListPage } =
                    await import('@/features/portal/components/PortalTicketListPage')
                  return { element: <PortalTicketListPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, same reason `tickets/new`
                // already does — a literal "history"/"new" segment would
                // otherwise match the `:id` param first.
                path: 'tickets/history',
                lazy: async () => {
                  const { PortalTicketHistoryPage } =
                    await import('@/features/portal/components/PortalTicketHistoryPage')
                  return { element: <PortalTicketHistoryPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, the same reason
                // `customers/new`/`tickets/new` are declared before their
                // own `:id` siblings elsewhere in this file.
                path: 'tickets/new',
                lazy: async () => {
                  const { PortalTicketFormPage } =
                    await import('@/features/portal/components/PortalTicketFormPage')
                  return { element: <PortalTicketFormPage /> }
                },
              },
              {
                path: 'tickets/:id',
                lazy: async () => {
                  const { PortalTicketDetailPage } =
                    await import('@/features/portal/components/PortalTicketDetailPage')
                  return { element: <PortalTicketDetailPage /> }
                },
              },
              {
                path: 'tickets/:id/feedback',
                lazy: async () => {
                  const { PortalFeedbackFormPage } =
                    await import('@/features/portal/components/PortalFeedbackFormPage')
                  return { element: <PortalFeedbackFormPage /> }
                },
              },
            ],
          },
        ],
      },
    ],
  },
])
