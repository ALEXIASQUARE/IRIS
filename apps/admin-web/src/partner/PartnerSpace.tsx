import { useState } from 'react';
import type { Country, Zone } from '../types';
import PartnerAuth from './PartnerAuth';
import PartnerSetup from './PartnerSetup';
import PartnerOffers from './PartnerOffers';
import PartnerMission from './PartnerMission';
import NotificationsList from '../NotificationsList';
import { useTranslation } from '../i18n/I18nContext';

const TOKEN_KEY = 'iris_partner_token';

export default function PartnerSpace({
  country,
  zone,
  onLocationChange,
}: {
  country: Country;
  zone: Zone;
  onLocationChange: (country: Country, zone: Zone) => void;
}) {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  function handleAuth(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setActiveBookingId(null);
  }

  if (!token) {
    return (
      <PartnerAuth country={country} zone={zone} onAuth={handleAuth} onLocationChange={onLocationChange} />
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">{t('partner.connectedAs')}</span>
          <button className="secondary" onClick={handleLogout}>
            {t('common.logout')}
          </button>
        </div>
      </div>

      <NotificationsList token={token} />

      <PartnerSetup token={token} zone={zone} />

      {activeBookingId ? (
        <PartnerMission
          token={token}
          bookingId={activeBookingId}
          onDone={() => setActiveBookingId(null)}
        />
      ) : (
        <PartnerOffers token={token} onAccepted={(id) => setActiveBookingId(id)} />
      )}
    </>
  );
}
