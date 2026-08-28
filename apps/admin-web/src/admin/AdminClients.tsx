import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { AdminClient } from '../types';
import { useTranslation } from '../i18n/I18nContext';

// Pendant de AdminPartners côté client : liste des comptes, ville par
// défaut (si renseignée — voir ClientProfileScreen), nombre de réservations,
// et blocage/déblocage (User.isBlocked, déjà vérifié à la connexion côté
// AuthService.login).
export default function AdminClients({
  token,
  onViewBookings,
}: {
  token: string;
  onViewBookings: (clientId: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const list = await apiRequest<AdminClient[]>('GET', '/admin/clients', { token });
      setClients(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function block(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest('POST', `/admin/clients/${id}/block`, { token });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function unblock(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest('POST', `/admin/clients/${id}/unblock`, { token });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2>{t('admin.clientsTitle')}</h2>
      {error && <div className="error">{error}</div>}

      {clients.length === 0 ? (
        <p className="muted">{t('admin.noClients')}</p>
      ) : (
        <ul className="item-list">
          {clients.map((c) => {
            const label = `${c.firstName} ${c.lastName}`;
            return (
              <li
                key={c.id}
                className="clickable"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                onClick={() => onViewBookings(c.id, label)}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {label} ({c.phone})
                    {c.isBlocked && <strong> — {t('admin.clientBlocked')}</strong>}
                    <div className="muted">
                      {c.homeZone ? `${c.homeZone.cityName} - ${c.homeZone.name}` : t('admin.clientNoZone')}
                      {' · '}
                      {t('admin.clientBookingsCount', { count: c._count.bookingsAsClient })}
                      {' · '}
                      {t('admin.clientJoinedOn', { date: new Date(c.createdAt).toLocaleDateString() })}
                    </div>
                  </span>
                  <div className="row">
                    {c.isBlocked ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unblock(c.id);
                        }}
                        disabled={busyId === c.id}
                      >
                        {t('admin.unblock')}
                      </button>
                    ) : (
                      <button
                        className="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          block(c.id);
                        }}
                        disabled={busyId === c.id}
                      >
                        {t('admin.block')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
