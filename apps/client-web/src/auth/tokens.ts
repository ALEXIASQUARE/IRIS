// Stockage local de la paire de jetons. Le backend émet un accessToken court
// (15 min) et un refreshToken long (30 j) — voir AuthService.issueTokens.
// Le Testeur (apps/admin-web) ne gardait que l'accessToken : la session
// mourait au bout de 15 min. Ici on garde les deux et la couche API
// rafraîchit toute seule (voir api/client.ts).

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

const KEY = 'iris_client_tokens'

export function loadTokens(): TokenPair | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TokenPair>
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
    }
    return null
  } catch {
    return null
  }
}

export function saveTokens(tokens: TokenPair): void {
  localStorage.setItem(KEY, JSON.stringify(tokens))
}

export function clearTokens(): void {
  localStorage.removeItem(KEY)
}
