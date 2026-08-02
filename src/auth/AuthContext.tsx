import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  createAuthPort,
  createDefaultAuthorizationPort,
} from './ports'
import type {
  AuthPort,
  AuthSession,
  AuthorizationPort,
  OperationalAssignment,
  OperationalRole,
} from './types'

type AuthContextValue = {
  session: AuthSession
  role: OperationalRole | null
  roleResolved: boolean
  assignment: OperationalAssignment | null
  assignmentResolved: boolean
  refresh: () => Promise<void>
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const loadingSession: AuthSession = {
  status: 'loading',
  user: null,
  errorMessage: null,
}

export type AuthProviderProps = {
  children: ReactNode
  authPort?: AuthPort
  authorizationPort?: AuthorizationPort
}

export function AuthProvider({
  children,
  authPort,
  authorizationPort,
}: AuthProviderProps) {
  const auth = useMemo(() => authPort ?? createAuthPort(), [authPort])
  const authorization = useMemo(
    () => authorizationPort ?? createDefaultAuthorizationPort(),
    [authorizationPort],
  )

  const [session, setSession] = useState<AuthSession>(loadingSession)
  const [role, setRole] = useState<OperationalRole | null>(null)
  const [roleResolved, setRoleResolved] = useState(false)
  const [assignment, setAssignment] = useState<OperationalAssignment | null>(
    null,
  )
  const [assignmentResolved, setAssignmentResolved] = useState(false)

  const refresh = useCallback(async () => {
    setSession(loadingSession)
    setRoleResolved(false)
    setAssignmentResolved(false)
    const next = await auth.getSession()
    setSession(next)
    if (next.status !== 'authenticated' || !next.user) {
      setRole(null)
      setAssignment(null)
      setRoleResolved(true)
      setAssignmentResolved(true)
      return
    }
    const [resolvedRole, resolvedAssignment] = await Promise.all([
      authorization.resolveRole(next.user.id),
      authorization.resolveAssignment(next.user.id),
    ])
    setRole(resolvedRole)
    setAssignment(resolvedAssignment)
    setRoleResolved(true)
    setAssignmentResolved(true)
  }, [auth, authorization])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await auth.signInWithPassword(email, password)
      if (result.ok) await refresh()
      return result
    },
    [auth, refresh],
  )

  const signOut = useCallback(async () => {
    await auth.signOut()
    setRole(null)
    setAssignment(null)
    setRoleResolved(true)
    setAssignmentResolved(true)
    setSession({
      status: 'unauthenticated',
      user: null,
      errorMessage: null,
    })
  }, [auth])

  const value = useMemo(
    () => ({
      session,
      role,
      roleResolved,
      assignment,
      assignmentResolved,
      refresh,
      signIn,
      signOut,
    }),
    [
      session,
      role,
      roleResolved,
      assignment,
      assignmentResolved,
      refresh,
      signIn,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
