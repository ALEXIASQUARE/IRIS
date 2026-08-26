import { useState } from 'react';
import type { Country, Zone } from '../types';
import ClientAuth from './ClientAuth';
import ClientBooking from './ClientBooking';
import ClientStatus from './ClientStatus';
import NotificationsList from '../NotificationsList';
import { useTranslation } from '../i18n/I18nContext';

const TOKEN_KEY = 'iris_client_token';

export default function ClientSpace({
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
  const [bookingId, setBookingId] = useState<string | null>(null);

  function handleAuth(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setBookingId(null);
  }

  if (!token) {
    return (
      <ClientAuth country={country} zone={zone} onAuth={handleAuth} onLocationChange={onLocationChange} />
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">{t('client.connectedAs')}</span>
          <button className="secondary" onClick={handleLogout}>
            {t('common.logout')}
          </button>
        </div>
      </div>

      <NotificationsList token={token} />

      {bookingId ? (
        <ClientStatus
          token={token}
          bookingId={bookingId}
          onNewBooking={() => setBookingId(null)}
        />
      ) : (
        <ClientBooking
          token={token}
          country={country}
          zone={zone}
          onBooked={(id) => setBookingId(id)}
        />
      )}
    </>
  );
}
