import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiGlobe, FiShield, FiCheck, FiSmartphone, FiDownload } from 'react-icons/fi';
import useAuthStore from '../hooks/useAuth';
import useI18n from '../hooks/useI18n';
import { assignmentsAPI, eventsAPI } from '../services/api';
import { hasActiveOrUpcomingEvents } from '../utils/eventHelpers';
import { toast } from 'react-toastify';

const Login = () => {
  const [loginMode, setLoginMode] = useState('email'); // 'email' or 'cin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cin, setCin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const navigate = useNavigate();
  const { login, loginByCin, isLoading, error, clearError } = useAuthStore();
  const { t, language, changeLanguage, getLanguages, isRTL } = useI18n();

  // Load saved credentials if "Remember Me" was checked
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedRemember = localStorage.getItem('rememberMe') === 'true';
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (loginMode === 'cin') {
      // Login by CIN (for agents/supervisors)
      const result = await loginByCin(cin.trim());
      if (result.success) {
        // 🔥 VÉRIFIER SI L'UTILISATEUR A DES ÉVÉNEMENTS ACTIFS/FUTURS
        try {
          // Afficher un toast de chargement
          const toastId = toast.info('Vérification de vos événements...', { autoClose: false });

          // Récupérer les assignments de l'utilisateur
          const assignmentsResponse = await assignmentsAPI.getMyAssignments();

          if (!assignmentsResponse.data?.success || !assignmentsResponse.data.data) {
            toast.dismiss(toastId);
            toast.error('Aucun événement assigné. Contactez votre superviseur.');
            navigate('/no-active-events');
            return;
          }

          const assignments = assignmentsResponse.data.data;

          // Récupérer les IDs des événements
          const eventIds = assignments
            .map(a => a.eventId)
            .filter(Boolean);

          if (eventIds.length === 0) {
            toast.dismiss(toastId);
            toast.error('Aucun événement assigné. Contactez votre superviseur.');
            navigate('/no-active-events');
            return;
          }

          // Récupérer les événements complets
          const eventPromises = eventIds.map(eventId => eventsAPI.getById(eventId));
          const eventResponses = await Promise.all(eventPromises);
          const events = eventResponses
            .map(res => res.data?.data)
            .filter(Boolean);

          // Vérifier s'il y a au moins un événement actif ou à venir
          const hasValidEvents = hasActiveOrUpcomingEvents(events);

          toast.dismiss(toastId);

          if (!hasValidEvents) {
            // ❌ TOUS LES ÉVÉNEMENTS SONT TERMINÉS/ANNULÉS
            toast.error('Tous vos événements sont terminés. Accès au pointage refusé.');
            navigate('/no-active-events');
            return;
          }

          // ✅ AU MOINS UN ÉVÉNEMENT ACTIF/FUTUR
          toast.success('Connexion réussie! Redirection vers le pointage...');
          navigate('/checkin');
        } catch (error) {
          console.error('❌ Erreur vérification événements:', error);

          // En cas d'erreur API, on laisse passer par sécurité
          // (peut-être l'API a un problème temporaire)
          toast.warning('Impossible de vérifier vos événements. Redirection...');
          navigate('/checkin');
        }
      }
    } else {
      // Regular email/password login (for admins)
      // Save or clear remembered credentials
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberMe');
      }

      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      }
    }
  };

  const handleLanguageChange = (code) => {
    changeLanguage(code);
    setShowLanguageMenu(false);
  };

  const languages = getLanguages();
  const currentLang = languages.find(l => l.code === language);

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 p-4 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-all border border-white/20"
          >
            <FiGlobe className="text-lg" />
            <span className="text-2xl">{currentLang?.flag}</span>
            <span className="hidden sm:inline text-sm font-medium">{currentLang?.name}</span>
          </button>

          {/* Language Dropdown */}
          {showLanguageMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="py-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      language === lang.code ? 'bg-primary-50' : ''
                    }`}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={`flex-1 text-left ${language === lang.code ? 'text-primary-600 font-medium' : 'text-gray-700'}`}>
                      {lang.name}
                    </span>
                    {language === lang.code && (
                      <FiCheck className="text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-4 shadow-lg shadow-primary-500/30">
              <FiShield className="text-3xl text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('login.title')}
            </h1>
            <p className="text-gray-500 mt-2">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('cin');
                  clearError();
                }}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                  loginMode === 'cin'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Agent / Superviseur
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('email');
                  clearError();
                }}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                  loginMode === 'email'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Administrateur
              </button>
            </div>

            {loginMode === 'cin' ? (
              // CIN Login Mode
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CIN (Carte d'Identité Nationale)
                </label>
                <div className="relative">
                  <FiShield className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-4' : 'left-4'}`} />
                  <input
                    type="text"
                    value={cin}
                    onChange={(e) => setCin(e.target.value.toUpperCase())}
                    className={`w-full px-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono text-lg ${isRTL ? 'text-right' : 'text-left'}`}
                    placeholder="BK517312"
                    required
                    autoFocus
                    maxLength={10}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Entrez votre CIN pour accéder au pointage
                </p>
              </div>
            ) : (
              // Email/Password Login Mode
              <>
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('login.email')}
                  </label>
                  <div className="relative">
                    <FiMail className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-4' : 'left-4'}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full px-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('login.emailPlaceholder')}
                      required
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('login.password')}
                  </label>
                  <div className="relative">
                    <FiLock className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-4' : 'left-4'}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full px-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('login.passwordPlaceholder')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors ${isRTL ? 'left-4' : 'right-4'}`}
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-primary-500 peer-checked:border-primary-500 transition-all group-hover:border-primary-400">
                        {rememberMe && (
                          <FiCheck className="text-white w-full h-full p-0.5" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 group-hover:text-gray-800">
                      {t('login.rememberMe')}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {t('login.forgotPassword')}
                  </button>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-700 text-white py-3.5 rounded-xl font-medium hover:from-primary-600 hover:to-primary-800 transition-all shadow-lg shadow-primary-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{loginMode === 'cin' ? 'Connexion...' : t('login.loading')}</span>
                </>
              ) : (
                loginMode === 'cin' ? 'Accéder au Pointage' : t('login.submit')
              )}
            </button>
          </form>

          {/* Demo Account Info */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">{t('login.demoAccount')} :</p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-mono text-sm text-gray-700">admin@securityguard.com</p>
                <p className="font-mono text-sm text-gray-700">Admin@123</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-4">
          {/* Download Mobile App Button */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="flex items-center justify-center gap-2 mb-3">
              <FiSmartphone className="text-white text-xl" />
              <h3 className="text-white font-semibold">Application Mobile</h3>
            </div>
            <p className="text-white/80 text-sm mb-4">
              Téléchargez notre application pour un accès mobile optimisé
            </p>
            <a
              href="/security-guard-mobile.apk"
              download
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <FiDownload className="text-lg" />
              <span>Télécharger l'App Mobile</span>
            </a>
            <p className="text-white/60 text-xs mt-3">
              Compatible Android • Version 1.0.0
            </p>
          </div>

          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} SGM – Security Guard | Système de gestion
          </p>
        </div>
      </div>

      {/* Click outside to close language menu */}
      {showLanguageMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowLanguageMenu(false)}
        />
      )}
    </div>
  );
};

export default Login;
