import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { AuthProvider, type AuthProviderProps } from './auth/AuthContext'
import { ShellErrorBoundary } from './components/shell/ShellErrorBoundary'
import { createAppRouter } from './routes/router'
import {
  createEdgePartnersPort,
  PartnersPortProvider,
  type PartnersPort,
} from './partners/port'
import {
  createEdgeSalesPort,
  SalesPortProvider,
  type SalesPort,
} from './sales-dashboard/port'

export type AppProps = {
  authPort?: AuthProviderProps['authPort']
  authorizationPort?: AuthProviderProps['authorizationPort']
  salesPort?: SalesPort
  partnersPort?: PartnersPort
  initialPath?: string
}

function App({
  authPort,
  authorizationPort,
  salesPort,
  partnersPort,
  initialPath = '/',
}: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [router] = useState(() => createAppRouter(initialPath))
  const [resolvedSalesPort] = useState(() => salesPort ?? createEdgeSalesPort())
  const [resolvedPartnersPort] = useState(() => partnersPort ?? createEdgePartnersPort())

  return (
    <QueryClientProvider client={queryClient}>
      <ShellErrorBoundary>
        <AuthProvider authPort={authPort} authorizationPort={authorizationPort}>
          <SalesPortProvider port={resolvedSalesPort}>
            <PartnersPortProvider port={resolvedPartnersPort}>
              <RouterProvider router={router} />
            </PartnersPortProvider>
          </SalesPortProvider>
        </AuthProvider>
      </ShellErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
