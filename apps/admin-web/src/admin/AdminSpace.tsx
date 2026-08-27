import { useState } from 'react';
import type { Country } from '../types';
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
        <button className={`tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>
          {t('admin.tabBookings')}
        </button>
        <button className={`tab ${tab === 'partners' ? 'active' : ''}`} onClick={() => setTab('partners')}>
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

      {tab === 'dashboard' && <AdminDashboard token={token} />}
      {tab === 'bookings' && <AdminBookings token={token} />}
      {tab === 'partners' && <AdminPartners token={token} />}
      {tab === 'clients' && <AdminClients token={token} />}
      {tab === 'incidents' && <AdminIncidents token={token} />}
      {tab === 'audit' && <AdminAuditLog token={token} />}
      {tab === 'catalog' && <AdminCatalog token={token} />}
      {tab === 'geo' && <AdminGeo token={token} />}
    </>
  );
}
