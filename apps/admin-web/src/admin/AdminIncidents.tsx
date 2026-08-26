import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { Incident } from '../types';
import { useTranslation } from '../i18n/I18nContext';

export default function AdminIncidents({ token }: { token: string }) {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const list = await apiRequest<Incident[]>('GET', '/admin/incidents', { token });
      setIncidents(list);
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

  async function resolve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiRequest('POST', `/admin/incidents/${id}/resolve`, {
        token,
        body: { notes: 'Résolu depuis le testeur.' },
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2>{t('admin.incidentsTitle')}</h2>
      {error && <div className="error">{error}</div>}

      {incidents.length === 0 ? (
        <p className="muted">{t('admin.noIncidents')}</p>
      ) : (
        <ul className="item-list">
          {incidents.map((i) => (
            <li key={i.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  <strong>{t(`incidentTypes.${i.type}`)}</strong> ({i.severity}) — {i.status}
                  {i.reporter && (
                    <>
                      {' '}
                      {t('admin.reportedBy', {
                        name: `${i.reporter.firstName} ${i.reporter.lastName}`,
                        role: i.reporter.role,
                      })}
                    </>
                  )}
                </span>
                {i.status === 'OPEN' && (
                  <button onClick={() => resolve(i.id)} disabled={busyId === i.id}>
                    {t('admin.resolve')}
                  </button>
                )}
              </div>
              <p className="muted">{i.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
