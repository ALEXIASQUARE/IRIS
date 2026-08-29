import { useEffect, useState } from 'react'
import { listNotifications } from '../api/account'
import type { NotificationItem } from '../types'

// Notifications du client — sondage léger, silencieux en cas d'échec.
export function NotificationsCard() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const list = await listNotifications()
        if (!cancelled) setItems(list)
      } catch {
        /* on n'alerte pas l'utilisateur pour un hoquet de notifications */
      }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Notifications ({items.length})</strong>
        <button type="button" className="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {open &&
        (items.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Aucune notification.
          </p>
        ) : (
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <span className="muted">{n.body}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
