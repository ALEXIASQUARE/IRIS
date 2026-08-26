import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from '../api';
import type { Country, Zone } from '../types';
import { useTranslation } from '../i18n/I18nContext';
import { districtLabel } from '../zoneLabel';

type Step = 'register' | 'otp' | 'login' | 'forgot' | 'reset';

export default function ClientAuth({
  country,
  zone,
  onAuth,
  onLocationChange,
}: {
  country: Country;
  zone: Zone;
  onAuth: (token: string) => void;
  onLocationChange: (country: Country, zone: Zone) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('register');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+237690');
  const [password, setPassword] = useState('password123');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mot de passe oublié — même mécanisme OTP que l'inscription (voir
  // AuthService.requestPasswordReset/resetPassword côté backend) : le code
  // reçu par SMS prouve la possession du téléphone et ouvre directement la
  // session en cas de succès.
  const [resetCode, setResetCode] = useState('');
  const [resetDevOtp, setResetDevOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [countries, setCountries] = useState<Country[]>([country]);
  const [countryId, setCountryId] = useState(country.id);
  const [zones, setZones] = useState<Zone[]>([zone]);
  const [city, setCity] = useState(zone.cityName);
  const [zoneId, setZoneId] = useState(zone.id);

  useEffect(() => {
    apiRequest<Country[]>('GET', '/countries')
      .then(setCountries)
      .catch(() => {
        // garde la présélection déjà connue si la liste ne charge pas
      });
  }, []);

  useEffect(() => {
    apiRequest<Zone[]>('GET', `/countries/${countryId}/zones`)
      .then((list) => {
        setZones(list);
        setCity((prevCity) => (list.some((z) => z.cityName === prevCity) ? prevCity : list[0]?.cityName ?? ''));
      })
      .catch(() => {
        // garde la présélection déjà connue si la liste ne charge pas
      });
  }, [countryId]);

  const cities = [...new Set(zones.map((z) => z.cityName))];
  const zonesInCity = zones.filter((z) => z.cityName === city);

  useEffect(() => {
    setZoneId((prev) => (zonesInCity.some((z) => z.id === prev) ? prev : zonesInCity[0]?.id ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, zones]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const selectedCountry = countries.find((c) => c.id === countryId) ?? country;
      const res = await apiRequest<{ userId: string; devOtp?: string }>('POST', '/auth/register', {
        body: { firstName, lastName, phone, password, countryCode: selectedCountry.isoCode },
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

      const selectedCountry = countries.find((c) => c.id === countryId) ?? country;
      const selectedZone = zonesInCity.find((z) => z.id === zoneId) ?? zone;

      try {
        await apiRequest('POST', '/addresses', {
          token: res.accessToken,
          body: {
            zoneId: selectedZone.id,
            landmark: t('client.defaultLandmark', { zone: districtLabel(selectedZone) }),
            latitude: selectedZone.centerLat,
            longitude: selectedZone.centerLng,
          },
        });
      } catch {
        // adresse par défaut non créée — le client pourra en créer une au moment de réserver
      }

      onLocationChange(selectedCountry, selectedZone);
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

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; devOtp?: string }>('POST', '/auth/password-reset/request', {
        body: { phone },
      });
      setResetDevOtp(res.devOtp ?? null);
      setResetCode(res.devOtp ?? '');
      setStep('reset');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ accessToken: string }>('POST', '/auth/password-reset/confirm', {
        body: { phone, code: resetCode, newPassword },
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
      <h2>{t('auth.clientTitle')}</h2>
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
            <div className="field">
              <label>{t('auth.cityLabel')}</label>
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('auth.districtLabel')}</label>
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {zonesInCity.map((z) => (
                  <option key={z.id} value={z.id}>
                    {districtLabel(z)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <button type="submit" disabled={loading}>
              {t('auth.clientRegisterButton')}
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
          <div className="row">
            <button type="button" className="secondary" onClick={() => setStep('forgot')}>
              {t('auth.forgotPassword')}
            </button>
          </div>
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={handleForgotSubmit}>
          <div className="field">
            <label>{t('auth.phone')}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="row">
            <button type="submit" disabled={loading}>
              {t('auth.sendResetCode')}
            </button>
            <button type="button" className="secondary" onClick={() => setStep('login')}>
              {t('auth.backToLogin')}
            </button>
          </div>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetSubmit}>
          {resetDevOtp && <div className="hint">{t('auth.devOtpHint', { code: resetDevOtp })}</div>}
          <div className="field">
            <label>{t('auth.otpCodeLabel')}</label>
            <input value={resetCode} onChange={(e) => setResetCode(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.newPasswordLabel')}</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading}>
            {t('auth.resetAndLoginButton')}
          </button>
        </form>
      )}
    </div>
  );
}
