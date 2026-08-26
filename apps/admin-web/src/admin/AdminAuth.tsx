import { useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { Country } from '../types';
import { useTranslation } from '../i18n/I18nContext';

type Step = 'register' | 'otp' | 'login';

export default function AdminAuth({ country, onAuth }: { country: Country; onAuth: (token: string) => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+237692');
  const [password, setPassword] = useState('password123');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ userId: string; devOtp?: string }>('POST', '/auth/register', {
        body: { firstName, lastName, phone, password, countryCode: country.isoCode, role: 'ADMIN' },
      });
      setDevOtp(res.devOtp ?? null);
      setCode(res.devOtp ?? '');
      setStep('otp');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ accessToken: string }>('POST', '/auth/verify-otp', {
        body: { phone, code },
      });
      onAuth(res.accessToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ accessToken: string }>('POST', '/auth/login', {
        body: { phone, password },
      });
      onAuth(res.accessToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>{t('auth.adminTitle')}</h2>
      {error && <div className="error">{error}</div>}

      {step === 'register' && (
        <form onSubmit={handleRegister}>
          <div className="field">
            <label>{t('auth.firstName')}</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.lastName')}</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.phone')}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="row">
            <button type="submit" disabled={loading}>
              {t('auth.adminRegisterButton')}
            </button>
            <button type="button" className="secondary" onClick={() => setStep('login')}>
              {t('auth.alreadyHaveAccount')}
            </button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerify}>
          {devOtp && <div className="hint">{t('auth.devOtpHint', { code: devOtp })}</div>}
          <div className="field">
            <label>{t('auth.otpCodeLabel')}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading}>
            {t('auth.verify')}
          </button>
        </form>
      )}

      {step === 'login' && (
        <form onSubmit={handleLogin}>
          <div className="field">
            <label>{t('auth.phone')}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="row">
            <button type="submit" disabled={loading}>
              {t('auth.loginButton')}
            </button>
            <button type="button" className="secondary" onClick={() => setStep('register')}>
              {t('auth.createAccount')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
