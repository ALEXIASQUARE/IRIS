import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { BookingStatus, DashboardData, PartnerStatus } from '../types';
import { useTranslation } from '../i18n/I18nContext';

// Chaque ligne du tableau de bord renvoie vers la liste correspondante,
// déjà filtrée — répond au besoin "toutes les lignes soient cliquables et
// qu'on puisse avoir accès aux contenus" (un compte n'apparaît nulle part
// autrement que dans ces trois listes, il n'y a pas de vue "tous les
// utilisateurs" séparée).
export default function AdminDashboard({
  token,
  onNavigateBookings,
  onNavigatePartners,
  onNavigateClients,
}: {
  token: string;
  onNavigateBookings: (status?: BookingStatus) => void;
  onNavigatePartners: (status?: PartnerStatus) => void;
  onNavigateClients: () => void;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const d = await apiRequest<DashboardData>('GET', '/admin/dashboard', { token });
        if (!cancelled) setData(d);
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

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="card">{t('common.loading')}</div>;

  return (
    <div className="card">
      <h2>{t('admin.dashboardTitle')}</h2>

      <h3>{t('admin.bookingsByStatus')}</h3>
      <ul className="item-list">
        {data.bookingsByStatus.map((b) => (
          <li key={b.status} className="clickable" onClick={() => onNavigateBookings(b.status)}>
            <span>{t(`bookingStatus.${b.status}`) ?? b.status}</span>
            <strong>{b.count}</strong>
          </li>
        ))}
      </ul>

      <h3>{t('admin.partnersByStatus')}</h3>
      <ul className="item-list">
        {data.partnersByStatus.map((p) => (
          <li key={p.status} className="clickable" onClick={() => onNavigatePartners(p.status)}>
            <span>{p.status}</span>
            <strong>{p.count}</strong>
          </li>
        ))}
      </ul>

      <h3>{t('admin.usersByRole')}</h3>
      <ul className="item-list">
        {data.usersByRole.map((u) => {
          const onClick =
            u.role === 'PARTNER' ? () => onNavigatePartners() : u.role === 'CLIENT' ? onNavigateClients : undefined;
          return (
            <li key={u.role} className={onClick ? 'clickable' : undefined} onClick={onClick}>
              <span>{u.role}</span>
              <strong>{u.count}</strong>
            </li>
          );
        })}
      </ul>

      <h3>{t('admin.ratingSectionTitle')}</h3>
      <p className="muted">
        {t('admin.averageRating', {
          avg: data.averageRating ? data.averageRating.toFixed(2) : '—',
          count: data.ratingCount,
        })}
      </p>
    </div>
  );
}
