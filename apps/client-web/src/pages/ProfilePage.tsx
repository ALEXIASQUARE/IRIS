import { useEffect, useMemo, useState } from 'react'
import { getClientProfile, updateHomeZone } from '../api/account'
import { changePassword } from '../api/auth'
import { getZone, listCountries, listZones } from '../api/catalog'
import { ApiError } from '../api/client'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'
import type { Country, Zone } from '../types'

export function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [countries, setCountries] = useState<Country[]>([])
  const [countryId, setCountryId] = useState('')
  const [zones, setZones] = useState<Zone[]>([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [city, setCity] = useState('')
  const [zoneId, setZoneId] = useState('')

  const [savingZone, setSavingZone] = useState(false)
  const [zoneMessage, setZoneMessage] = useState<string | null>(null)
  const [zoneError, setZoneError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  const cities = useMemo(() => [...new Set(zones.map((z) => z.cityName))].sort(), [zones])
  const zonesForCity = useMemo(
    () => zones.filter((z) => z.cityName === city).sort((a, b) => a.name.localeCompare(b.name)),
    [zones, city],
  )

  async function loadZonesFor(id: string, preselect?: Zone) {
    setZonesLoading(true)
    setZoneError(null)
    try {
      const list = await listZones(id)
      setZones(list)
      setCity(preselect?.cityName ?? '')
      setZoneId(preselect?.id ?? '')
    } catch (e) {
      setZoneError(e instanceof Error ? e.message : String(e))
    } finally {
      setZonesLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const list = await listCountries()
        setCountries(list)
        const profile = await getClientProfile()
        if (profile.homeZoneId) {
          const zone = await getZone(profile.homeZoneId)
          if (zone.countryId) {
            setCountryId(zone.countryId)
            await loadZonesFor(zone.countryId, zone)
          }
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function onCountryChange(id: string) {
    setCountryId(id)
    setZones([])
    setCity('')
    setZoneId('')
    setZoneMessage(null)
    void loadZonesFor(id)
  }

  async function saveZone() {
    if (!zoneId) return
    setSavingZone(true)
    setZoneMessage(null)
    setZoneError(null)
    try {
      await updateHomeZone(zoneId)
      setZoneMessage('Pays, ville et quartier mis à jour.')
    } catch (e) {
      setZoneError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSavingZone(false)
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Mot de passe modifié.')
    } catch (e) {
      setPasswordError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return <Spinner center />

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Pays, ville et quartier</h2>
        {loadError && <InlineMessage kind="error">{loadError}</InlineMessage>}

        <div className="field">
          <label>Pays</label>
          <select value={countryId} onChange={(e) => onCountryChange(e.target.value)}>
            <option value="" disabled>
              — choisir —
            </option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {zonesLoading && <Spinner />}
        {zoneError && <InlineMessage kind="error">{zoneError}</InlineMessage>}

        {!zonesLoading && countryId && zones.length === 0 && !zoneError && (
          <InlineMessage kind="info">Aucune zone configurée pour ce pays pour le moment.</InlineMessage>
        )}

        {zones.length > 0 && (
          <>
            <div className="field">
              <label>Ville</label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  const first = zones.find((z) => z.cityName === e.target.value)
                  setZoneId(first?.id ?? '')
                }}
              >
                <option value="" disabled>
                  — choisir —
                </option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quartier</label>
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="" disabled>
                  — choisir —
                </option>
                {zonesForCity.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <button type="button" onClick={saveZone} disabled={savingZone || !zoneId}>
          {savingZone ? <Spinner /> : 'Enregistrer'}
        </button>
        {zoneMessage && (
          <div style={{ marginTop: 12 }}>
            <InlineMessage kind="success">{zoneMessage}</InlineMessage>
          </div>
        )}
      </div>

      <form className="card" onSubmit={submitPassword}>
        <h2 style={{ marginTop: 0 }}>Changer le mot de passe</h2>
        <div className="field">
          <label>Mot de passe actuel</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Nouveau mot de passe (8 caractères min.)</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={savingPassword}>
          {savingPassword ? <Spinner /> : 'Changer le mot de passe'}
        </button>
        {passwordError && (
          <div style={{ marginTop: 12 }}>
            <InlineMessage kind="error">{passwordError}</InlineMessage>
          </div>
        )}
        {passwordSuccess && (
          <div style={{ marginTop: 12 }}>
            <InlineMessage kind="success">{passwordSuccess}</InlineMessage>
          </div>
        )}
      </form>
    </>
  )
}
