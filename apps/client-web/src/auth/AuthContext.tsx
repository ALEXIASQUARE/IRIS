import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AUTH_EXPIRED_EVENT } from '../api/client'
import { decodeJwt } from './jwt'
import { clearTokens, loadTokens, saveTokens, type TokenPair } from './tokens'

export interface AuthUser {
  id: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** Ouvre une session à partir d'une paire de jetons (login, OTP, reset). */
  setSession: (tokens: TokenPair) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function userFromTokens(tokens: TokenPair | null): AuthUser | null {
  if (!tokens) return null
  const payload = decodeJwt(tokens.accessToken)
  if (!payload) return null
  return { id: payload.sub, role: payload.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => userFromTokens(loadTokens()))

  const setSession = useCallback((tokens: TokenPair) => {
    saveTokens(tokens)
    setUser(userFromTokens(tokens))
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  // La couche API purge déjà les jetons quand le refresh échoue ; ici on ne
  // fait que remettre l'état React à zéro pour rediriger vers /login.
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, setSession, logout }),
    [user, setSession, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
