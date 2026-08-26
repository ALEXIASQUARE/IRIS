import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { AuditLogEntry } from '../types';
import { useTranslation } from '../i18n/I18nContext';

export default function AdminAuditLog({ token }: { token: string }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await apiRequest<AuditLogEntry[]>('GET', '/admin/audit-logs', { token });
        if (!cancelled) setLogs(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <div className="card">
      <h2>{t('admin.auditTitle')}</h2>
      {error && <div className="error">{error}</div>}
      {logs.length === 0 ? (
        <p className="muted">{t('admin.noAuditEntries')}</p>
      ) : (
        <ul className="item-list">
          {logs.map((l) => (
            <li key={l.id}>
              <span>
                <strong>{l.action}</strong> — {l.targetType} #{l.targetId.slice(0, 8)} —{' '}
                {t('admin.auditEntryBy')} {l.actor.firstName} {l.actor.lastName}
              </span>
              <span className="muted">{new Date(l.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
