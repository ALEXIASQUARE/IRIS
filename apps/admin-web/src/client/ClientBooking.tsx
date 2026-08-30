import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type {
  Address,
  Country,
  FabricCategory,
  GarmentType,
  QuoteResult,
  ServiceCategory,
  ServiceOption,
  StainType,
  Zone,
} from '../types';
import { useTranslation } from '../i18n/I18nContext';

interface Item {
  garmentTypeId: string;
  garmentName: string;
  quantity: number;
  fabricCategoryCode: string;
  stainTypeCode: string;
}

function defaultScheduledAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function ClientBooking({
  token,
  country,
  zone,
  onBooked,
}: {
  token: string;
  country: Country;
  zone: Zone;
  onBooked: (bookingId: string) => void;
}) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const isLaundry = category?.code === 'LAUNDRY';

  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [fabricCategories, setFabricCategories] = useState<FabricCategory[]>([]);
  const [stainTypes, setStainTypes] = useState<StainType[]>([]);

  const [garmentTypeId, setGarmentTypeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [fabricCategoryCode, setFabricCategoryCode] = useState('STANDARD');
  const [stainTypeCode, setStainTypeCode] = useState('NORMAL');
  const [items, setItems] = useState<Item[]>([]);

  const [optionId, setOptionId] = useState('');
  const selectedOption: ServiceOption | null = category?.options.find((o) => o.id === optionId) ?? null;
  const [hours, setHours] = useState(2);

  const [quote, setQuote] = useState<QuoteResult | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [latitude, setLatitude] = useState('4.05');
  const [longitude, setLongitude] = useState('9.70');

  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt());
  const [paymentProviderCode, setPaymentProviderCode] = useState('mtn_momo');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cats = await apiRequest<ServiceCategory[]>('GET', `/services?countryId=${country.id}`);
        setCategories(cats);
        if (cats[0]) {
          setCategoryId(cats[0].id);
          if (cats[0].options[0]) setOptionId(cats[0].options[0].id);
        }

        const [gt, fc, st, addr] = await Promise.all([
          apiRequest<GarmentType[]>('GET', `/laundry/garment-types?countryId=${country.id}`),
          apiRequest<FabricCategory[]>('GET', '/laundry/fabric-categories'),
          apiRequest<StainType[]>('GET', '/laundry/stain-types'),
          apiRequest<Address[]>('GET', '/addresses', { token }),
        ]);
        setGarmentTypes(gt);
        setFabricCategories(fc);
        setStainTypes(st);
        if (gt[0]) setGarmentTypeId(gt[0].id);
        setAddresses(addr);
        if (addr[0]) setSelectedAddressId(addr[0].id);
        else setShowNewAddress(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onCategoryChange(id: string) {
    setCategoryId(id);
    setQuote(null);
    setItems([]);
    const cat = categories.find((c) => c.id === id);
    setOptionId(cat?.options[0]?.id ?? '');
  }

  function addItem() {
    const gt = garmentTypes.find((g) => g.id === garmentTypeId);
    if (!gt) return;
    setItems((prev) => [
      ...prev,
      { garmentTypeId, garmentName: gt.name, quantity, fabricCategoryCode, stainTypeCode },
    ]);
    setQuote(null);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setQuote(null);
  }

  async function getQuote() {
    if (!categoryId) return;
    if (isLaundry && items.length === 0) return;
    if (!isLaundry && !optionId) return;
    setError(null);
    setLoading(true);
    try {
      const res = isLaundry
        ? await apiRequest<QuoteResult>('POST', '/pricing/laundry-quote', {
            body: {
              serviceCategoryId: categoryId,
              zoneId: zone.id,
              items: items.map(({ garmentTypeId, quantity, fabricCategoryCode, stainTypeCode }) => ({
                garmentTypeId,
                quantity,
                fabricCategoryCode,
                stainTypeCode,
              })),
            },
          })
        : await apiRequest<QuoteResult>('POST', '/pricing/quote', {
            body: {
              serviceOptionId: optionId,
              zoneId: zone.id,
              ...(selectedOption?.pricingUnit === 'HOURLY' ? { hours } : {}),
            },
          });
      setQuote(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createAddress(): Promise<string | null> {
    try {
      const addr = await apiRequest<Address>('POST', '/addresses', {
        token,
        body: {
          zoneId: zone.id,
          label: landmark || 'Adresse',
          landmark,
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      });
      return addr.id;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      return null;
    }
  }

  async function confirmBooking() {
    setError(null);
    setLoading(true);
    try {
      let addressId = selectedAddressId;
      if (showNewAddress || !addressId) {
        const newId = await createAddress();
        if (!newId) {
          setLoading(false);
          return;
        }
        addressId = newId;
      }
      if (!categoryId) throw new Error(t('client.laundryCategoryMissing'));

      const booking = await apiRequest<{ id: string }>('POST', '/bookings', {
        token,
        body: {
          serviceCategoryId: categoryId,
          addressId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          paymentProviderCode,
          ...(isLaundry
            ? {
                laundryItems: items.map(({ garmentTypeId, quantity, fabricCategoryCode, stainTypeCode }) => ({
                  garmentTypeId,
                  quantity,
                  fabricCategoryCode,
                  stainTypeCode,
                })),
              }
            : {
                serviceOptionId: optionId,
                ...(selectedOption?.pricingUnit === 'HOURLY' ? { hours } : {}),
              }),
        },
      });
      onBooked(booking.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>{t('client.newBookingTitle')}</h2>
      {error && <div className="error">{error}</div>}

      <h3>{t('client.serviceStepTitle')}</h3>
      <div className="field">
        <label>{t('client.serviceLabel')}</label>
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
          <h3>{t('client.step1Title')}</h3>
          <div className="row">
            <div className="field">
              <label>{t('client.garmentLabel')}</label>
              <select value={garmentTypeId} onChange={(e) => setGarmentTypeId(e.target.value)}>
                {garmentTypes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.basePrice} {country.currency})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('client.quantityLabel')}</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </div>
            <div className="field">
              <label>{t('client.fabricLabel')}</label>
              <select value={fabricCategoryCode} onChange={(e) => setFabricCategoryCode(e.target.value)}>
                {fabricCategories.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('client.stainLabel')}</label>
              <select value={stainTypeCode} onChange={(e) => setStainTypeCode(e.target.value)}>
                {stainTypes.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={addItem} disabled={!garmentTypeId}>
              {t('common.add')}
            </button>
          </div>

          {items.length > 0 && (
            <ul className="item-list">
              {items.map((it, i) => (
                <li key={i}>
                  <span>
                    {it.quantity} × {it.garmentName}
                  </span>
                  <button type="button" className="secondary" onClick={() => removeItem(i)}>
                    {t('client.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <h3>{t('client.serviceDetailsTitle')}</h3>
          {!category || category.options.length === 0 ? (
            <p className="muted">{t('client.noOptionsForService')}</p>
          ) : (
            <>
              <div className="field">
                <label>{t('client.optionLabel')}</label>
                <select
                  value={optionId}
                  onChange={(e) => {
                    setOptionId(e.target.value);
                    setQuote(null);
                  }}
                >
                  {category.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.basePrice}
                      {o.pricingUnit === 'HOURLY' ? ` / ${t('client.hourUnit')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOption?.pricingUnit === 'HOURLY' && (
                <div className="field">
                  <label>{t('client.hoursLabel')}</label>
                  <input
                    type="number"
                    min={1}
                    value={hours}
                    onChange={(e) => {
                      setHours(Number(e.target.value));
                      setQuote(null);
                    }}
                    style={{ width: 80 }}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <button
        type="button"
        onClick={getQuote}
        disabled={loading || (isLaundry ? items.length === 0 : !optionId)}
      >
        {t('client.getQuote')}
      </button>

      {quote && (
        <div className="hint" style={{ marginTop: 12 }}>
          {t('client.subtotalLine', {
            subtotal: quote.subtotal,
            feesTravel: quote.feesTravel,
            feesPlatform: quote.feesPlatform,
          })}
          <div className="total">{t('client.totalLabel', { total: quote.total, currency: quote.currency })}</div>
        </div>
      )}

      {quote && (
        <>
          <h3>{t('client.step2Title')}</h3>
          {addresses.length > 0 && !showNewAddress && (
            <div className="field">
              <label>{t('client.savedAddressLabel')}</label>
              <select value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.landmark}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary" onClick={() => setShowNewAddress(true)}>
                {t('client.newAddressButton')}
              </button>
            </div>
          )}
          {(showNewAddress || addresses.length === 0) && (
            <>
              <div className="field">
                <label>{t('client.landmarkLabel')}</label>
                <input value={landmark} onChange={(e) => setLandmark(e.target.value)} required />
              </div>
              <div className="row">
                <div className="field">
                  <label>{t('client.latitudeLabel')}</label>
                  <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('client.longitudeLabel')}</label>
                  <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                </div>
              </div>
              {addresses.length > 0 && (
                <button type="button" className="secondary" onClick={() => setShowNewAddress(false)}>
                  {t('client.useExistingAddress')}
                </button>
              )}
            </>
          )}

          <h3>{t('client.step3Title')}</h3>
          <div className="field">
            <label>{t('client.scheduledAtLabel')}</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t('client.paymentProviderLabel')}</label>
            <select value={paymentProviderCode} onChange={(e) => setPaymentProviderCode(e.target.value)}>
              <option value="mtn_momo">MTN Mobile Money</option>
              <option value="orange_money">Orange Money</option>
            </select>
          </div>
          <p className="muted">{t('client.paymentNote')}</p>

          <button
            type="button"
            onClick={confirmBooking}
            disabled={loading || (showNewAddress && !landmark)}
          >
            {t('client.confirmBooking')}
          </button>
        </>
      )}
    </div>
  );
}
