import { createBrowserRouter } from 'react-router'

import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { HealthPage } = await import('@/features/health/components/HealthPage')
          return { element: <HealthPage /> }
        },
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
