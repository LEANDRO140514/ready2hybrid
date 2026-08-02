import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { AuthProvider, type AuthProviderProps } from './auth/AuthContext'
import { ShellErrorBoundary } from './components/shell/ShellErrorBoundary'
import { createAppRouter } from './routes/router'

export type AppProps = {
  authPort?: AuthProviderProps['authPort']
  authorizationPort?: AuthProviderProps['authorizationPort']
  initialPath?: string
}

function App({
  authPort,
  authorizationPort,
  initialPath = '/',
}: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [router] = useState(() => createAppRouter(initialPath))

  return (
    <QueryClientProvider client={queryClient}>
      <ShellErrorBoundary>
        <AuthProvider authPort={authPort} authorizationPort={authorizationPort}>
          <RouterProvider router={router} />
        </AuthProvider>
      </ShellErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
