import { createBrowserRouter } from 'react-router'

import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { RequireAuth, RequirePermission } from '@/shared/auth'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
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
        element: <RequireAuth />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { HealthPage } = await import('@/features/health/components/HealthPage')
              return { element: <HealthPage /> }
            },
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
                path: 'tickets/new',
                lazy: async () => {
                  const { PortalTicketFormPage } =
                    await import('@/features/portal/components/PortalTicketFormPage')
                  return { element: <PortalTicketFormPage /> }
                },
              },
            ],
          },
        ],
      },
    ],
  },
])
