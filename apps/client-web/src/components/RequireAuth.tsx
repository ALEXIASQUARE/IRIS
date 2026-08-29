import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Garde de routes : renvoie vers /login si non connecté, en mémorisant la
// destination pour y revenir après connexion.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
