import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { userAPI, webauthnAPI } from '../services/api';
import { startRegistration } from '@simplewebauthn/browser';

const ProfilePage = () => {
  const { t } = useTranslation();
  const { user, logout, updateUser, isAdmin } = useAuth();
  const { currentLanguage, languages, changeLanguage } = useLanguage();
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const result = await userAPI.uploadAvatar(formData);
      updateUser({ avatar_url: result.avatar_url });
    } catch (err) {
      console.error('Avatar upload error:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await userAPI.updateProfile(form);
      updateUser(updated);
      setEditing(false);
    } catch (err) {
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (code) => {
    changeLanguage(code);
    try {
      await userAPI.updateProfile({ language_pref: code });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPasskey = async () => {
    try {
      const options = await webauthnAPI.getRegisterOptions();
      const attResp = await startRegistration(options);
      const verificationObj = await webauthnAPI.verifyRegister(attResp);
      if (verificationObj.verified) {
        alert('Passkey (Biometric) registered successfully!');
      } else {
        alert('Failed to register passkey. Try again.');
      }
    } catch (err) {
      console.error('Passkey registration error:', err);
      alert('Passkey registration failed or was cancelled.');
    }
  };

  return (
    <div className="page">
      {/* Profile Header */}
      <div className="profile-header animate-fade-in">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <button className="profile-avatar-edit" onClick={() => fileInputRef.current?.click()}>
            <span className="material-symbols-outlined">photo_camera</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
        </div>
        <div>
          <h1 className="profile-name">{user?.name}</h1>
          <p className="profile-id">{user?.email}</p>
          {user?.phone && <p className="profile-id" style={{ marginTop: '0.25rem' }}>{user.phone}</p>}
          <div style={{ marginTop: '0.5rem' }}>
            <span className={`badge ${isAdmin ? 'badge-error' : 'badge-primary'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {isAdmin ? 'shield' : 'verified_user'}
              </span>
              {isAdmin ? 'Admin' : 'Verified User'}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      {editing && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>{t('profile.editProfile')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">{t('auth.name')}</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">{t('auth.phone')}</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Menu */}
      <div className="profile-menu" style={{ marginBottom: '1.5rem' }}>
        <button className="profile-menu-item" onClick={() => { setForm({ name: user?.name || '', phone: user?.phone || '' }); setEditing(true); }}>
          <div className="profile-menu-left">
            <div className="profile-menu-icon">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="profile-menu-label">{t('profile.personalInfo')}</p>
              <p className="profile-menu-desc">Update name & phone</p>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--outline-variant)' }}>chevron_right</span>
        </button>

        <button className="profile-menu-item" onClick={() => alert('Document Vault is coming soon!')}>
          <div className="profile-menu-left">
            <div className="profile-menu-icon" style={{ background: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}>
              <span className="material-symbols-outlined">folder_shared</span>
            </div>
            <div>
              <p className="profile-menu-label">{t('profile.savedDocuments')}</p>
              <p className="profile-menu-desc">VISA, EFRRO, print files</p>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--outline-variant)' }}>chevron_right</span>
        </button>

        <button className="profile-menu-item" onClick={handleAddPasskey}>
          <div className="profile-menu-left">
            <div className="profile-menu-icon" style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
              <span className="material-symbols-outlined">fingerprint</span>
            </div>
            <div>
              <p className="profile-menu-label">Add Passkey / Biometrics</p>
              <p className="profile-menu-desc">Sign in with Face ID or Touch ID</p>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--outline-variant)' }}>add</span>
        </button>

        <button className="profile-menu-item" onClick={() => alert('Privacy controls coming soon!')}>
          <div className="profile-menu-left">
            <div className="profile-menu-icon" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}>
              <span className="material-symbols-outlined">privacy_tip</span>
            </div>
            <div>
              <p className="profile-menu-label">{t('profile.privacyData')}</p>
              <p className="profile-menu-desc">Auto-delete, data retention</p>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--outline-variant)' }}>chevron_right</span>
        </button>
      </div>

      {/* Language Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>{t('profile.language')}</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {languages.map(lang => (
            <button
              key={lang.code}
              className={`chip ${lang.code === currentLanguage.code ? 'chip-active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              {lang.flag} {lang.native}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div style={{ textAlign: 'center', paddingBottom: '2rem' }}>
        <button
          style={{ color: 'var(--error)', fontWeight: 700, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'none', cursor: 'pointer' }}
          onClick={logout}
        >
          <span className="material-symbols-outlined">logout</span>
          {t('auth.logout')}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
