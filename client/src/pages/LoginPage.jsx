import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, webauthnAPI } from '../services/api';
import { startAuthentication } from '@simplewebauthn/browser';

const LoginPage = () => {
  const { t } = useTranslation();
  const { login, loginWithPasskey } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registered = new URLSearchParams(location.search).get('registered') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const options = await webauthnAPI.getLoginOptions();
      const asseResp = await startAuthentication(options);
      const verificationResp = await webauthnAPI.verifyLogin(asseResp);
      
      if (verificationResp.verified) {
        loginWithPasskey(verificationResp);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError') {
        setError('Passkey login was cancelled.');
      } else {
        setError(err.message || 'Passkey login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">{t('shop.name')}</div>
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.login')}</h1>
        <p className="auth-subtitle">{t('shop.location')} • {t('shop.hours')}</p>

        {error && (
          <div className="status-banner status-banner-error" style={{ marginBottom: '1rem' }}>
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {registered && !error && (
          <div className="status-banner" style={{ marginBottom: '1rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
            <span className="material-symbols-outlined">check_circle</span>
            Account created successfully! Please log in.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">{t('auth.email')}</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              id="login-email"
            />
          </div>

          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label" style={{ marginBottom: 0 }}>{t('auth.password')}</label>
              <a href="#" onClick={(e) => { e.preventDefault(); alert('For security, please contact the shop admin or visit us in person to reset your password.'); }} style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Forgot Password?
              </a>
            </div>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              id="login-password"
            />
          </div>

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} id="login-submit">
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <button className="btn btn-secondary btn-full btn-lg" onClick={handlePasskeyLogin} disabled={loading} style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-outlined">fingerprint</span>
          Sign in with Passkey / Biometrics
        </button>

        <div className="divider-text">{t('auth.orDivider')}</div>

        <button className="google-btn" onClick={() => authAPI.googleLogin()} id="google-login">
          <svg viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('auth.googleLogin')}
        </button>

        <div className="auth-footer">
          {t('auth.noAccount')}{' '}
          <Link to="/register">{t('auth.register')}</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
