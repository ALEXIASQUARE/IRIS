import { useState } from 'react';
import type { BookingStatus, Country, PartnerStatus } from '../types';
import AdminAuth from './AdminAuth';
import AdminDashboard from './AdminDashboard';
import AdminPartners from './AdminPartners';
import AdminClients from './AdminClients';
import AdminIncidents from './AdminIncidents';
import AdminAuditLog from './AdminAuditLog';
import AdminCatalog from './AdminCatalog';
import AdminGeo from './AdminGeo';
import AdminBookings from './AdminBookings';
import { useTranslation } from '../i18n/I18nContext';

const TOKEN_KEY = 'iris_admin_token';

type Tab = 'dashboard' | 'bookings' | 'partners' | 'clients' | 'incidents' | 'audit' | 'catalog' | 'geo';

export default function AdminSpace({ country }: { country: Country }) {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState<Tab>('dashboard');

  // Permet au tableau de bord de renvoyer directement vers la liste
  // correspondante, filtrée sur la ligne cliquée (ex: "PENDING_REVIEW" sous
  // "Partenaires par statut" -> onglet Partenaires filtré sur ce statut) —
  // réinitialisé à chaque navigation pour ne pas garder un filtre d'une
  // visite précédente au tableau de bord.
  const [pendingBookingStatus, setPendingBookingStatus] = useState<BookingStatus | undefined>();
  const [pendingPartnerStatus, setPendingPartnerStatus] = useState<PartnerStatus | undefined>();

  function navigateToBookings(status?: BookingStatus) {
    setPendingBookingStatus(status);
    setTab('bookings');
  }

  function navigateToPartners(status?: PartnerStatus) {
    setPendingPartnerStatus(status);
    setTab('partners');
  }

  function navigateToClients() {
    setTab('clients');
  }

  function handleAuth(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!token) {
    return <AdminAuth country={country} onAuth={handleAuth} />;
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">{t('admin.connectedAs')}</span>
          <button className="secondary" onClick={handleLogout}>
            {t('common.logout')}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          {t('admin.tabDashboard')}
        </button>
        <button
          className={`tab ${tab === 'bookings' ? 'active' : ''}`}
          onClick={() => {
            // Un clic direct sur l'onglet (par opposition à un clic sur une
            // ligne du tableau de bord) doit toujours montrer la liste
            // complète -- sinon un filtre posé plus tôt depuis le tableau
            // de bord (ex: "Recherche d'un partenaire en cours") reste
            // actif indéfiniment et cache silencieusement des réservations
            // dont le statut a changé depuis (ex: une réservation acceptée
            // entre-temps, désormais PARTNER_ASSIGNED).
            setPendingBookingStatus(undefined);
            setTab('bookings');
          }}
        >
          {t('admin.tabBookings')}
        </button>
        <button
          className={`tab ${tab === 'partners' ? 'active' : ''}`}
          onClick={() => {
            setPendingPartnerStatus(undefined);
            setTab('partners');
          }}
        >
          {t('admin.tabPartners')}
        </button>
        <button className={`tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>
          {t('admin.tabClients')}
        </button>
        <button className={`tab ${tab === 'incidents' ? 'active' : ''}`} onClick={() => setTab('incidents')}>
          {t('admin.tabIncidents')}
        </button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          {t('admin.tabAudit')}
        </button>
        <button className={`tab ${tab === 'catalog' ? 'active' : ''}`} onClick={() => setTab('catalog')}>
          {t('admin.tabCatalog')}
        </button>
        <button className={`tab ${tab === 'geo' ? 'active' : ''}`} onClick={() => setTab('geo')}>
          {t('admin.tabGeo')}
        </button>
      </div>

      {tab === 'dashboard' && (
        <AdminDashboard
          token={token}
          onNavigateBookings={navigateToBookings}
          onNavigatePartners={navigateToPartners}
          onNavigateClients={navigateToClients}
        />
      )}
      {/* La clé force un remontage propre à chaque changement de filtre visé
          (y compris vers "aucun filtre") : initialStatusFilter n'est lu
          qu'une fois par AdminBookings/AdminPartners (useState), donc sans
          ça, cliquer sur l'onglet alors qu'il est déjà actif ne
          réinitialisait pas le filtre affiché malgré la réinitialisation
          de pendingBookingStatus ci-dessus. */}
      {tab === 'bookings' && (
        <AdminBookings key={pendingBookingStatus ?? 'all'} token={token} initialStatusFilter={pendingBookingStatus} />
      )}
      {tab === 'partners' && (
        <AdminPartners key={pendingPartnerStatus ?? 'all'} token={token} initialStatusFilter={pendingPartnerStatus} />
      )}
      {tab === 'clients' && <AdminClients token={token} />}
      {tab === 'incidents' && <AdminIncidents token={token} />}
      {tab === 'audit' && <AdminAuditLog token={token} />}
      {tab === 'catalog' && <AdminCatalog token={token} />}
      {tab === 'geo' && <AdminGeo token={token} />}
    </>
  );
}
