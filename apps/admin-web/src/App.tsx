import { useEffect, useState } from 'react';
import { apiRequest } from './api';
import type { Country, Zone } from './types';
import ClientSpace from './client/ClientSpace';
import PartnerSpace from './partner/PartnerSpace';
import AdminSpace from './admin/AdminSpace';
import { I18nProvider, useTranslation } from './i18n/I18nContext';
import { LANGUAGES } from './i18n/translations';

function AppInner() {
  const { t, lang, setLang } = useTranslation();
  const [space, setSpace] = useState<'client' | 'partner' | 'admin'>('client');
  const [countries, setCountries] = useState<Country[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [countryId, setCountryId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await apiRequest<Country[]>('GET', '/countries');
        setCountries(list);
        if (!list[0]) {
          setError(t('common.noActiveCountryError'));
          return;
        }
        setCountryId(list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!countryId) return;
    (async () => {
      try {
        const list = await apiRequest<Zone[]>('GET', `/countries/${countryId}/zones`);
        setZones(list);
        setZoneId((prev) => (list.some((z) => z.id === prev) ? prev : list[0]?.id ?? ''));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [countryId]);

  function handleLocationChange(newCountry: Country, newZone: Zone) {
    setCountryId(newCountry.id);
    setZoneId(newZone.id);
  }

  const country = countries.find((c) => c.id === countryId) ?? null;
  const zone = zones.find((z) => z.id === zoneId) ?? null;

  return (
    <>
      <h1>{t('common.appTitle')}</h1>
      <p className="muted">
        {t('common.backendLabel')} <code>http://localhost:3000/api/v1</code>
      </p>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="row">
          {countries.length > 1 && (
            <div className="field">
              <label>{t('common.countryLabel')}</label>
              <select value={countryId} onChange={(e) => setCountryId(e.target.value)}>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>{t('common.languageLabel')}</label>
            <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${space === 'client' ? 'active' : ''}`}
          onClick={() => setSpace('client')}
        >
          {t('common.tabClient')}
        </button>
        <button
          className={`tab ${space === 'partner' ? 'active' : ''}`}
          onClick={() => setSpace('partner')}
        >
          {t('common.tabPartner')}
        </button>
        <button
          className={`tab ${space === 'admin' ? 'active' : ''}`}
          onClick={() => setSpace('admin')}
        >
          {t('common.tabAdmin')}
        </button>
      </div>

      {!country || !zone ? (
        <div className="card">{t('common.loadingCountryZone')}</div>
      ) : space === 'client' ? (
        <ClientSpace country={country} zone={zone} onLocationChange={handleLocationChange} />
      ) : space === 'partner' ? (
        <PartnerSpace country={country} zone={zone} onLocationChange={handleLocationChange} />
      ) : (
        <AdminSpace country={country} />
      )}
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
