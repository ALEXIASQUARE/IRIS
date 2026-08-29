// Décodage (sans vérification de signature — c'est le serveur qui vérifie)
// du payload d'un JWT IRIS : { sub, role, iat, exp }. Voir
// AuthService.issueTokens côté backend.

export interface JwtPayload {
  sub: string
  role: string
  iat?: number
  exp?: number
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(json) as JwtPayload
    if (typeof data.sub === 'string' && typeof data.role === 'string') return data
    return null
  } catch {
    return null
  }
}

/** true si le token est absent, illisible, ou expiré (avec `skewSeconds` de marge). */
export function isExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000
}
