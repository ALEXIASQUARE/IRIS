import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, verifyOtp } from '../api/auth'
import { listCountries } from '../api/catalog'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'
import type { Country } from '../types'

export function RegisterPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [countries, setCountries] = useState<Country[]>([])
  const [countryCode, setCountryCode] = useState('')

  const [code, setCode] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listCountries()
      .then((list) => {
        setCountries(list)
        if (list[0]) setCountryCode(list[0].isoCode)
      })
      .catch(() => {
        /* la liste reste vide -> champ requis non satisfait, message backend au submit */
      })
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        password,
        countryCode,
        email: email.trim() || undefined,
      })
      setDevOtp(res.devOtp ?? null)
      setCode(res.devOtp ?? '')
      setStep('otp')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const tokens = await verifyOtp(phone.trim(), code.trim())
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
        <h2 style={{ marginTop: 0 }}>{step === 'form' ? 'Créer un compte' : 'Vérification du code'}</h2>
        {error && <InlineMessage kind="error">{error}</InlineMessage>}

        {step === 'form' ? (
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>Prénom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Nom</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
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
            <div className="field">
              <label>E-mail (optionnel)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Mot de passe (8 caractères min.)</label>
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Pays</label>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required>
                {countries.map((c) => (
                  <option key={c.id} value={c.isoCode}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <Spinner /> : "S'inscrire"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            {devOtp && <InlineMessage kind="info">Mode dev : le code est pré-rempli.</InlineMessage>}
            <p className="muted">Un code a été envoyé au {phone}.</p>
            <div className="field">
              <label>Code de vérification</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <Spinner /> : 'Vérifier'}
            </button>
          </form>
        )}

        <p className="muted" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          <Link to="/login">J'ai déjà un compte</Link>
        </p>
      </div>
    </main>
  )
}
