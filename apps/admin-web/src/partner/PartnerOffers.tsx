import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { PartnerOffer } from '../types';
import { useTranslation } from '../i18n/I18nContext';

export default function PartnerOffers({
  token,
  onAccepted,
}: {
  token: string;
  onAccepted: (bookingId: string) => void;
}) {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Évite qu'une seule coupure passagère du sondage de fond laisse le
  // bandeau d'erreur affiché indéfiniment.
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const list = await apiRequest<PartnerOffer[]>('GET', '/partner/offers', { token });
        if (!cancelled) {
          setOffers(list);
          setError(null);
          loadedRef.current = true;
        }
      } catch (e) {
        if (!cancelled && !loadedRef.current) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  async function accept(offer: PartnerOffer) {
    setBusyId(offer.id);
    setError(null);
    try {
      await apiRequest('POST', `/offers/${offer.id}/accept`, { token });
      onAccepted(offer.bookingId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(offer: PartnerOffer) {
    setBusyId(offer.id);
    setError(null);
    try {
      await apiRequest('POST', `/offers/${offer.id}/reject`, { token });
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2>{t('partner.offersTitle')}</h2>
      {error && <div className="error">{error}</div>}
      <p className="muted">{t('partner.offersHint')}</p>

      {offers.length === 0 ? (
        <p className="muted">{t('partner.noOffers')}</p>
      ) : (
        <ul className="item-list">
          {offers.map((o) => (
            <li key={o.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  {o.booking.address?.landmark ?? t('partner.addressFallback')} —{' '}
                  {t(`bookingStatus.${o.booking.status}`)} — {Number(o.booking.estimatedTotal).toFixed(0)}{' '}
                  {o.booking.currency}
                </span>
                <div className="row">
                  <button onClick={() => accept(o)} disabled={busyId === o.id}>
                    {t('partner.accept')}
                  </button>
                  <button className="secondary" onClick={() => reject(o)} disabled={busyId === o.id}>
                    {t('partner.reject')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
