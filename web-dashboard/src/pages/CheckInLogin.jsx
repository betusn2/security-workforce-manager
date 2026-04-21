import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUser, FiCreditCard, FiArrowRight, FiAlertCircle,
  FiCheck, FiShield, FiLock, FiMail, FiArrowLeft,
  FiUsers, FiUserCheck, FiSettings
} from 'react-icons/fi';
import io from 'socket.io-client';
import { authAPI, assignmentsAPI } from '../services/api';
import useAuthStore from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { getDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';
import deviceInfoService from '../services/deviceInfoService';
import soundEffects from '../utils/soundEffects';

/**
 * Page de connexion unifiée
 * Étape 1: Choisir le type de profil
 * Étape 2: Se connecter selon le type
 */
const CheckInLogin = () => {
  const navigate = useNavigate();
  const { login: storeLogin, setAuthenticatedUser } = useAuthStore();
  const socketRef = useRef(null);
  const locationIntervalRef = useRef(null);

  // Étape: 'select' (choix du profil) ou 'login' (formulaire de connexion)
  const [step, setStep] = useState('select');

  // Type de profil sélectionné: 'agent', 'supervisor', 'admin'
  const [profileType, setProfileType] = useState(null);

  // Champs de formulaire
  const [cin, setCin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // États
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [userPreview, setUserPreview] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [showAppBanner, setShowAppBanner] = useState(true);
  
  // États pour le tracking GPS
  const [currentLocation, setCurrentLocation] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isSocketAuthenticated, setIsSocketAuthenticated] = useState(false);

  useEffect(() => {
    // Récupérer les infos de l'appareil
    const loadDeviceInfo = async () => {
      const fingerprint = await getDeviceFingerprint();
      const info = getDeviceInfo();
      setDeviceInfo({ fingerprint, ...info });
    };
    loadDeviceInfo();
    
    // Vérifier si utilisateur déjà connecté
    const checkInUser = localStorage.getItem('checkInUser');
    const token = localStorage.getItem('checkInToken') || localStorage.getItem('accessToken') || localStorage.getItem('token');
    
    if (checkInUser && token) {
      const user = JSON.parse(checkInUser);
      // Initialiser Socket.IO pour l'utilisateur déjà connecté
      initializeSocket(user.id);
    }
    
    // Démarrer le tracking GPS et batterie
    startLocationTracking();
    getBatteryLevel();
    
    // Initialiser les effets sonores
    soundEffects.initialize();
    
    return () => {
      stopLocationTracking();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Initialiser Socket.IO pour envoyer la localisation
  const initializeSocket = (userId) => {
    const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://security-guard-backend.onrender.com';
    const token = localStorage.getItem('checkInToken') || localStorage.getItem('accessToken') || localStorage.getItem('token');
    const validEvents = JSON.parse(localStorage.getItem('validEvents') || '[]');
    const eventId = validEvents[0]?.id || null;
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    socketRef.current = io(BACKEND_URL, {
      auth: { token },
      transports: ['polling', 'websocket']
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Socket.IO connecté pour tracking GPS');
      
      // S'authentifier avec userId et eventId
      socketRef.current.emit('auth', {
        userId: userId,
        role: 'agent',
        eventId: eventId,
        token: token
      });
      
      // Rejoindre la room de l'événement
      if (eventId) {
        socketRef.current.emit('event:join', eventId);
        socketRef.current.emit('tracking:subscribe', eventId);
      }
    });
    
    socketRef.current.on('auth:success', (data) => {
      console.log('✅ Authentification Socket.IO réussie:', data);
      setIsSocketAuthenticated(true);
      // Démarrer l'envoi GPS après authentification réussie
      console.log('🚀 Démarrage envoi GPS après authentification...');
    });
    
    socketRef.current.on('auth:error', (error) => {
      console.error('❌ Erreur auth Socket.IO:', error);
      setIsSocketAuthenticated(false);
      toast.error(`Erreur auth Socket.IO: ${error.message}`, { autoClose: 5000 });
    });
    
    socketRef.current.on('tracking:position_ack', (data) => {
      console.log('✅ Position confirmée par serveur:', data);
    });
    
    socketRef.current.on('tracking:error', (error) => {
      console.error('❌ Erreur tracking:', error);
    });
    
    socketRef.current.on('tracking:disabled', (data) => {
      console.warn('⏸️ Tracking désactivé:', data.message);
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 Socket.IO déconnecté');
      setIsSocketAuthenticated(false);
    });
  };

  // Obtenir le niveau de batterie
  const getBatteryLevel = async () => {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        setBatteryLevel(Math.round(battery.level * 100));
        
        // Écouter les changements de batterie
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }
    } catch (err) {
      console.log('Battery API non disponible');
    }
  };

  // Démarrer le tracking GPS
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.log('Geolocation non disponible');
      return;
    }

    // Obtenir la position immédiatement
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation(location);
        sendLocationUpdate(location);
      },
      (error) => {
        console.error('Erreur GPS:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Puis mettre à jour toutes les 5 secondes
    locationIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setCurrentLocation(location);
          sendLocationUpdate(location);
        },
        (error) => {
          console.error('Erreur GPS:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }, 5000); // Toutes les 5 secondes
  };

  // Arrêter le tracking GPS
  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  // Envoyer la mise à jour de localisation via Socket.IO
  const sendLocationUpdate = async (location) => {
    const user = JSON.parse(localStorage.getItem('checkInUser') || '{}');
    
    if (!user.id) {
      console.log('⚠️ Utilisateur non connecté, position non envoyée');
      return;
    }
    
    if (!socketRef.current) {
      console.log('⚠️ Socket.IO non initialisé');
      initializeSocket(user.id);
      return;
    }
    
    if (!socketRef.current.connected) {
      console.log('⚠️ Socket.IO non connecté, reconnexion...');
      socketRef.current.connect();
      return;
    }

    // CRITIQUE: Vérifier que l'authentification Socket.IO est terminée
    if (!isSocketAuthenticated) {
      console.log('⏳ En attente authentification Socket.IO...');
      return;
    }
    
    if (location) {
      // 🆕 Collecter TOUTES les infos enrichies
      const enrichedInfo = await deviceInfoService.getAllInfo();
      
      const data = {
        userId: user.id,
        // GPS
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude || null,
        speed: location.speed || 0,
        heading: location.heading || null,
        
        // 🔋 Batterie complète
        batteryLevel: enrichedInfo.battery?.level || batteryLevel || 100,
        batteryCharging: enrichedInfo.battery?.charging,
        batteryChargingTime: enrichedInfo.battery?.chargingTime,
        batteryDischargingTime: enrichedInfo.battery?.dischargingTime,
        batteryStatus: enrichedInfo.battery?.status,
        batteryEstimatedTime: enrichedInfo.battery?.estimatedTimeRemaining,
        
        // 📶 Réseau
        networkType: enrichedInfo.network?.type,
        networkDownlink: enrichedInfo.network?.downlink,
        networkRtt: enrichedInfo.network?.rtt,
        networkSaveData: enrichedInfo.network?.saveData,
        networkOnline: enrichedInfo.network?.online,
        networkStatus: enrichedInfo.network?.status,
        
        // 📱 Appareil
        deviceOS: enrichedInfo.device?.os,
        deviceBrowser: enrichedInfo.device?.browser,
        deviceType: enrichedInfo.device?.type,
        devicePlatform: enrichedInfo.device?.platform,
        deviceLanguage: enrichedInfo.device?.language,
        deviceCPUCores: enrichedInfo.device?.cpuCores,
        deviceMemory: enrichedInfo.device?.memory,
        deviceScreenResolution: enrichedInfo.device?.screenResolution,
        deviceScreenOn: enrichedInfo.device?.screenOn,
        
        timestamp: new Date().toISOString()
      };
      
      console.log('📡 Envoi position enrichie:', {
        battery: enrichedInfo.battery?.level + '%',
        network: enrichedInfo.network?.type,
        device: enrichedInfo.device?.os + ' ' + enrichedInfo.device?.browser
      });
      
      socketRef.current.emit('location-update', data);
      
      console.log('📍 Position envoyée via Socket.IO:', {
        userId: user.id,
        lat: location.latitude,
        lng: location.longitude,
        battery: batteryLevel,
        connected: socketRef.current.connected,
        authenticated: isSocketAuthenticated
      });
    }
  };

  // Vérification du CIN en temps réel (pour agents et responsables)
  useEffect(() => {
    if ((profileType === 'agent' || profileType === 'supervisor') && cin.length >= 6) {
      const verifyCin = async () => {
        try {
          const response = await authAPI.verifyCin({ cin });
          if (response.data.success) {
            setUserPreview(response.data.data);
            setError('');
          }
        } catch (err) {
          setUserPreview(null);
          if (cin.length >= 8) {
            setError('CIN non reconnu');
          }
        }
      };

      const debounce = setTimeout(verifyCin, 500);
      return () => clearTimeout(debounce);
    } else {
      setUserPreview(null);
      setError('');
      setErrorCode('');
    }
  }, [cin, profileType]);

  // Sélectionner un type de profil
  const selectProfile = (type) => {
    setProfileType(type);
    setStep('login');
    setError('');
    setErrorCode('');
    setCin('');
    setEmail('');
    setPassword('');
    setUserPreview(null);
  };

  // Retour à la sélection
  const goBack = () => {
    setStep('select');
    setProfileType(null);
    setError('');
  };

  // Login par CIN (Agents et Responsables) - Pour pointage
  const handleCinLogin = async (e) => {
    e.preventDefault();
    console.log('🔐 Starting CIN login process...');
    setLoading(true);
    setError('');
    
    // 🎵 Son de démarrage connexion
    soundEffects.playLoginStart();

    try {
      console.log('📞 Calling loginByCin API...');
      const response = await authAPI.loginByCin({
        cin,
        deviceFingerprint: deviceInfo?.fingerprint,
        deviceInfo,
        userType: profileType === 'agent' ? 'agent' : 'supervisor' // Envoyer le type d'utilisateur
      });

      console.log('✅ LoginByCin API response:', {
        success: response.data.success,
        hasUser: !!response.data.data?.user,
        hasCheckInToken: !!response.data.data?.checkInToken
      });

      if (response.data.success) {
        const user = response.data.data.user;
        const checkInToken = response.data.data.checkInToken;
        const validEvents = response.data.data.validEvents || [];

        console.log('👤 User from login:', {
          id: user?.id,
          firstName: user?.firstName,
          role: user?.role,
          cin: user?.cin,
          validEventsCount: validEvents.length
        });

        // ✅ Stocker les tokens ET les infos utilisateur
        localStorage.setItem('checkInToken', checkInToken);
        localStorage.setItem('token', checkInToken);
        localStorage.setItem('accessToken', checkInToken);
        localStorage.setItem('checkInUser', JSON.stringify(user));
        localStorage.setItem('validEvents', JSON.stringify(validEvents));

        // ✅ Mettre à jour le store Zustand pour authentifier l'utilisateur
        setAuthenticatedUser(user, checkInToken);
        
        // ✅ Initialiser Socket.IO pour le tracking
        initializeSocket(user.id);
        
        // 🎵 Son de succès
        soundEffects.playLoginSuccess();
        toast.success(`Connexion réussie! ${validEvents.length} événement(s) disponible(s).`);
        // ✅ Redirection vers /checkin pour agents/superviseurs
        navigate('/checkin');
      }
    } catch (err) {
      console.error('❌ CIN Login Error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        code: err.response?.data?.code,
        fullError: err
      });

      // ✅ GESTION DES CODES D'ERREUR SPÉCIFIQUES
      const errorCode = err.response?.data?.code;
      const errorData = err.response?.data?.data;
      const message = err.response?.data?.message || 'Erreur de connexion';
      
      // 🎵 Son d'erreur
      soundEffects.playLoginError();

      // Afficher le message d'erreur détaillé
      setError(message);
      setErrorCode(errorCode || '');

      // Affichage de toasts selon le type d'erreur
      if (errorCode === 'OUTSIDE_TIME_WINDOW') {
        // Fenêtre de temps non autorisée
        toast.error(message, {
          autoClose: 8000,
          style: { whiteSpace: 'pre-line' }
        });

        // Afficher les détails des événements si disponibles
        if (errorData?.nextEvent) {
          const nextEvent = errorData.nextEvent;
          console.log('📅 Prochain événement:', nextEvent);
        }
      } else if (errorCode === 'NO_ASSIGNMENTS') {
        toast.error('Vous n\'avez aucune affectation confirmée.', {
          autoClose: 5000
        });
      } else if (errorCode === 'NO_FACIAL_VECTOR') {
        toast.error('Reconnaissance faciale non configurée. Contactez l\'administrateur.', {
          autoClose: 5000
        });
      } else {
        toast.error(message, {
          autoClose: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Login par Email/Password (Admin et Utilisateurs)
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // 🎵 Son de démarrage connexion
    soundEffects.playLoginStart();
    
    try {
      // Utiliser le store Zustand pour la connexion (met à jour isAuthenticated)
      const result = await storeLogin(email, password);

      if (result.success) {
        soundEffects.playLoginSuccess();
        toast.success('Connexion réussie!');
        navigate('/dashboard');
      } else {
        soundEffects.playLoginError();
        setError(result.error || 'Email ou mot de passe incorrect');
      }
    } catch (err) {
      soundEffects.playLoginError();
      setError(err.response?.data?.message || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  // Profils disponibles
  const profiles = [
    {
      type: 'agent',
      title: 'Agent de sécurité',
      description: 'Pointage d\'entrée et de sortie',
      icon: FiShield,
      color: 'blue',
      loginMethod: 'cin'
    },
    {
      type: 'supervisor',
      title: 'Responsable',
      description: 'Supervision des agents et pointage',
      icon: FiUserCheck,
      color: 'yellow',
      loginMethod: 'cin'
    },
    {
      type: 'admin',
      title: 'Administrateur',
      description: 'Gestion complète du système',
      icon: FiSettings,
      color: 'red',
      loginMethod: 'email'
    }
  ];

  const getColorClasses = (color, isSelected = false) => {
    const colors = {
      blue: {
        bg: isSelected ? 'bg-blue-100 border-blue-500' : 'bg-blue-50 hover:bg-blue-100 border-transparent hover:border-blue-300',
        icon: 'text-blue-600',
        text: 'text-blue-700'
      },
      yellow: {
        bg: isSelected ? 'bg-yellow-100 border-yellow-500' : 'bg-yellow-50 hover:bg-yellow-100 border-transparent hover:border-yellow-300',
        icon: 'text-yellow-600',
        text: 'text-yellow-700'
      },
      red: {
        bg: isSelected ? 'bg-red-100 border-red-500' : 'bg-red-50 hover:bg-red-100 border-transparent hover:border-red-300',
        icon: 'text-red-600',
        text: 'text-red-700'
      }
    };
    return colors[color];
  };

  const selectedProfile = profiles.find(p => p.type === profileType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo et Titre */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
            <FiShield className="text-primary-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white">Security Guard</h1>
          <p className="text-primary-200 mt-2">Système de gestion</p>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* ÉTAPE 1: Sélection du profil */}
          {step === 'select' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
                Connexion
              </h2>
              <p className="text-gray-500 text-center mb-6">
                Sélectionnez votre profil
              </p>

              <div className="space-y-3">
                {profiles.map((profile) => {
                  const colors = getColorClasses(profile.color);
                  return (
                    <button
                      key={profile.type}
                      onClick={() => selectProfile(profile.type)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center ${colors.bg}`}
                    >
                      <div className={`w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mr-4`}>
                        <profile.icon className={colors.icon} size={24} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-semibold ${colors.text}`}>{profile.title}</p>
                        <p className="text-sm text-gray-500">{profile.description}</p>
                      </div>
                      <FiArrowRight className="text-gray-400" size={20} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ÉTAPE 2: Formulaire de connexion */}
          {step === 'login' && selectedProfile && (
            <div className="p-6">
              {/* Header avec bouton retour */}
              <div className="flex items-center mb-6">
                <button
                  onClick={goBack}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-3"
                >
                  <FiArrowLeft className="text-gray-600" size={20} />
                </button>
                <div className="flex items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                    selectedProfile.color === 'blue' ? 'bg-blue-100' :
                    selectedProfile.color === 'yellow' ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <selectedProfile.icon className={getColorClasses(selectedProfile.color).icon} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{selectedProfile.title}</p>
                    <p className="text-xs text-gray-500">
                      {selectedProfile.loginMethod === 'cin' ? 'Connexion par CIN' : 'Connexion par Email'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulaire CIN (Agents et Responsables) */}
              {selectedProfile.loginMethod === 'cin' && (
                <form onSubmit={handleCinLogin}>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro CIN
                    </label>
                    <div className="relative">
                      <FiCreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        value={cin}
                        onChange={(e) => setCin(e.target.value.toUpperCase())}
                        placeholder="Mettez votre CIN ici"
                        className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-xl text-lg font-mono tracking-wider focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        required
                        autoFocus
                      />
                      {userPreview?.exists && (
                        <FiCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={24} />
                      )}
                    </div>
                  </div>

                  {/* Prévisualisation utilisateur */}
                  {userPreview?.user && (
                    <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center">
                        {userPreview.user.profilePhoto ? (
                          <img
                            src={userPreview.user.profilePhoto}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover border-2 border-green-300"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold">
                            {userPreview.user.firstName?.[0]}{userPreview.user.lastName?.[0]}
                          </div>
                        )}
                        <div className="ml-3 flex-1">
                          <p className="font-semibold text-gray-800">
                            {userPreview.user.firstName} {userPreview.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{userPreview.user.employeeId}</p>
                        </div>
                        {userPreview.hasFacialVector && (
                          <span className="text-xs text-green-600 flex items-center bg-green-100 px-2 py-1 rounded-full">
                            <FiCheck className="mr-1" size={12} /> Visage OK
                          </span>
                        )}
                      </div>

                      {!userPreview.isActive && (
                        <div className="mt-3 p-2 bg-red-100 rounded-lg text-red-700 text-sm flex items-center">
                          <FiAlertCircle className="mr-2" /> Compte inactif
                        </div>
                      )}

                      {!userPreview.hasFacialVector && (
                        <div className="mt-3 p-2 bg-yellow-100 rounded-lg text-yellow-700 text-sm flex items-center">
                          <FiAlertCircle className="mr-2" /> Reconnaissance faciale non configurée
                        </div>
                      )}
                    </div>
                  )}

                  {/* Erreur */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start">
                      <FiAlertCircle className="mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{error}</p>
                        <p className="text-xs text-red-600 mt-2">
                          {errorCode === 'NOT_CONFIRMED' && '⏳ Demandez à votre administrateur de confirmer votre affectation dans la gestion des événements.'}
                          {errorCode === 'NO_ASSIGNMENTS' && profileType === 'agent' && '📋 Vérifiez auprès de votre responsable que vous êtes bien affecté et confirmé à un événement actif.'}
                          {errorCode === 'NO_ASSIGNMENTS' && profileType === 'supervisor' && '📋 Vérifiez que vous êtes bien affecté comme directeur, responsable de zone, ou via une affectation confirmée à un événement actif.'}
                          {!errorCode && profileType === 'agent' && '⚠️ Assurez-vous d\'être connecté via la section "Agents" avec un CIN valide et une affectation confirmée.'}
                          {!errorCode && profileType === 'supervisor' && '⚠️ Assurez-vous d\'être connecté via la section "Responsables" avec un CIN valide.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bouton connexion */}
                  <button
                    type="submit"
                    disabled={loading || !cin || (userPreview && !userPreview.isActive)}
                    className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Accéder au pointage
                        <FiArrowRight className="ml-2" />
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center mt-4">
                    Vous serez redirigé vers l'écran de pointage
                  </p>
                </form>
              )}

              {/* Formulaire Email/Password (Admin) */}
              {selectedProfile.loginMethod === 'email' && (
                <form onSubmit={handleEmailLogin}>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="votre@email.com"
                          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mot de passe
                      </label>
                      <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Erreur */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center">
                      <FiAlertCircle className="mr-2 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Bouton connexion */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Accéder au tableau de bord
                        <FiArrowRight className="ml-2" />
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center mt-4">
                    Accès complet à l'administration
                  </p>
                </form>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 pb-6">
            <div className="text-center text-xs text-gray-400 pt-4 border-t">
              <p className="mb-2">
                © {new Date().getFullYear()} SGM – Security Guard | Système de gestion
              </p>
              {deviceInfo && (
                <p className="mb-3">
                  {deviceInfo.browser} sur {deviceInfo.os}
                </p>
              )}
              <div className="flex items-center justify-center gap-4 mt-3">
                <a 
                  href="/about" 
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  À Propos
                </a>
                <span className="text-gray-500">•</span>
                <a 
                  href="/privacy" 
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Confidentialité
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Note de sécurité */}
        <p className="text-center text-primary-200 text-sm mt-6">
          Connexion sécurisée
        </p>
      </div>
    </div>
  );
};

export default CheckInLogin;
