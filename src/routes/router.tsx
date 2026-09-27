import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { OperationalLayout } from '../components/shell/OperationalLayout'
import { SignupPage, VerifyEmailPage } from './account'
import {
  CheckinShellPage,
  DeskShellPage,
  FinanceShellPage,
  HomePage,
  PartnersShellPage,
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
  validateSearch: (search: Record<string, unknown>): { verified?: '1' } =>
    search.verified === '1' ? { verified: '1' } : {},
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: (): Record<string, never> => ({}),
  component: SignupPage,
})

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify-email',
  validateSearch: (search: Record<string, unknown>): { email: string } => ({
    email: typeof search.email === 'string' ? search.email : '',
  }),
  component: VerifyEmailPage,
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

const financeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/finance',
  component: FinanceShellPage,
})

const partnersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops/partners',
  component: PartnersShellPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  verifyEmailRoute,
  unauthorizedRoute,
  checkinRoute,
  deskRoute,
  financeRoute,
  partnersRoute,
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
