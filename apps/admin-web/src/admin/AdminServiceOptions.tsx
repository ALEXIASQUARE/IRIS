import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { ServiceOption } from '../types';
import { useTranslation } from '../i18n/I18nContext';

// Options d'une catégorie de service non itemisée (ménage, repassage) —
// forfait (FLAT) ou tarifée à l'heure (HOURLY). Sans au moins une option,
// une catégorie non-laverie n'est pas réservable (cf. computeGenericQuote
// côté backend qui exige un ServiceOption existant).
export default function AdminServiceOptions({ token, categoryId }: { token: string; categoryId: string }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [pricingUnit, setPricingUnit] = useState<'FLAT' | 'HOURLY'>('FLAT');

  async function load() {
    try {
      const list = await apiRequest<ServiceOption[]>('GET', `/admin/service-categories/${categoryId}/options`, {
        token,
      });
      setOptions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, token]);

  async function addOption(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('POST', `/admin/service-categories/${categoryId}/options`, {
        token,
        body: { code, name, basePrice: Number(basePrice), pricingUnit },
      });
      setCode('');
      setName('');
      setBasePrice('');
      setPricingUnit('FLAT');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function updatePrice(id: string, value: string) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/service-options/${id}`, { token, body: { basePrice: Number(value) } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function toggleActive(o: ServiceOption) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/service-options/${o.id}`, { token, body: { isActive: !o.isActive } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div style={{ marginTop: 8, marginInlineStart: 16 }}>
      {error && <div className="error">{error}</div>}
      {options.length === 0 ? (
        <p className="muted">{t('admin.optionsEmpty')}</p>
      ) : (
        <ul className="item-list">
          {options.map((o) => (
            <li key={o.id}>
              <span>
                {o.name} ({o.code}) — {o.pricingUnit === 'HOURLY' ? t('admin.optionHourly') : t('admin.optionFlat')}
                {!o.isActive && <em className="muted"> {t('admin.deactivatedFem')}</em>}
              </span>
              <div className="row">
                <input
                  defaultValue={o.basePrice ?? ''}
                  style={{ width: 90 }}
                  onBlur={(e) => e.target.value !== (o.basePrice ?? '') && updatePrice(o.id, e.target.value)}
                />
                <button className="secondary" onClick={() => toggleActive(o)}>
                  {o.isActive ? t('admin.deactivate') : t('admin.activate')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addOption} className="row" style={{ marginTop: 8 }}>
        <div className="field">
          <label>{t('admin.codeLabel')}</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required style={{ width: 140 }} />
        </div>
        <div className="field">
          <label>{t('admin.nameLabel')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>{t('admin.basePriceLabel')}</label>
          <input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required style={{ width: 90 }} />
        </div>
        <div className="field">
          <label>{t('admin.pricingUnitLabel')}</label>
          <select value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value as 'FLAT' | 'HOURLY')}>
            <option value="FLAT">{t('admin.optionFlat')}</option>
            <option value="HOURLY">{t('admin.optionHourly')}</option>
          </select>
        </div>
        <button type="submit">{t('common.add')}</button>
      </form>
    </div>
  );
}
