import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { confirmPasswordReset, requestPasswordReset } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'

export function ForgotPasswordPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'phone' | 'reset'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await requestPasswordReset(phone.trim())
      setDevOtp(res.devOtp ?? null)
      setCode(res.devOtp ?? '')
      setStep('reset')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setSubmitting(true)
    try {
      const tokens = await confirmPasswordReset(phone.trim(), code.trim(), newPassword)
      setSession(tokens)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-main">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Mot de passe oublié</h2>
        {error && <InlineMessage kind="error">{error}</InlineMessage>}

        {step === 'phone' ? (
          <form onSubmit={handleRequest}>
            <p className="muted">
              Entrez le numéro de votre compte. Un code vous sera envoyé par SMS.
            </p>
            <div className="field">
              <label>Téléphone</label>
              <input
                type="tel"
                placeholder="+237600000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <Spinner /> : 'Recevoir un code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            {devOtp && <InlineMessage kind="info">Mode dev : le code est pré-rempli.</InlineMessage>}
            <div className="field">
              <label>Code de vérification</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>Nouveau mot de passe (8 caractères min.)</label>
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <Spinner /> : 'Réinitialiser et se connecter'}
            </button>
          </form>
        )}

        <p className="muted" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </div>
    </main>
  )
}
