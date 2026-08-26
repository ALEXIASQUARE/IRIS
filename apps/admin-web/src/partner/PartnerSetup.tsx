import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { Zone } from '../types';
import { useTranslation } from '../i18n/I18nContext';

export default function PartnerSetup({ token, zone }: { token: string; zone: Zone }) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Filet de sécurité : le profil est normalement déjà créé à l'inscription
    // (voir PartnerAuth), cet appel idempotent couvre les comptes créés avant
    // ce changement.
    apiRequest('POST', '/partner/profile', { token, body: { currentZoneId: zone.id } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, zone.id]);

  async function toggleAvailable() {
    const next = !available;
    setError(null);
    setLoading(true);
    try {
      await apiRequest('POST', '/partner/availability', {
        token,
        body: { isAvailable: next, currentZoneId: zone.id },
      });
      setAvailable(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>{t('partner.profileTitle')}</h2>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>
          {t('partner.profileActive', { zone: zone.name })}{' '}
          <strong>{available ? t('partner.available') : t('partner.unavailable')}</strong>
        </span>
        <button className={available ? 'danger' : ''} onClick={toggleAvailable} disabled={loading}>
          {available ? t('partner.setUnavailable') : t('partner.setAvailable')}
        </button>
      </div>
    </div>
  );
}
