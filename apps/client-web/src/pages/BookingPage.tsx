import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAddress, listAddresses } from '../api/account'
import {
  listFabricCategories,
  listGarmentTypes,
  listServices,
  listStainTypes,
  listWashMethods,
  listZones,
} from '../api/catalog'
import { createBooking, genericQuote, laundryQuote, type LaundryItemInput } from '../api/bookings'
import { ApiError } from '../api/client'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'
import { useResolvedLocation } from '../hooks/useResolvedLocation'
import type { Address, CodeName, GarmentType, QuoteResult, ServiceCategory, Zone } from '../types'

interface CartItem extends LaundryItemInput {
  garmentName: string
}

function defaultScheduledAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setSeconds(0, 0)
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

function stripName({ garmentName, ...rest }: CartItem): LaundryItemInput {
  void garmentName
  return rest
}

// Le backend rejette toute propriété inconnue (ValidationPipe
// forbidNonWhitelisted). `contactPhone` n'est envoyé qu'une fois le backend
// déployé avec la migration 20260829120000 — passer à `true` à ce moment-là.
// D'ici là le champ reste visible (le client confirme son numéro) mais
// n'est pas transmis.
const SEND_CONTACT_PHONE = true

export function BookingPage() {
  const navigate = useNavigate()
  const loc = useResolvedLocation()

  // Pays de la prestation — sélectionnable (le quartier, le catalogue de
  // services et les types d'articles en dépendent).
  const [countryId, setCountryId] = useState('')
  const [zones, setZones] = useState<Zone[]>([])
  const [switchingCountry, setSwitchingCountry] = useState(false)

  const [contactPhone, setContactPhone] = useState('')

  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([])
  const [fabrics, setFabrics] = useState<CodeName[]>([])
  const [washMethods, setWashMethods] = useState<CodeName[]>([])
  const [stains, setStains] = useState<CodeName[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])

  const [selectedCity, setSelectedCity] = useState('')
  const [zoneId, setZoneId] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const category = categories.find((c) => c.id === categoryId) ?? null
  const isLaundry = category?.code === 'LAUNDRY'

  const [garmentTypeId, setGarmentTypeId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [fabricCode, setFabricCode] = useState('STANDARD')
  const [washCode, setWashCode] = useState('STANDARD')
  const [stainCode, setStainCode] = useState('NORMAL')
  const [cart, setCart] = useState<CartItem[]>([])

  const [optionId, setOptionId] = useState('')
  const selectedOption = category?.options.find((o) => o.id === optionId) ?? null
  const [hours, setHours] = useState(2)

  const [urgent, setUrgent] = useState(false)
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [quoting, setQuoting] = useState(false)

  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [addressName, setAddressName] = useState('')
  const [landmark, setLandmark] = useState('')
  // Position GPS capturée (pas de saisie lat/lng manuelle : dans beaucoup de
  // pays il n'y a pas d'adresse de rue, le seul point fiable est la position
  // enregistrée sur place).
  const [capturedLat, setCapturedLat] = useState<number | null>(null)
  const [capturedLng, setCapturedLng] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)

  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt())
  const [paymentProviderCode, setPaymentProviderCode] = useState('mtn_momo')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cities = useMemo(() => [...new Set(zones.map((z) => z.cityName))].sort(), [zones])
  const zonesForCity = useMemo(
    () => zones.filter((z) => z.cityName === selectedCity).sort((a, b) => a.name.localeCompare(b.name)),
    [zones, selectedCity],
  )

  // Charge le catalogue (services / articles) du pays. Les références
  // indépendantes du pays (tissus, lavages, salissures) et les adresses sont
  // chargées à part pour qu'un échec de l'une ne vide pas les autres —
  // notamment : un souci sur /addresses (authentifié) ne doit plus faire
  // disparaître la liste des services (publique).
  const loadCatalog = useCallback(async (cid: string) => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const [cats, gt, fc, wm, st] = await Promise.all([
        listServices(cid),
        listGarmentTypes(cid),
        listFabricCategories(),
        listWashMethods(),
        listStainTypes(),
      ])
      setCategories(cats)
      setCategoryId(cats[0]?.id ?? '')
      setOptionId(cats[0]?.options[0]?.id ?? '')
      setGarmentTypes(gt)
      setGarmentTypeId(gt[0]?.id ?? '')
      setFabrics(fc)
      setWashMethods(wm)
      setStains(st)
      setCart([])
      setQuote(null)
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : String(e))
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  // Initialisation : dès que useResolvedLocation a résolu un pays.
  useEffect(() => {
    if (loc.loading || !loc.country || loc.zones.length === 0 || countryId) return
    const home = loc.homeZoneId ? loc.zones.find((z) => z.id === loc.homeZoneId) : undefined
    const seed = home ?? loc.zones[0]
    setCountryId(loc.country.id)
    setZones(loc.zones)
    setSelectedCity(seed.cityName)
    setZoneId(seed.id)
    if (loc.phone && !contactPhone) setContactPhone(loc.phone)

    let cancelled = false
    ;(async () => {
      await loadCatalog(loc.country!.id)
      try {
        const addr = await listAddresses()
        if (cancelled) return
        setAddresses(addr)
        if (addr[0]) {
          setSelectedAddressId(addr[0].id)
          const match = loc.zones.find((z) => z.id === addr[0].zoneId)
          if (match) {
            setSelectedCity(match.cityName)
            setZoneId(match.id)
          }
        } else {
          setShowNewAddress(true)
        }
      } catch {
        // adresses indisponibles -> on propose la saisie d'une nouvelle adresse
        if (!cancelled) setShowNewAddress(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loc.loading, loc.country, loc.zones, loc.homeZoneId, loc.phone, countryId, contactPhone, loadCatalog])

  async function onCountryChange(newId: string) {
    if (!newId || newId === countryId) return
    setSwitchingCountry(true)
    setError(null)
    try {
      const list = await listZones(newId)
      setCountryId(newId)
      setZones(list)
      const seed = list[0]
      setSelectedCity(seed?.cityName ?? '')
      setZoneId(seed?.id ?? '')
      await loadCatalog(newId)
      // Une adresse enregistrée appartient au quartier d'un pays : si aucune
      // ne correspond au nouveau pays, on bascule sur la saisie.
      if (!addresses.some((a) => list.some((z) => z.id === a.zoneId))) {
        setSelectedAddressId('')
        setShowNewAddress(true)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSwitchingCountry(false)
    }
  }

  function onCityChange(city: string) {
    setSelectedCity(city)
    const first = zones.find((z) => z.cityName === city)
    setZoneId(first?.id ?? '')
    setQuote(null)
  }

  function onCategoryChange(id: string) {
    setCategoryId(id)
    setQuote(null)
    setCart([])
    const cat = categories.find((c) => c.id === id)
    setOptionId(cat?.options[0]?.id ?? '')
  }

  function addItem() {
    const gt = garmentTypes.find((g) => g.id === garmentTypeId)
    if (!gt) return
    setCart((prev) => [
      ...prev,
      {
        garmentTypeId,
        garmentName: gt.name,
        quantity,
        fabricCategoryCode: fabricCode,
        washMethodCode: washCode,
        stainTypeCode: stainCode,
      },
    ])
    setQuote(null)
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index))
    setQuote(null)
  }

  async function getQuote() {
    if (!zoneId || !categoryId) return
    setError(null)
    setQuoting(true)
    try {
      const items = cart.map(stripName)
      const res = isLaundry
        ? await laundryQuote({ serviceCategoryId: categoryId, zoneId, items, urgent })
        : await genericQuote({
            serviceOptionId: optionId,
            zoneId,
            urgent,
            ...(selectedOption?.pricingUnit === 'HOURLY' ? { hours } : {}),
          })
      setQuote(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setQuoting(false)
    }
  }

  function useMyPosition() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturedLat(pos.coords.latitude)
        setCapturedLng(pos.coords.longitude)
        setLocating(false)
      },
      (err) => {
        setError(err.message || 'Position indisponible.')
        setLocating(false)
      },
      { enableHighAccuracy: true },
    )
  }

  async function confirm() {
    if (!zoneId || !categoryId) return
    if (!contactPhone.trim()) {
      setError('Indiquez un numéro de téléphone de contact.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      let addressId = selectedAddressId
      if (showNewAddress || !addressId) {
        if (!addressName.trim()) {
          throw new ApiError('Donnez un nom à cette adresse (ex : « Maison de ma mère »).', 0)
        }
        if (capturedLat === null || capturedLng === null) {
          throw new ApiError('Enregistrez votre position actuelle pour cette adresse.', 0)
        }
        const created = await createAddress({
          zoneId,
          label: addressName.trim(),
          landmark: landmark.trim() || addressName.trim(),
          latitude: capturedLat,
          longitude: capturedLng,
        })
        addressId = created.id
      }

      const booking = await createBooking({
        serviceCategoryId: categoryId,
        addressId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        paymentProviderCode,
        urgent,
        ...(SEND_CONTACT_PHONE ? { contactPhone: contactPhone.trim() } : {}),
        ...(isLaundry
          ? { laundryItems: cart.map(stripName) }
          : {
              serviceOptionId: optionId,
              ...(selectedOption?.pricingUnit === 'HOURLY' ? { hours } : {}),
            }),
      })
      navigate(`/status/${booking.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loc.loading) return <Spinner center />
  if (loc.error && !loc.country) {
    return (
      <div className="card">
        <InlineMessage kind="error">{loc.error}</InlineMessage>
        <button type="button" className="secondary" onClick={loc.retry}>
          Réessayer
        </button>
      </div>
    )
  }

  const currency = loc.allCountries.find((c) => c.id === countryId)?.currency ?? ''
  const quoteReady = isLaundry ? cart.length > 0 : Boolean(optionId)

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Nouvelle réservation</h2>
      {(error || catalogError) && <InlineMessage kind="error">{error ?? catalogError}</InlineMessage>}

      <h3>Lieu de la prestation</h3>
      <div className="field">
        <label>Pays</label>
        <select
          value={countryId}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={switchingCountry}
        >
          {loc.allCountries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {switchingCountry ? (
        <Spinner />
      ) : zones.length === 0 ? (
        <InlineMessage kind="info">Aucun quartier configuré pour ce pays pour le moment.</InlineMessage>
      ) : (
        <div className="row">
          <div className="field">
            <label>Ville</label>
            <select value={selectedCity} onChange={(e) => onCityChange(e.target.value)}>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Quartier</label>
            <select
              value={zoneId}
              onChange={(e) => {
                setZoneId(e.target.value)
                setQuote(null)
              }}
            >
              {zonesForCity.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="field">
        <label>Téléphone de contact</label>
        <input
          type="tel"
          placeholder="+237600000000"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />
      </div>

      <h3>Service</h3>
      {catalogLoading ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <InlineMessage kind="info">Aucun service disponible pour ce pays pour le moment.</InlineMessage>
      ) : (
        <div className="field">
          <label>Prestation</label>
          <select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!catalogLoading && categories.length > 0 && isLaundry && (
        <>
          <h3>Composer le panier</h3>
          <div className="row">
            <div className="field">
              <label>Article</label>
              <select value={garmentTypeId} onChange={(e) => setGarmentTypeId(e.target.value)}>
                {garmentTypes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.basePrice} {currency})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quantité</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                style={{ width: 80 }}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Tissu</label>
              <select value={fabricCode} onChange={(e) => setFabricCode(e.target.value)}>
                {fabrics.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Méthode de lavage</label>
              <select value={washCode} onChange={(e) => setWashCode(e.target.value)}>
                {washMethods.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Salissure</label>
              <select value={stainCode} onChange={(e) => setStainCode(e.target.value)}>
                {stains.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="button" className="secondary" onClick={addItem} disabled={!garmentTypeId}>
            + Ajouter au panier
          </button>

          {cart.length > 0 && (
            <ul className="cart">
              {cart.map((it, i) => (
                <li key={i}>
                  <span>
                    {it.quantity} × {it.garmentName}
                  </span>
                  <button type="button" className="secondary" onClick={() => removeItem(i)}>
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!catalogLoading && categories.length > 0 && !isLaundry && (
        <>
          <h3>Détails du service</h3>
          {!category || category.options.length === 0 ? (
            <p className="muted">Aucune formule disponible pour ce service pour le moment.</p>
          ) : (
            <>
              <div className="field">
                <label>Formule</label>
                <select
                  value={optionId}
                  onChange={(e) => {
                    setOptionId(e.target.value)
                    setQuote(null)
                  }}
                >
                  {category.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.basePrice}
                      {o.pricingUnit === 'HOURLY' ? ' / heure' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOption?.pricingUnit === 'HOURLY' && (
                <div className="field">
                  <label>Durée (heures)</label>
                  <input
                    type="number"
                    min={1}
                    value={hours}
                    onChange={(e) => {
                      setHours(Math.max(1, Number(e.target.value)))
                      setQuote(null)
                    }}
                    style={{ width: 80 }}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {!catalogLoading && categories.length > 0 && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => {
                setUrgent(e.target.checked)
                setQuote(null)
              }}
            />
            Urgent
          </label>

          <h3>Adresse</h3>
          {addresses.length > 0 && !showNewAddress && (
            <>
              <div className="field">
                <label>Adresse enregistrée</label>
                <select value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || a.landmark}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="secondary" onClick={() => setShowNewAddress(true)}>
                + Nouvelle adresse
              </button>
            </>
          )}
          {(showNewAddress || addresses.length === 0) && (
            <>
              <div className="field">
                <label>Nom de l'adresse</label>
                <input
                  value={addressName}
                  onChange={(e) => setAddressName(e.target.value)}
                  placeholder="Ex : Maison de ma mère"
                />
              </div>
              <div className="field">
                <label>Repère (facultatif)</label>
                <input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Ex : portail bleu après le carrefour Ari"
                />
              </div>
              <button
                type="button"
                className="secondary"
                onClick={useMyPosition}
                disabled={locating}
                style={capturedLat !== null ? { color: 'var(--success)', borderColor: 'var(--success)' } : undefined}
              >
                {locating ? (
                  <Spinner />
                ) : capturedLat !== null ? (
                  '✓ Position enregistrée — cliquer pour actualiser'
                ) : (
                  'Enregistrer ma position actuelle'
                )}
              </button>
              {capturedLat === null && (
                <p className="muted" style={{ marginTop: 6 }}>
                  Le partenaire est guidé jusqu'à cette position — enregistrez-la sur place.
                </p>
              )}
              {addresses.length > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowNewAddress(false)}
                  style={{ marginTop: 8 }}
                >
                  Utiliser une adresse existante
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={getQuote}
            disabled={quoting || !quoteReady}
            style={{ marginTop: 12 }}
          >
            {quoting ? <Spinner /> : 'Obtenir un devis'}
          </button>
        </>
      )}

      {quote && (
        <>
          <div className="quote">
            <div>
              Sous-total : {quote.subtotal.toFixed(0)} {quote.currency}
            </div>
            <div>Frais déplacement : {quote.feesTravel.toFixed(0)}</div>
            <div>Frais plateforme : {quote.feesPlatform.toFixed(0)}</div>
            {quote.urgencySupplement > 0 && (
              <div>Supplément urgence : {quote.urgencySupplement.toFixed(0)}</div>
            )}
            <div className="quote-total">
              Total : {quote.total.toFixed(0)} {quote.currency}
            </div>
          </div>

          <h3>Planification</h3>
          <div className="field">
            <label>Date et heure</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Moyen de paiement (Mobile Money)</label>
            <select value={paymentProviderCode} onChange={(e) => setPaymentProviderCode(e.target.value)}>
              <option value="mtn_momo">MTN Mobile Money</option>
              <option value="orange_money">Orange Money</option>
            </select>
          </div>
          <p className="muted">Vous ne serez débité qu'à l'arrivée du partenaire, jamais avant.</p>

          <button
            type="button"
            onClick={confirm}
            disabled={
              submitting ||
              (showNewAddress && (!addressName.trim() || capturedLat === null))
            }
            style={{ width: '100%' }}
          >
            {submitting ? <Spinner /> : 'Confirmer la réservation'}
          </button>
        </>
      )}
    </div>
  )
}
