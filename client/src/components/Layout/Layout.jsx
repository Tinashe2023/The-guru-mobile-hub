import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const Layout = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentLanguage, languages, changeLanguage } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const location = useLocation();

  const bottomNavItems = [
    { path: '/dashboard', icon: 'dashboard', label: t('nav.dashboard') },
    { path: '/services', icon: 'storefront', label: t('nav.services') },
    { path: '/chat', icon: 'chat_bubble', label: t('nav.chat') },
    { path: '/tickets', icon: 'confirmation_number', label: t('nav.tickets') },
    { path: '/profile', icon: 'person', label: t('nav.profile') },
  ];

  const desktopNavItems = [
    { path: '/dashboard', label: t('nav.dashboard') },
    { path: '/services', label: t('nav.services') },
    { path: '/products', label: t('nav.products') },
    { path: '/tickets', label: t('nav.tickets') },
    { path: '/documents', label: t('nav.documents') },
    { path: '/chat', label: t('nav.chat') },
    { path: '/profile', label: t('nav.profile') },
  ];

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <span className="app-logo">{t('shop.name')}</span>

        <div className="header-actions">
          {/* Desktop Nav */}
          <nav className="desktop-nav">
            {desktopNavItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Language Switcher */}
          <div className="lang-switcher">
            <button className="lang-btn" onClick={() => setLangOpen(!langOpen)}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>language</span>
              <span>{currentLanguage.code.toUpperCase()}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span>
            </button>
            {langOpen && (
              <div className="lang-menu">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    className={`lang-option ${lang.code === currentLanguage.code ? 'active' : ''}`}
                    onClick={() => { changeLanguage(lang.code); setLangOpen(false); }}
                  >
                    {lang.flag} {lang.native}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <button className="btn-icon">
            <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>notifications</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        {bottomNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Layout;

