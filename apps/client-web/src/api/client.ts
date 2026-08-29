// Client HTTP de l'espace client IRIS.
//
// Différences avec apps/admin-web/src/api.ts :
//  - en-tête Authorization ajouté automatiquement (plus de `token` passé
//    manuellement à chaque appel) ;
//  - sur un 401, tentative unique de rafraîchissement du token puis rejeu de
//    la requête — les refresh concurrents sont dédupliqués (single-flight) ;
//  - si le refresh échoue, les jetons sont purgés et un évènement
//    `iris:auth-expired` est émis (écouté par AuthContext -> déconnexion).

import { clearTokens, loadTokens, saveTokens, type TokenPair } from '../auth/tokens'

export const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const AUTH_EXPIRED_EVENT = 'iris:auth-expired'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  body?: unknown
  /** false pour un appel public (login, register…). Défaut : true. */
  auth?: boolean
  signal?: AbortSignal
}

// Le format d'erreur d'AllExceptionsFilter (backend) est
// { statusCode, timestamp, message } où `message` reprend exception.getResponse(),
// souvent lui-même { statusCode, message, error }. On déplie ce second niveau,
// sinon toutes les erreurs deviennent le message générique.
function extractMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message
    if (typeof m === 'string') return m
    if (Array.isArray(m)) return m.join(' ')
    if (m && typeof m === 'object' && 'message' in m) {
      const inner = (m as { message: unknown }).message
      if (typeof inner === 'string') return inner
      if (Array.isArray(inner)) return inner.join(' ')
    }
  }
  return 'Une erreur est survenue.'
}

let refreshInFlight: Promise<TokenPair> | null = null

async function refreshTokens(): Promise<TokenPair> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const current = loadTokens()
    if (!current) throw new ApiError('Session expirée.', 401)

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
    if (!res.ok) {
      throw new ApiError('Session expirée.', res.status)
    }
    const next = (await res.json()) as TokenPair
    saveTokens(next)
    return next
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

function onAuthExpired() {
  clearTokens()
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

async function rawRequest<T>(
  method: Method,
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<{ ok: true; data: T } | { ok: false; status: number; data: unknown }> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : undefined

  if (!res.ok) return { ok: false, status: res.status, data }
  return { ok: true, data: data as T }
}

export async function apiRequest<T>(
  method: Method,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const withAuth = options.auth !== false
  const tokens = withAuth ? loadTokens() : null

  let attempt = await rawRequest<T>(method, path, options, tokens?.accessToken ?? null)

  // 401 sur un appel authentifié : on tente un refresh puis on rejoue une fois.
  if (!attempt.ok && attempt.status === 401 && withAuth && tokens) {
    try {
      const next = await refreshTokens()
      attempt = await rawRequest<T>(method, path, options, next.accessToken)
    } catch {
      onAuthExpired()
      throw new ApiError('Session expirée, reconnectez-vous.', 401)
    }
    if (!attempt.ok && attempt.status === 401) {
      onAuthExpired()
      throw new ApiError('Session expirée, reconnectez-vous.', 401)
    }
  }

  if (!attempt.ok) {
    throw new ApiError(extractMessage(attempt.data), attempt.status)
  }
  return attempt.data
}
