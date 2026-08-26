import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { AdminGarmentType, AdminStainType } from '../types';
import { useTranslation } from '../i18n/I18nContext';

export default function AdminCatalog({ token }: { token: string }) {
  const { t } = useTranslation();
  const [garmentTypes, setGarmentTypes] = useState<AdminGarmentType[]>([]);
  const [stainTypes, setStainTypes] = useState<AdminStainType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [gCode, setGCode] = useState('');
  const [gName, setGName] = useState('');
  const [gPrice, setGPrice] = useState('');

  const [sCode, setSCode] = useState('');
  const [sName, setSName] = useState('');
  const [sSurchargeType, setSSurchargeType] = useState<'PERCENT' | 'FIXED' | 'QUOTE'>('PERCENT');
  const [sSurchargeValue, setSSurchargeValue] = useState('');

  async function load() {
    try {
      const [g, s] = await Promise.all([
        apiRequest<AdminGarmentType[]>('GET', '/admin/catalog/garment-types', { token }),
        apiRequest<AdminStainType[]>('GET', '/admin/catalog/stain-types', { token }),
      ]);
      setGarmentTypes(g);
      setStainTypes(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function addGarmentType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('POST', '/admin/catalog/garment-types', {
        token,
        body: { code: gCode, name: gName, basePrice: Number(gPrice) },
      });
      setGCode('');
      setGName('');
      setGPrice('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function updateGarmentPrice(id: string, basePrice: string) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/catalog/garment-types/${id}`, {
        token,
        body: { basePrice: Number(basePrice) },
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function toggleGarmentActive(g: AdminGarmentType) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/catalog/garment-types/${g.id}`, {
        token,
        body: { isActive: !g.isActive },
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function addStainType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('POST', '/admin/catalog/stain-types', {
        token,
        body: {
          code: sCode,
          name: sName,
          surchargeType: sSurchargeType,
          surchargeValue: sSurchargeValue ? Number(sSurchargeValue) : undefined,
        },
      });
      setSCode('');
      setSName('');
      setSSurchargeValue('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function updateStainValue(id: string, surchargeValue: string) {
    setError(null);
    try {
      await apiRequest('PATCH', `/admin/catalog/stain-types/${id}`, {
        token,
        body: { surchargeValue: Number(surchargeValue) },
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <>
      <div className="card">
        <h2>{t('admin.catalogGarmentTitle')}</h2>
        {error && <div className="error">{error}</div>}

        <ul className="item-list">
          {garmentTypes.map((g) => (
            <li key={g.id}>
              <span>
                {g.name} ({g.code}) {!g.isActive && <em className="muted">{t('admin.deactivated')}</em>}
              </span>
              <div className="row">
                <input
                  defaultValue={g.basePrice}
                  style={{ width: 90 }}
                  onBlur={(e) => e.target.value !== g.basePrice && updateGarmentPrice(g.id, e.target.value)}
                />
                <button className="secondary" onClick={() => toggleGarmentActive(g)}>
                  {g.isActive ? t('admin.deactivate') : t('admin.activate')}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={addGarmentType} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.codeLabel')}</label>
            <input value={gCode} onChange={(e) => setGCode(e.target.value)} required style={{ width: 120 }} />
          </div>
          <div className="field">
            <label>{t('admin.nameLabel')}</label>
            <input value={gName} onChange={(e) => setGName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('admin.basePriceLabel')}</label>
            <input value={gPrice} onChange={(e) => setGPrice(e.target.value)} required style={{ width: 90 }} />
          </div>
          <button type="submit">{t('common.add')}</button>
        </form>
      </div>

      <div className="card">
        <h2>{t('admin.catalogStainTitle')}</h2>

        <ul className="item-list">
          {stainTypes.map((s) => (
            <li key={s.id}>
              <span>
                {s.name} ({s.code}) — {s.surchargeType}
              </span>
              <input
                defaultValue={s.surchargeValue ?? ''}
                style={{ width: 90 }}
                onBlur={(e) => e.target.value !== (s.surchargeValue ?? '') && updateStainValue(s.id, e.target.value)}
              />
            </li>
          ))}
        </ul>

        <form onSubmit={addStainType} className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t('admin.codeLabel')}</label>
            <input value={sCode} onChange={(e) => setSCode(e.target.value)} required style={{ width: 120 }} />
          </div>
          <div className="field">
            <label>{t('admin.nameLabel')}</label>
            <input value={sName} onChange={(e) => setSName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('admin.surchargeTypeLabel')}</label>
            <select value={sSurchargeType} onChange={(e) => setSSurchargeType(e.target.value as typeof sSurchargeType)}>
              <option value="PERCENT">{t('admin.percent')}</option>
              <option value="FIXED">{t('admin.fixed')}</option>
              <option value="QUOTE">{t('admin.manualQuote')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t('admin.valueLabel')}</label>
            <input value={sSurchargeValue} onChange={(e) => setSSurchargeValue(e.target.value)} style={{ width: 90 }} />
          </div>
          <button type="submit">{t('common.add')}</button>
        </form>
      </div>
    </>
  );
}
