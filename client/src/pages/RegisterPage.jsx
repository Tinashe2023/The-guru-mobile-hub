import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage = () => {
  const { t } = useTranslation();
  const { register, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      await logout();
      navigate('/login?registered=true');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">{t('shop.name')}</div>
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.register')}</h1>
        <p className="auth-subtitle">Create your account to access all services</p>

        {error && (
          <div className="status-banner status-banner-error" style={{ marginBottom: '1rem' }}>
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">{t('auth.name')}</label>
            <input className="input" type="text" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} required id="register-name" />
          </div>
          <div className="input-group">
            <label className="input-label">{t('auth.email')}</label>
            <input className="input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required id="register-email" />
          </div>
          <div className="input-group">
            <label className="input-label">{t('auth.phone')}</label>
            <input className="input" type="tel" name="phone" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={handleChange} id="register-phone" />
          </div>
          <div className="input-group">
            <label className="input-label">{t('auth.password')}</label>
            <input className="input" type="password" name="password" placeholder="Min 8 characters" value={form.password} onChange={handleChange} required minLength={8} id="register-password" />
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} id="register-submit">
            {loading ? t('common.loading') : t('auth.register')}
          </button>
        </form>

        <div className="auth-footer">
          {t('auth.hasAccount')}{' '}
          <Link to="/login">{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
