import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  cancelBooking,
  confirmPriceRevision,
  getBooking,
  rateBooking,
} from '../api/bookings'
import { ApiError } from '../api/client'
import { IncidentReportForm } from '../components/IncidentReportForm'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'
import { bookingStatusLabel, CANCELLABLE_STATUSES } from '../lib/bookingStatus'
import type { Booking, PriceRevision } from '../types'

function pendingRevision(b: Booking): PriceRevision | null {
  return b.priceRevisions?.find((r) => !r.confirmedByClientAt) ?? null
}

export function StatusPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')
  const [rated, setRated] = useState(false)
  const [rating, setRating] = useState(false)
  const [confirmingRevision, setConfirmingRevision] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function poll() {
      try {
        const b = await getBooking(id)
        if (!cancelled) {
          setBooking(b)
          setError(null)
          loadedRef.current = true
        }
      } catch (e) {
        // en sondage de fond, on n'affiche l'erreur que si rien n'a jamais chargé
        if (!cancelled && !loadedRef.current) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [id])

  async function cancel() {
    try {
      await cancelBooking(id, 'Annulé depuis l\'espace client.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  async function confirmRevision(revisionId: string) {
    setConfirmingRevision(true)
    setError(null)
    try {
      await confirmPriceRevision(id, revisionId)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setConfirmingRevision(false)
    }
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault()
    setRating(true)
    setError(null)
    try {
      await rateBooking(id, score, comment || undefined)
      setRated(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setRating(false)
    }
  }

  if (!booking) {
    return error ? (
      <div className="card">
        <InlineMessage kind="error">{error}</InlineMessage>
      </div>
    ) : (
      <Spinner center />
    )
  }

  const revision = pendingRevision(booking)
  const total = Number(booking.finalTotal ?? booking.estimatedTotal)

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Suivi de la réservation</h2>
      {error && <InlineMessage kind="error">{error}</InlineMessage>}

      <p>
        <span className="status-badge">{bookingStatusLabel(booking.status)}</span>
      </p>
      <p className="muted" style={{ marginTop: 0 }}>Total</p>
      <div className="total">
        {total.toFixed(0)} {booking.currency}
      </div>

      {booking.status === 'ARRIVED' && (
        <InlineMessage kind="info">
          Le partenaire est arrivé — il va demander le paiement avant de commencer.
        </InlineMessage>
      )}

      {booking.status === 'PENDING_PAYMENT' && (
        <InlineMessage kind="info">
          Confirmez le paiement Mobile Money sur votre téléphone pour que la mission démarre.
        </InlineMessage>
      )}

      {booking.status === 'PAID' && booking.missionPin && (
        <>
          <InlineMessage kind="success">Paiement effectué.</InlineMessage>
          <p>Communiquez ce code au partenaire :</p>
          <div className="pin">{booking.missionPin}</div>
        </>
      )}

      {booking.status === 'PRICE_REVISION_PENDING' && revision && (
        <div className="card" style={{ background: '#fdecea', borderColor: '#f4c7c3' }}>
          <strong>Le partenaire propose un nouveau montant</strong>
          <p style={{ margin: '8px 0 0' }}>
            Ancien total : {Number(revision.previousTotal).toFixed(0)} {booking.currency}
            <br />
            Nouveau total : {Number(revision.newTotal).toFixed(0)} {booking.currency}
            <br />
            Motif : {revision.reason}
          </p>
          <button
            type="button"
            onClick={() => confirmRevision(revision.id)}
            disabled={confirmingRevision}
            style={{ marginTop: 12 }}
          >
            {confirmingRevision ? <Spinner /> : 'Confirmer le nouveau montant'}
          </button>
        </div>
      )}

      {booking.status === 'IN_PROGRESS' && <InlineMessage kind="info">Mission en cours.</InlineMessage>}

      {booking.status === 'COMPLETED' && !rated && (
        <form onSubmit={submitRating}>
          <h3>Noter la prestation</h3>
          <div className="field">
            <label>Note</label>
            <select value={score} onChange={(e) => setScore(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Commentaire (optionnel)</label>
            <input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button type="submit" disabled={rating}>
            {rating ? <Spinner /> : 'Envoyer la note'}
          </button>
        </form>
      )}
      {booking.status === 'COMPLETED' && rated && (
        <InlineMessage kind="success">Merci pour votre évaluation.</InlineMessage>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        {CANCELLABLE_STATUSES.has(booking.status) && (
          <button type="button" className="danger" onClick={cancel}>
            Annuler la réservation
          </button>
        )}
        {(booking.status === 'CANCELLED' || booking.status === 'COMPLETED') && (
          <button type="button" className="secondary" onClick={() => navigate('/booking')}>
            Nouvelle réservation
          </button>
        )}
      </div>

      {booking.status !== 'CANCELLED' && <IncidentReportForm bookingId={booking.id} />}
    </div>
  )
}
