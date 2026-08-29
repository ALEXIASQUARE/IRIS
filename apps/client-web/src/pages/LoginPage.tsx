import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'

export function LoginPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const tokens = await login(phone.trim(), password)
      setSession(tokens)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-main">
      <div className="card">
        <img
          src="/logo.jpg"
          alt="IRIS"
          width={112}
          height={112}
          style={{ borderRadius: 18, display: 'block', margin: '0 auto 16px' }}
        />
        <h2 style={{ textAlign: 'center', marginTop: 0 }}>Connexion</h2>

        {error && <InlineMessage kind="error">{error}</InlineMessage>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="phone">Téléphone</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+237600000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? <Spinner /> : 'Se connecter'}
          </button>
        </form>

        <p className="muted" style={{ marginBottom: 0, marginTop: 16, textAlign: 'center' }}>
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          <br />
          <Link to="/forgot-password">Mot de passe oublié ?</Link>
        </p>
      </div>
    </main>
  )
}
