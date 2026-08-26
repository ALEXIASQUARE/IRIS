import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { AdminPartner } from '../types';
import { useTranslation } from '../i18n/I18nContext';

export default function AdminPartners({ token }: { token: string }) {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const list = await apiRequest<AdminPartner[]>('GET', '/admin/partners', { token });
      setPartners(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest('POST', `/admin/partners/${id}/approve`, { token });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function suspend(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest('POST', `/admin/partners/${id}/suspend`, { token });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2>{t('admin.partnersTitle')}</h2>
      {error && <div className="error">{error}</div>}

      {partners.length === 0 ? (
        <p className="muted">{t('admin.noPartners')}</p>
      ) : (
        <ul className="item-list">
          {partners.map((p) => (
            <li key={p.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  {p.user.firstName} {p.user.lastName} ({p.user.phone}) — <strong>{p.status}</strong>
                  {p.averageRating ? t('admin.noteShort', { score: p.averageRating.toFixed(1) }) : ''}
                </span>
                <div className="row">
                  {p.status !== 'ACTIVE' && (
                    <button onClick={() => approve(p.id)} disabled={busyId === p.id}>
                      {t('admin.approve')}
                    </button>
                  )}
                  {p.status !== 'SUSPENDED' && (
                    <button className="danger" onClick={() => suspend(p.id)} disabled={busyId === p.id}>
                      {t('admin.suspend')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
