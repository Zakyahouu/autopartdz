import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserCheck } from 'lucide-react';

export default function PublicNavbar() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <header className="moment-navbar" role="banner">
      <div className="moment-nav-inner">
        <Link to="/" className="moment-brand">
          <div className="moment-brand-stamp">DZ</div>
          <div>
            <div className="moment-brand-title">
              autopart<span>dz</span>
            </div>
            <div className="moment-brand-desc">{t('brand.title')}</div>
          </div>
        </Link>

        <div className="moment-nav-actions">
          {/* Public Nav Links */}
          <nav className="moment-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/" className="moment-nav-admin-link" style={{ textDecoration: 'none' }}>
              <span>{t('nav.newDemand')}</span>
            </Link>
            <Link to="/track" className="moment-nav-admin-link" style={{ textDecoration: 'none', fontWeight: 600 }}>
              <ShieldCheck size={14} />
              <span>{t('nav.trackOrder')}</span>
            </Link>
          </nav>

          {/* Language Switcher */}
          <div className="moment-lang-picker" aria-label={t('nav.language')}>
            <button
              type="button"
              className={`moment-lang-btn ${i18n.language === 'ar' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('ar')}
              title="العربية"
            >
              العربية
            </button>
            <button
              type="button"
              className={`moment-lang-btn ${i18n.language === 'fr' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('fr')}
              title="Français"
            >
              FR
            </button>
            <button
              type="button"
              className={`moment-lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
              title="English"
            >
              EN
            </button>
          </div>

          {/* Admin link */}
          <Link to="/login" className="moment-nav-admin-link">
            <UserCheck size={14} />
            <span>{t('nav.adminLogin')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
