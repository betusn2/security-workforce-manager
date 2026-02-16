import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppDownloadBanner from '../components/AppDownloadBanner/AppDownloadBanner';
import soundEffects from '../utils/soundEffects';
import './Login.css';

/**
 * Page de connexion avec:
 * - Sons de feedback (login-start, login-success, login-error, logout)
 * - Bannière de téléchargement des applications mobiles/desktop
 * - Validation des champs
 * - Gestion des erreurs
 */
const Login = () => {
  const navigate = useNavigate();
  
  // États du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Bannière de téléchargement
  const [showBanner, setShowBanner] = useState(() => {
    // Masquer si déjà vu (optionnel)
    return !localStorage.getItem('download-banner-dismissed');
  });

  // Vérifier si déjà connecté
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const dismissBanner = () => {
    localStorage.setItem('download-banner-dismissed', 'true');
    setShowBanner(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 🎵 Son au clic sur le bouton de connexion
    soundEffects.play('login-start');
    
    setLoading(true);
    setError('');

    try {
      // Requête d'authentification
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/login`,
        { email, password }
      );

      const { token, user } = response.data;

      // Sauvegarder dans localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // 🎵 Son de succès
      soundEffects.play('login-success');

      // Redirection après un court délai (pour laisser le son jouer)
      setTimeout(() => {
        // Redirection selon le rôle
        if (user.role === 'admin') {
          navigate('/dashboard');
        } else if (user.role === 'supervisor') {
          navigate('/supervisor/dashboard');
        } else if (user.role === 'agent') {
          navigate('/agent/dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 500);

    } catch (err) {
      // 🎵 Son d'erreur
      soundEffects.play('login-error');
      
      console.error('Login error:', err);
      
      const errorMessage = err.response?.data?.message 
        || 'Erreur de connexion. Vérifiez vos identifiants.';
      
      setError(errorMessage);
      setLoading(false);
      
      // Effacer l'erreur après 5 secondes
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className="login-page">
      {/* Bannière de téléchargement des applications */}
      {showBanner && (
        <div className="banner-wrapper">
          <button 
            className="banner-close"
            onClick={dismissBanner}
            aria-label="Fermer la bannière"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <AppDownloadBanner />
        </div>
      )}

      {/* Container principal */}
      <div className="login-container">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <div className="logo-container">
              <img 
                src="/logo.png" 
                alt="Security Workforce Manager Logo" 
                className="login-logo"
                onError={(e) => {
                  // Fallback si logo pas trouvé
                  e.target.style.display = 'none';
                }}
              />
              <svg 
                className="login-logo-fallback" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="login-title">Security Workforce Manager</h1>
            <p className="login-subtitle">Connectez-vous à votre compte</p>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="error-banner">
              <svg className="error-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div className="error-content">
                <strong>Erreur de connexion</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="login-form">
            {/* Email */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@security.com"
                required
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            {/* Mot de passe */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Mot de passe
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot password */}
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" className="checkbox" />
                <span>Se souvenir de moi</span>
              </label>
              <button 
                type="button" 
                className="forgot-password-link"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Bouton de connexion */}
            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="login-footer">
            <p>
              Pas encore de compte ?{' '}
              <a href="/register" className="register-link">
                Créer un compte
              </a>
            </p>
          </div>

          {/* Info rapide */}
          <div className="quick-info">
            <p className="info-title">🔐 Compte de démonstration</p>
            <div className="demo-credentials">
              <div className="demo-item">
                <strong>Admin:</strong>
                <code>admin@security.com / Admin123!</code>
              </div>
              <div className="demo-item">
                <strong>Agent:</strong>
                <code>agent@security.com / Agent123!</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer global */}
      <footer className="login-page-footer">
        <p>© 2026 Security Workforce Manager. Tous droits réservés.</p>
        <div className="footer-links">
          <a href="/privacy">Confidentialité</a>
          <span>•</span>
          <a href="/terms">Conditions</a>
          <span>•</span>
          <a href="/support">Support</a>
        </div>
      </footer>
    </div>
  );
};

export default Login;
