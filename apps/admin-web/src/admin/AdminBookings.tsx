import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { AdminBookingDetail, AdminBookingList, BookingStatus } from '../types';
import { useTranslation } from '../i18n/I18nContext';

const ALL_STATUSES: BookingStatus[] = [
  'DRAFT',
  'SEARCHING_PARTNER',
  'PARTNER_ASSIGNED',
  'PARTNER_EN_ROUTE',
  'ARRIVED',
  'PRICE_REVISION_PENDING',
  'PENDING_PAYMENT',
  'PAID',
  'IN_PROGRESS',
  'COMPLETION_REQUESTED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
];

// Vue d'ensemble admin : toutes les réservations, leur statut courant côté
// client comme partenaire, et le détail de la transaction (moyen, montants,
// commission) — répond au besoin de visualiser les paiements de bout en
// bout sans avoir à interroger la base directement.
export default function AdminBookings({
  token,
  initialStatusFilter,
  clientFilter,
  onClearClientFilter,
}: {
  token: string;
  initialStatusFilter?: BookingStatus;
  // Filtre par client (voir AdminClients — "voir toutes les réservations
  // d'un client en cliquant sur lui"). Contrairement à initialStatusFilter,
  // pas de sélecteur pour le changer depuis cet écran : on l'affiche comme
  // un bandeau explicite avec un bouton pour le retirer.
  clientFilter?: { id: string; label: string };
  onClearClientFilter?: () => void;
}) {
  const { t } = useTranslation();
  const [list, setList] = useState<AdminBookingList | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | ''>(initialStatusFilter ?? '');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function load() {
    try {
      // 10 par page : la liste tient sur un écran et les boutons
      // Précédent / Suivant deviennent réellement utilisables (25 masquait
      // la pagination tant qu'il y avait moins de 25 réservations).
      const qs = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (statusFilter) qs.set('status', statusFilter);
      if (clientFilter) qs.set('clientId', clientFilter.id);
      const data = await apiRequest<AdminBookingList>('GET', `/admin/bookings?${qs.toString()}`, { token });
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, clientFilter?.id, page]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await apiRequest<AdminBookingDetail>('GET', `/admin/bookings/${selectedId}`, { token });
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, token]);

  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="card">
      <h2>{t('admin.bookingsTitle')}</h2>
      {error && <div className="error">{error}</div>}

      {clientFilter && (
        <div className="hint row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span>{t('admin.bookingsFilteredByClient', { name: clientFilter.label })}</span>
          <button className="secondary" onClick={onClearClientFilter}>
            {t('admin.bookingsClearClientFilter')}
          </button>
        </div>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="field">
          <label>{t('admin.bookingsStatusFilter')}</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as BookingStatus | '');
              setPage(1);
            }}
          >
            <option value="">{t('admin.bookingsAllStatuses')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`bookingStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!list ? (
        <p className="muted">{t('common.loading')}</p>
      ) : list.items.length === 0 ? (
        <p className="muted">{t('admin.bookingsEmpty')}</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.bookingsColClient')}</th>
                  <th>{t('admin.bookingsColPartner')}</th>
                  <th>{t('admin.bookingsColZone')}</th>
                  <th>{t('admin.bookingsColService')}</th>
                  <th>{t('admin.bookingsColStatus')}</th>
                  <th>{t('admin.bookingsColPayment')}</th>
                  <th>{t('admin.bookingsColTotal')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.client.firstName} {b.client.lastName}
                      <div className="muted">{b.client.phone}</div>
                    </td>
                    <td>
                      {b.assignedPartner
                        ? `${b.assignedPartner.user.firstName} ${b.assignedPartner.user.lastName}`
                        : '—'}
                    </td>
                    <td>
                      {b.zone.cityName} — {b.zone.name}
                    </td>
                    <td>{b.serviceCategory.name}</td>
                    <td>
                      <span className="status-badge">{t(`bookingStatus.${b.status}`)}</span>
                    </td>
                    <td>{b.payment ? `${b.payment.provider} — ${b.payment.status}` : '—'}</td>
                    <td>
                      {/* estimatedTotal/finalTotal sont des Decimal Prisma, donc des
                          chaînes en JSON (pas des nombres) -- Number(...) est requis
                          avant .toFixed(), sinon TypeError et page blanche (aucun
                          error boundary ne rattrape un crash de rendu ici). */}
                      {Number(b.finalTotal ?? b.estimatedTotal).toFixed(0)} {b.currency}
                    </td>
                    <td>
                      <button className="secondary" onClick={() => setSelectedId(b.id)}>
                        {t('admin.bookingsViewDetail')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.previous')}
            </button>
            <span className="muted">
              {t('admin.bookingsPageOf', { page: list.page, totalPages })}
            </span>
            <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common.next')}
            </button>
          </div>
        </>
      )}

      {selectedId && (
        <div className="card" style={{ marginTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>{t('admin.bookingsDetailTitle')}</h3>
            <button className="secondary" onClick={() => setSelectedId(null)}>
              {t('common.close')}
            </button>
          </div>
          {detailError && <div className="error">{detailError}</div>}
          {!detail ? (
            <p className="muted">{t('common.loading')}</p>
          ) : (
            <>
              <p>
                <strong>
                  {detail.client.firstName} {detail.client.lastName}
                </strong>{' '}
                ({detail.client.phone}) — <span className="status-badge">{t(`bookingStatus.${detail.status}`)}</span>
              </p>
              <p className="muted">{detail.address.landmark}</p>

              <h4>{t('admin.bookingsDetailPayment')}</h4>
              {detail.payment ? (
                <ul className="item-list">
                  <li>
                    <span>{t('admin.bookingsColPayment')}</span>
                    <strong>
                      {detail.payment.provider} — {detail.payment.status}
                    </strong>
                  </li>
                  <li>
                    <span>{t('admin.bookingsDetailAmount')}</span>
                    <strong>
                      {Number(detail.payment.amount).toFixed(0)} {detail.currency}
                    </strong>
                  </li>
                  <li>
                    <span>{t('admin.bookingsDetailCommission')}</span>
                    <strong>
                      {Number(detail.payment.platformCommission).toFixed(0)} {detail.currency}
                    </strong>
                  </li>
                  <li>
                    <span>{t('admin.bookingsDetailPayout')}</span>
                    <strong>
                      {Number(detail.payment.partnerPayout).toFixed(0)} {detail.currency}
                    </strong>
                  </li>
                </ul>
              ) : (
                <p className="muted">{t('admin.bookingsDetailNoPayment')}</p>
              )}

              {detail.priceRevisions.length > 0 && (
                <>
                  <h4>{t('admin.bookingsDetailRevisions')}</h4>
                  <ul className="item-list">
                    {detail.priceRevisions.map((r) => (
                      <li key={r.id}>
                        <span>
                          {Number(r.previousTotal).toFixed(0)} → {Number(r.newTotal).toFixed(0)} ({r.reason})
                        </span>
                        <strong>{r.confirmedByClientAt ? t('admin.bookingsRevisionConfirmed') : t('admin.bookingsRevisionPending')}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {detail.offers.length > 0 && (
                <>
                  <h4>{t('admin.bookingsDetailOffers')}</h4>
                  <ul className="item-list">
                    {detail.offers.map((o) => (
                      <li key={o.id}>
                        <span>
                          {o.partnerProfile.user.firstName} {o.partnerProfile.user.lastName}
                        </span>
                        <strong>{o.status}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {detail.incidents.length > 0 && (
                <>
                  <h4>{t('admin.bookingsDetailIncidents')}</h4>
                  <ul className="item-list">
                    {detail.incidents.map((i) => (
                      <li key={i.id}>
                        <span>{i.description}</span>
                        <strong>
                          {i.severity} — {i.status}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
