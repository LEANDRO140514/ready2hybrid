import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { OperationalLayout } from '../components/shell/OperationalLayout'
import {
  CheckinShellPage,
  DeskShellPage,
  HomePage,
  LoginPage,
  UnauthorizedPage,
} from './pages'

const rootRoute = createRootRoute({
  component: OperationalLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const unauthorizedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/unauthorized',
  component: UnauthorizedPage,
})

const checkinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/checkin',
  component: CheckinShellPage,
})

const deskRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/desk',
  component: DeskShellPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  unauthorizedRoute,
  checkinRoute,
  deskRoute,
])

export function createAppRouter(initialPath = '/') {
  const useMemory =
    import.meta.env.MODE === 'test' || initialPath !== '/'

  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    ...(useMemory
      ? {
          history: createMemoryHistory({ initialEntries: [initialPath] }),
        }
      : {}),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
