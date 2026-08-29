import { useState } from 'react'
import { reportIncident } from '../api/account'
import { ApiError } from '../api/client'
import { INCIDENT_TYPE_CODES, type IncidentSeverity } from '../types'
import { InlineMessage } from './InlineMessage'
import { Spinner } from './Spinner'

const TYPE_LABELS: Record<string, string> = {
  OBJET_ENDOMMAGE: 'Objet endommagé',
  RETARD: 'Retard',
  COMPORTEMENT: 'Comportement',
  PAIEMENT_NON_EFFECTUE: 'Paiement non effectué',
  AUTRE: 'Autre',
}

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Élevée',
  CRITICAL: 'Critique',
}

export function IncidentReportForm({ bookingId }: { bookingId?: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>(INCIDENT_TYPE_CODES[0])
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM')
  const [description, setDescription] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setError('Décrivez le problème.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await reportIncident({ bookingId, type, severity, description: description.trim() })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        Signaler un incident
      </button>
    )
  }

  if (sent) {
    return (
      <div style={{ marginTop: 8 }}>
        <InlineMessage kind="success">Incident signalé, merci.</InlineMessage>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 8 }}>
      <h3 style={{ marginTop: 0 }}>Signaler un incident</h3>
      {error && <InlineMessage kind="error">{error}</InlineMessage>}
      <div className="field">
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {INCIDENT_TYPE_CODES.map((code) => (
            <option key={code} value={code}>
              {TYPE_LABELS[code] ?? code}
            </option>
          ))}
        </select>
      </div>
      {type === 'PAIEMENT_NON_EFFECTUE' && (
        <p className="muted">
          Signaler ceci annule immédiatement la mission. Possible seulement 30 min après l'arrivée du
          partenaire.
        </p>
      )}
      <div className="field">
        <label>Gravité</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
          {(Object.keys(SEVERITY_LABELS) as IncidentSeverity[]).map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="row">
        <button type="submit" disabled={loading}>
          {loading ? <Spinner /> : 'Envoyer'}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  )
}
