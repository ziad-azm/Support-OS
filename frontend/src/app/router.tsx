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
])
