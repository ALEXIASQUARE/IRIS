import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { Booking } from '../types';
import IncidentReportForm from '../IncidentReportForm';
import { useTranslation } from '../i18n/I18nContext';

// PENDING_PAYMENT/PAID désignent le paiement à l'arrivée (après ARRIVED,
// lui-même non annulable) — exclus pour rester cohérent avec le backend.
const CANCELLABLE = new Set(['DRAFT', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_EN_ROUTE']);

export default function ClientStatus({
  token,
  bookingId,
  onNewBooking,
}: {
  token: string;
  bookingId: string;
  onNewBooking: () => void;
}) {
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(false);

  // Sans loadedRef, une seule coupure passagère du sondage de fond (toutes
  // les 3s) laissait le bandeau d'erreur affiché indéfiniment, même une
  // fois la connexion rétablie et le statut à jour affiché normalement.
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

  async function cancel() {
    try {
      await apiRequest('POST', `/bookings/${bookingId}/cancel`, {
        token,
        body: { reason: 'Test annulé depuis le testeur.' },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    setRating(true);
    setError(null);
    try {
      await apiRequest('POST', `/bookings/${bookingId}/rating`, {
        token,
        body: { score, comment: comment || undefined },
      });
      setRated(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setRating(false);
    }
  }

  if (!booking) {
    return <div className="card">{t('client.loadingBooking')}</div>;
  }

  return (
    <div className="card">
      <h2>{t('client.statusTitle')}</h2>
      {error && <div className="error">{error}</div>}
      <p>
        <span className="status-badge">{t(`bookingStatus.${booking.status}`)}</span>
      </p>
      <p className="muted">
        {t('client.estimatedTotal', {
          total: booking.finalTotal ?? booking.estimatedTotal,
          currency: booking.currency,
        })}
      </p>

      {booking.status === 'ARRIVED' && <div className="hint">{t('client.paymentUpcoming')}</div>}

      {booking.status === 'PENDING_PAYMENT' && <div className="hint">{t('client.paymentPending')}</div>}

      {booking.status === 'PAID' && booking.missionPin && (
        <>
          <div className="hint">{t('client.paymentConfirmed')}</div>
          <p>{t('client.givePinToPartner')}</p>
          <div className="pin">{booking.missionPin}</div>
        </>
      )}

      {booking.status === 'IN_PROGRESS' && <div className="hint">{t('client.missionInProgress')}</div>}

      {booking.status === 'COMPLETED' && !rated && (
        <form onSubmit={submitRating}>
          <h3>{t('client.rateTitle')}</h3>
          <div className="field">
            <label>{t('client.scoreLabel')}</label>
            <select value={score} onChange={(e) => setScore(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('client.commentLabel')}</label>
            <input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button type="submit" disabled={rating}>
            {t('client.sendRating')}
          </button>
        </form>
      )}
      {booking.status === 'COMPLETED' && rated && <div className="hint">{t('client.ratingSent')}</div>}

      <div className="row" style={{ marginTop: 16 }}>
        {CANCELLABLE.has(booking.status) && (
          <button className="danger" onClick={cancel}>
            {t('client.cancelBooking')}
          </button>
        )}
        {(booking.status === 'CANCELLED' || booking.status === 'COMPLETED') && (
          <button className="secondary" onClick={onNewBooking}>
            {t('client.newBooking')}
          </button>
        )}
      </div>

      {booking.status !== 'CANCELLED' && <IncidentReportForm token={token} bookingId={bookingId} />}
    </div>
  );
}
