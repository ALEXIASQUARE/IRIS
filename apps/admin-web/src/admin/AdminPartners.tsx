import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { AdminPartner, PartnerStatus } from '../types';
import { useTranslation } from '../i18n/I18nContext';

const ALL_PARTNER_STATUSES: PartnerStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
];

export default function AdminPartners({
  token,
  initialStatusFilter,
}: {
  token: string;
  initialStatusFilter?: PartnerStatus;
}) {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | ''>(initialStatusFilter ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const list = await apiRequest<AdminPartner[]>('GET', `/admin/partners${qs}`, { token });
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
  }, [token, statusFilter]);

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

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>{t('admin.bookingsStatusFilter')}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PartnerStatus | '')}
          >
            <option value="">{t('admin.bookingsAllStatuses')}</option>
            {ALL_PARTNER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

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
