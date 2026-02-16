import React from 'react';
import './AppDownloadBanner.css';

/**
 * Bannière de téléchargement d'applications
 * À intégrer dans la page Login
 */
const AppDownloadBanner = () => {
  return (
    <div className="app-download-banner">
      <div className="banner-content">
        <div className="banner-header">
          <svg className="banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="banner-title">Télécharger l'Application</h3>
        </div>
        
        <p className="banner-subtitle">
          Accédez à Security Workforce Manager sur tous vos appareils
        </p>

        <div className="download-buttons">
          {/* Android APK */}
          <a 
            href="/downloads/security-workforce-manager.apk" 
            className="download-btn download-btn-android"
            download
            onClick={(e) => {
              // Si le fichier n'existe pas, afficher message
              if (!document.querySelector('meta[name="apk-available"]')) {
                e.preventDefault();
                alert('📱 Application Android en cours de développement.\n\nUtilisez la version web pour le moment:\nhttps://security-workforce-manager.vercel.app');
              }
            }}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 00-.83.22l-1.88 3.24a11.43 11.43 0 00-8.94 0L5.65 5.67a.643.643 0 00-.87-.2c-.28.18-.37.54-.22.84L6.4 9.48A10.81 10.81 0 001 18h22a10.81 10.81 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"/>
            </svg>
            <div className="btn-text">
              <span className="btn-label">Télécharger pour</span>
              <span className="btn-platform">Android APK</span>
            </div>
          </a>

          {/* iOS App Store */}
          <a 
            href="https://apps.apple.com/app/security-workforce-manager/id123456789" 
            className="download-btn download-btn-ios"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              alert('📱 Application iOS bientôt disponible sur l\'App Store.\n\nUtilisez la version web pour le moment:\nhttps://security-workforce-manager.vercel.app');
            }}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="btn-text">
              <span className="btn-label">Télécharger sur</span>
              <span className="btn-platform">App Store</span>
            </div>
          </a>

          {/* Windows EXE */}
          <a 
            href="/downloads/security-workforce-manager-setup.exe" 
            className="download-btn download-btn-windows"
            download
            onClick={(e) => {
              e.preventDefault();
              alert('💻 Application Windows en cours de développement.\n\nUtilisez la version web pour le moment:\nhttps://security-workforce-manager.vercel.app');
            }}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
            </svg>
            <div className="btn-text">
              <span className="btn-label">Télécharger pour</span>
              <span className="btn-platform">Windows</span>
            </div>
          </a>

          {/* macOS DMG */}
          <a 
            href="/downloads/security-workforce-manager.dmg" 
            className="download-btn download-btn-macos"
            download
            onClick={(e) => {
              e.preventDefault();
              alert('💻 Application macOS en cours de développement.\n\nUtilisez la version web pour le moment:\nhttps://security-workforce-manager.vercel.app');
            }}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="btn-text">
              <span className="btn-label">Télécharger pour</span>
              <span className="btn-platform">macOS</span>
            </div>
          </a>
        </div>

        {/* Alternative: Continuer sur le web */}
        <div className="web-alternative">
          <span className="web-alt-text">ou</span>
          <button 
            className="web-continue-btn"
            onClick={() => {
              // Scroll vers le formulaire de connexion
              document.querySelector('.login-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Continuer sur le web
            <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Statistiques */}
        <div className="app-stats">
          <div className="stat-item">
            <div className="stat-number">4.8</div>
            <div className="stat-label">★ Note moyenne</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-number">10K+</div>
            <div className="stat-label">Téléchargements</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-number">500+</div>
            <div className="stat-label">Entreprises</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppDownloadBanner;
