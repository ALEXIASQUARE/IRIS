import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAddress, listAddresses } from '../api/account'
import {
  listFabricCategories,
  listGarmentTypes,
  listServices,
  listStainTypes,
  listWashMethods,
} from '../api/catalog'
import {
  createBooking,
  genericQuote,
  laundryQuote,
  type LaundryItemInput,
} from '../api/bookings'
import { ApiError } from '../api/client'
import { InlineMessage } from '../components/InlineMessage'
import { Spinner } from '../components/Spinner'
import { useResolvedLocation } from '../hooks/useResolvedLocation'
import type { Address, CodeName, GarmentType, QuoteResult, ServiceCategory } from '../types'

interface CartItem extends LaundryItemInput {
  garmentName: string
}

function defaultScheduledAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setSeconds(0, 0)
  // datetime-local veut "YYYY-MM-DDTHH:mm" en heure locale
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

export function BookingPage() {
  const navigate = useNavigate()
  const loc = useResolvedLocation()

  const [catalogError, setCatalogError] = useState<string | null>(null)
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
  const [landmark, setLandmark] = useState('')
  const [latitude, setLatitude] = useState('4.05')
  const [longitude, setLongitude] = useState('9.70')
  const [locating, setLocating] = useState(false)

  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt())
  const [paymentProviderCode, setPaymentProviderCode] = useState('mtn_momo')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cities = useMemo(
    () => [...new Set(loc.zones.map((z) => z.cityName))].sort(),
    [loc.zones],
  )
  const zonesForCity = useMemo(
    () => loc.zones.filter((z) => z.cityName === selectedCity).sort((a, b) => a.name.localeCompare(b.name)),
    [loc.zones, selectedCity],
  )

  // Quand le pays / les zones sont résolus : présélectionne ville + quartier
  // (à partir du quartier par défaut du client si disponible) puis charge le
  // catalogue.
  useEffect(() => {
    if (loc.loading || !loc.country || loc.zones.length === 0) return
    const home = loc.homeZoneId ? loc.zones.find((z) => z.id === loc.homeZoneId) : undefined
    const seed = home ?? loc.zones[0]
    setSelectedCity(seed.cityName)
    setZoneId(seed.id)

    let cancelled = false
    ;(async () => {
      try {
        const [cats, gt, fc, wm, st, addr] = await Promise.all([
          listServices(loc.country!.id),
          listGarmentTypes(loc.country!.id),
          listFabricCategories(),
          listWashMethods(),
          listStainTypes(),
          listAddresses(),
        ])
        if (cancelled) return
        setCategories(cats)
        if (cats[0]) {
          setCategoryId(cats[0].id)
          if (cats[0].options[0]) setOptionId(cats[0].options[0].id)
        }
        setGarmentTypes(gt)
        if (gt[0]) setGarmentTypeId(gt[0].id)
        setFabrics(fc)
        setWashMethods(wm)
        setStains(st)
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
      } catch (e) {
        if (!cancelled) setCatalogError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loc.loading, loc.country, loc.zones, loc.homeZoneId])

  function onCityChange(city: string) {
    setSelectedCity(city)
    const first = loc.zones.find((z) => z.cityName === city)
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
      const items: LaundryItemInput[] = cart.map(({ garmentName, ...rest }) => {
        void garmentName
        return rest
      })
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
      setError('La géolocalisation n\'est pas disponible sur cet appareil.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
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
    setError(null)
    setSubmitting(true)
    try {
      let addressId = selectedAddressId
      if (showNewAddress || !addressId) {
        if (!landmark.trim()) throw new ApiError('Indiquez un repère pour la nouvelle adresse.', 0)
        const created = await createAddress({
          zoneId,
          landmark: landmark.trim(),
          latitude: Number(latitude) || 0,
          longitude: Number(longitude) || 0,
        })
        addressId = created.id
      }

      const items: LaundryItemInput[] = cart.map(({ garmentName, ...rest }) => {
        void garmentName
        return rest
      })

      const booking = await createBooking({
        serviceCategoryId: categoryId,
        addressId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        paymentProviderCode,
        urgent,
        ...(isLaundry
          ? { laundryItems: items }
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
  if (loc.error) {
    return (
      <div className="card">
        <InlineMessage kind="error">{loc.error}</InlineMessage>
        <button type="button" className="secondary" onClick={loc.retry}>
          Réessayer
        </button>
      </div>
    )
  }

  const currency = loc.country?.currency ?? ''
  const quoteReady = isLaundry ? cart.length > 0 : Boolean(optionId)

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Nouvelle réservation</h2>
      {(error || catalogError) && <InlineMessage kind="error">{error ?? catalogError}</InlineMessage>}

      <h3>Ville et quartier</h3>
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

      <h3>Service</h3>
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

      {isLaundry ? (
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
      ) : (
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

      <button type="button" onClick={getQuote} disabled={quoting || !quoteReady}>
        {quoting ? <Spinner /> : 'Obtenir un devis'}
      </button>

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

          <h3>Adresse</h3>
          {addresses.length > 0 && !showNewAddress && (
            <>
              <div className="field">
                <label>Adresse enregistrée</label>
                <select
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.landmark}
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
                <label>Repère (ex : « Carrefour Ari, portail bleu »)</label>
                <input value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              </div>
              <button type="button" className="secondary" onClick={useMyPosition} disabled={locating}>
                {locating ? <Spinner /> : 'Utiliser ma position actuelle'}
              </button>
              <div className="row" style={{ marginTop: 8 }}>
                <div className="field">
                  <label>Latitude</label>
                  <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                </div>
                <div className="field">
                  <label>Longitude</label>
                  <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                </div>
              </div>
              {addresses.length > 0 && (
                <button type="button" className="secondary" onClick={() => setShowNewAddress(false)}>
                  Utiliser une adresse existante
                </button>
              )}
            </>
          )}

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
            <select
              value={paymentProviderCode}
              onChange={(e) => setPaymentProviderCode(e.target.value)}
            >
              <option value="mtn_momo">MTN Mobile Money</option>
              <option value="orange_money">Orange Money</option>
            </select>
          </div>
          <p className="muted">
            Vous ne serez débité qu'à l'arrivée du partenaire, jamais avant.
          </p>

          <button
            type="button"
            onClick={confirm}
            disabled={submitting || (showNewAddress && !landmark.trim())}
            style={{ width: '100%' }}
          >
            {submitting ? <Spinner /> : 'Confirmer la réservation'}
          </button>
        </>
      )}
    </div>
  )
}
