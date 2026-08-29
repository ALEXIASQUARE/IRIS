import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Coquille des écrans authentifiés : en-tête (logo + déconnexion) + contenu.
export function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          <img src="/logo.jpg" alt="" />
          <span>IRIS</span>
        </Link>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={handleLogout}>
          Se déconnecter
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}
