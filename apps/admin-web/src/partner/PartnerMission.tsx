import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { Booking } from '../types';
import IncidentReportForm from '../IncidentReportForm';
import { useTranslation } from '../i18n/I18nContext';

export default function PartnerMission({
  token,
  bookingId,
  onDone,
}: {
  token: string;
  bookingId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Évite qu'une seule coupure passagère du sondage de fond laisse le
  // bandeau d'erreur affiché indéfiniment (même une fois la mission
  // effectivement progressée).
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const b = await apiRequest<Booking>('GET', `/bookings/${bookingId}`, { token });
        if (!cancelled) {
          setBooking(b);
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
  }, [bookingId, token]);

  async function call(path: string, body?: unknown) {
    setError(null);
    setLoading(true);
    try {
      await apiRequest('POST', path, { token, body });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!booking) {
    return <div className="card">{t('partner.loadingMission')}</div>;
  }

  return (
    <div className="card">
      <h2>{t('partner.missionTitle')}</h2>
      {error && <div className="error">{error}</div>}
      <p>
        <span className="status-badge">{t(`bookingStatus.${booking.status}`)}</span>
      </p>
      <p className="muted">{booking.address?.landmark}</p>

      {booking.status === 'PARTNER_ASSIGNED' && (
        <button onClick={() => call(`/missions/${bookingId}/en-route`)} disabled={loading}>
          {t('partner.goToClient')}
        </button>
      )}

      {booking.status === 'PARTNER_EN_ROUTE' && (
        <button onClick={() => call(`/missions/${bookingId}/arrive`)} disabled={loading}>
          {t('partner.imArrived')}
        </button>
      )}

      {booking.status === 'ARRIVED' && (
        <button onClick={() => call(`/bookings/${bookingId}/request-payment`)} disabled={loading}>
          {t('partner.requestPayment')}
        </button>
      )}

      {booking.status === 'PENDING_PAYMENT' && (
        <div className="hint">{t('partner.paymentRequested')}</div>
      )}

      {booking.status === 'PAID' && (
        <>
          <div className="hint">{t('partner.paymentDone')}</div>
          <p>{t('partner.askPin')}</p>
          <div className="field">
            <label>{t('partner.pinLabel')}</label>
            <input value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} />
          </div>
          <button
            onClick={() => call(`/missions/${bookingId}/start`, { pin })}
            disabled={loading || pin.length < 4}
          >
            {t('partner.startMission')}
          </button>
        </>
      )}

      {booking.status === 'IN_PROGRESS' && (
        <>
          <div className="hint">{t('partner.missionStarted')}</div>
          <button onClick={() => call(`/missions/${bookingId}/complete`)} disabled={loading}>
            {t('partner.completeMission')}
          </button>
        </>
      )}

      {booking.status === 'COMPLETED' && (
        <>
          <div className="hint">{t('partner.missionCompleted')}</div>
          <button className="secondary" onClick={onDone}>
            {t('partner.backToOffers')}
          </button>
        </>
      )}

      {booking.status === 'CANCELLED' && (
        <>
          <div className="error">{t('partner.bookingCancelled')}</div>
          <button className="secondary" onClick={onDone}>
            {t('partner.backToOffers')}
          </button>
        </>
      )}

      {booking.status !== 'CANCELLED' && <IncidentReportForm token={token} bookingId={bookingId} />}
    </div>
  );
}
