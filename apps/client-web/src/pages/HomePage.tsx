import { Link } from 'react-router-dom'
import { NotificationsCard } from '../components/NotificationsCard'

export function HomePage() {
  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Bonjour 👋</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Réservez une prestation à domicile ou suivez votre demande en cours.
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gap: 10 }}>
          <Link className="btn" to="/booking">
            Nouvelle réservation
          </Link>
          <Link className="btn secondary" to="/profile">
            Mon profil
          </Link>
        </div>
      </div>

      <NotificationsCard />
    </>
  )
}
