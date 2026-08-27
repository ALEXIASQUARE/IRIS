import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { AdminCountry, AdminZone, AdminServiceCategory, AdminPricingConfig } from '../types';
import { useTranslation } from '../i18n/I18nContext';
import AdminServiceOptions from './AdminServiceOptions';

export default function AdminGeo({ token }: { token: string }) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<AdminCountry[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [zones, setZones] = useState<AdminZone[]>([]);
  const [categories, setCategories] = useState<AdminServiceCategory[]>([]);
  const [pricingConfigs, setPricingConfigs] = useState<AdminPricingConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [cIso, setCIso] = useState('');
  const [cName, setCName] = useState('');
  const [cCurrency, setCCurrency] = useState('');
  const [cLang, setCLang] = useState('fr');

  const [cityFilter, setCityFilter] = useState('');
  const [newCityName, setNewCityName] = useState('');
  const [zName, setZName] = useState('');
  const [zLat, setZLat] = useState('');
  const [zLng, setZLng] = useState('');

  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');

  const [pFeesTravel, setPFeesTravel] = useState('500');
  const [pFeesPlatform, setPFeesPlatform] = useState('200');
  const [pUrgency, setPUrgency] = useState('15');
  const [pRounding, setPRounding] = useState('5');

  async function loadCountries() {
    try {
      const list = await apiRequest<AdminCountry[]>('GET', '/admin/countries', { token });
      setCountries(list);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadZones(countryId: string) {
    try {
      const list = await apiRequest<AdminZone[]>('GET', `/admin/countries/${countryId}/zones`, { token });
      setZones(list);
      setCityFilter((prev) => (list.some((z) => z.cityName === prev) ? prev : list[0]?.cityName ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadCategories(countryId: string) {
    try {
      const list = await apiRequest<AdminServiceCategory[]>(
        'GET',
        `/admin/countries/${countryId}/service-categories`,
        { token },
      );
      setCategories(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadPricingConfigs(countryId: string) {
    try {
      const list = await apiRequest<AdminPricingConfig[]>(
        'GET',
        `/admin/countries/${countryId}/pricing-configs`,
        { token },
      );
      setPricingConfigs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (selectedId) {
      loadZones(selectedId);
      loadCategories(selectedId);
      loadPricingConfigs(selectedId);
    }
  }, [selectedId, token]);

  async function addCountry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('POST', '/admin/countries', {
        token,
        body: { isoCode: cIso, name: cName, currency: cCurrency, defaultLanguage: cLang },
      });
      setCIso('');
      setCName('');
      setCCurrency('');
      await loadCountries();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function toggleCountryActive(c: AdminCountry) {
    // Désactiver un pays le retire de /countries -- s'il a des zones/un
    // catalogue actifs, ça casse le choix "premier pays prêt" pour TOUS les
    // clients/partenaires déjà enregistrés là (voir
    // CountriesRepository.findFirstCountryWithZones côté mobile), pas
    // seulement les nouveaux comptes. C'est déjà arrivé deux fois par clic
    // accidentel (voir journal d'audit) — d'où la confirmation, uniquement
    // à la désactivation (l'activation est toujours sans risque).
    if (c.isActive && !window.confirm(t('admin.confirmDeactivateCountry', { name: c.name }))) {
      return;
    }
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/countries/${c.id}`, { token, body: { isActive: !c.isActive } });
      await loadCountries();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function addZone(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !cityFilter) return;
    setError(null);
    try {
      await apiRequest('POST', `/admin/countries/${selectedId}/zones`, {
        token,
        body: { name: zName, cityName: cityFilter, centerLat: Number(zLat), centerLng: Number(zLng) },
      });
      setZName('');
      setZLat('');
      setZLng('');
      await loadZones(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  function selectOrCreateCity(e: React.FormEvent) {
    e.preventDefault();
    if (!newCityName.trim()) return;
    setCityFilter(newCityName.trim());
    setNewCityName('');
  }

  async function toggleZoneActive(z: AdminZone) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/zones/${z.id}`, { token, body: { isActive: !z.isActive } });
      await loadZones(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      await apiRequest('POST', `/admin/countries/${selectedId}/service-categories`, {
        token,
        body: { code: catCode, name: catName },
      });
      setCatCode('');
      setCatName('');
      await loadCategories(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function toggleCategoryActive(c: AdminServiceCategory) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/service-categories/${c.id}`, {
        token,
        body: { isActive: !c.isActive },
      });
      await loadCategories(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function publishPricingConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      await apiRequest('POST', `/admin/countries/${selectedId}/pricing-configs`, {
        token,
        body: {
          feesTravel: Number(pFeesTravel),
          feesPlatform: Number(pFeesPlatform),
          urgencySupplementPercent: Number(pUrgency),
          roundingIncrement: Number(pRounding),
        },
      });
      await loadPricingConfigs(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  const selectedCountryName = countries.find((c) => c.id === selectedId)?.name ?? '…';
  const cities = [...new Set(zones.map((z) => z.cityName))];
  const districtsInCity = zones.filter((z) => z.cityName === cityFilter);

  return (
    <>
      <div className="card">
        <h2>{t('admin.countriesTitle')}</h2>
        {error && <div className="error">{error}</div>}

        <ul className="item-list">
          {countries.map((c) => (
            <li key={c.id}>
              <span
                onClick={() => setSelectedId(c.id)}
                style={{ cursor: 'pointer', fontWeight: c.id === selectedId ? 700 : 400 }}
              >
                {c.name} ({c.isoCode}) — {c.currency} {!c.isActive && <em className="muted">{t('admin.deactivated')}</em>}
              </span>
              <button className="secondary" onClick={() => toggleCountryActive(c)}>
                {c.isActive ? t('admin.deactivate') : t('admin.activate')}
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addCountry} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.isoCodeLabel')}</label>
            <input value={cIso} onChange={(e) => setCIso(e.target.value.toUpperCase())} required style={{ width: 70 }} />
          </div>
          <div className="field">
            <label>{t('admin.nameLabel')}</label>
            <input value={cName} onChange={(e) => setCName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('admin.currencyLabel')}</label>
            <input value={cCurrency} onChange={(e) => setCCurrency(e.target.value.toUpperCase())} required style={{ width: 80 }} />
          </div>
          <div className="field">
            <label>{t('admin.languageFieldLabel')}</label>
            <input value={cLang} onChange={(e) => setCLang(e.target.value)} required style={{ width: 60 }} />
          </div>
          <button type="submit">{t('common.add')}</button>
        </form>
      </div>

      <div className="card">
        <h2>{t('admin.citiesTitle', { country: selectedCountryName })}</h2>

        {cities.length === 0 ? (
          <p className="muted">{t('admin.noCities')}</p>
        ) : (
          <ul className="item-list">
            {cities.map((c) => (
              <li key={c}>
                <span
                  onClick={() => setCityFilter(c)}
                  style={{ cursor: 'pointer', fontWeight: c === cityFilter ? 700 : 400 }}
                >
                  {c}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={selectOrCreateCity} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.newCityLabel')}</label>
            <input value={newCityName} onChange={(e) => setNewCityName(e.target.value)} required />
          </div>
          <button type="submit" disabled={!selectedId}>
            {t('admin.selectOrCreate')}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t('admin.districtsTitle', { city: cityFilter || '…' })}</h2>

        {districtsInCity.length === 0 ? (
          <p className="muted">{t('admin.noDistricts')}</p>
        ) : (
          <ul className="item-list">
            {districtsInCity.map((z) => (
              <li key={z.id}>
                <span>
                  {z.name} — {z.centerLat}, {z.centerLng}
                  {!z.isActive && <em className="muted"> {t('admin.deactivated')}</em>}
                </span>
                <button className="secondary" onClick={() => toggleZoneActive(z)}>
                  {z.isActive ? t('admin.deactivate') : t('admin.activate')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addZone} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.districtNameLabel')}</label>
            <input value={zName} onChange={(e) => setZName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('client.latitudeLabel')}</label>
            <input value={zLat} onChange={(e) => setZLat(e.target.value)} required style={{ width: 90 }} />
          </div>
          <div className="field">
            <label>{t('client.longitudeLabel')}</label>
            <input value={zLng} onChange={(e) => setZLng(e.target.value)} required style={{ width: 90 }} />
          </div>
          <button type="submit" disabled={!selectedId || !cityFilter}>
            {t('common.add')}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t('admin.serviceCategoriesTitle', { country: selectedCountryName })}</h2>

        {categories.length === 0 ? (
          <p className="muted">{t('admin.noCategoriesWarning')}</p>
        ) : (
          <ul className="item-list">
            {categories.map((c) => (
              <li key={c.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {c.name} ({c.code}) {!c.isActive && <em className="muted">{t('admin.deactivatedFem')}</em>}
                  </span>
                  <button className="secondary" onClick={() => toggleCategoryActive(c)}>
                    {c.isActive ? t('admin.deactivate') : t('admin.activate')}
                  </button>
                </div>
                {/* La laverie calcule son prix pièce par pièce (GarmentType) et n'a pas d'options. */}
                {c.code !== 'LAUNDRY' && <AdminServiceOptions token={token} categoryId={c.id} />}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addCategory} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.codeLabel')}</label>
            <input value={catCode} onChange={(e) => setCatCode(e.target.value.toUpperCase())} required style={{ width: 120 }} />
          </div>
          <div className="field">
            <label>{t('admin.nameLabel')}</label>
            <input value={catName} onChange={(e) => setCatName(e.target.value)} required />
          </div>
          <button type="submit" disabled={!selectedId}>
            {t('common.add')}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{t('admin.pricingTitle', { country: selectedCountryName })}</h2>

        {pricingConfigs.length === 0 ? (
          <p className="muted">{t('admin.noPricingWarning')}</p>
        ) : (
          <ul className="item-list">
            {pricingConfigs.map((p) => (
              <li key={p.id}>
                <span>
                  v{p.version} — {t('admin.feesTravelLabel')} {p.config.feesTravel} /{' '}
                  {t('admin.feesPlatformLabel')} {p.config.feesPlatform} / {t('admin.urgencyLabel')}{' '}
                  {p.config.urgencySupplementPercent}% / {t('admin.roundingLabel')} {p.config.roundingIncrement}
                  {p.isActive && <strong> {t('admin.activeTag')}</strong>}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={publishPricingConfig} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.feesTravelLabel')}</label>
            <input value={pFeesTravel} onChange={(e) => setPFeesTravel(e.target.value)} style={{ width: 90 }} />
          </div>
          <div className="field">
            <label>{t('admin.feesPlatformLabel')}</label>
            <input value={pFeesPlatform} onChange={(e) => setPFeesPlatform(e.target.value)} style={{ width: 90 }} />
          </div>
          <div className="field">
            <label>{t('admin.urgencyLabel')}</label>
            <input value={pUrgency} onChange={(e) => setPUrgency(e.target.value)} style={{ width: 70 }} />
          </div>
          <div className="field">
            <label>{t('admin.roundingLabel')}</label>
            <input value={pRounding} onChange={(e) => setPRounding(e.target.value)} style={{ width: 70 }} />
          </div>
          <button type="submit" disabled={!selectedId}>
            {t('admin.publishPricing')}
          </button>
        </form>
      </div>
    </>
  );
}
