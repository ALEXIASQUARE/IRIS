import { useState } from 'react';
import { apiRequest, ApiError } from './api';
import { INCIDENT_TYPE_CODES, type IncidentSeverity } from './types';
import { useTranslation } from './i18n/I18nContext';

export default function IncidentReportForm({ token, bookingId }: { token: string; bookingId?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(INCIDENT_TYPE_CODES[0]);
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest('POST', '/incidents', {
        token,
        body: { bookingId, type, severity, description },
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="secondary" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>
        {t('incident.reportButton')}
      </button>
    );
  }

  if (sent) {
    return <div className="hint">{t('incident.sentHint')}</div>;
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 8 }}>
      <h3>{t('incident.reportButton')}</h3>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <label>{t('incident.typeLabel')}</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {INCIDENT_TYPE_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`incidentTypes.${code}`)}
            </option>
          ))}
        </select>
      </div>
      {type === 'PAIEMENT_NON_EFFECTUE' && (
        <p className="muted">{t('incident.nonPaymentWarning')}</p>
      )}
      <div className="field">
        <label>{t('incident.severityLabel')}</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
          <option value="LOW">{t('incident.severityLow')}</option>
          <option value="MEDIUM">{t('incident.severityMedium')}</option>
          <option value="HIGH">{t('incident.severityHigh')}</option>
          <option value="CRITICAL">{t('incident.severityCritical')}</option>
        </select>
      </div>
      <div className="field">
        <label>{t('incident.descriptionLabel')}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="row">
        <button type="submit" disabled={loading}>
          {t('common.send')}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
