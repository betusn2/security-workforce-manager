/**
 * SERVICE SOCKET.IO POUR MOBILE APP
 * 🚀 Gestion temps réel pour React Native avec tracking GPS automatique
 * 
 * Fonctionnalités :
 * - Authentification Socket.IO stricte
 * - Tracking GPS automatique toutes les 5 secondes
 * - Battery/Network/Device info enrichies
 * - Gestion reconnexion automatique
 */

import { io } from 'socket.io-client';
import * as Location from 'expo-location';
import deviceInfoService from './deviceInfoService';

const SOCKET_URL = 'https://security-guard-backend-w3qv.onrender.com'; // Production Render

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.eventHandlers = new Map();
    
    // Tracking GPS automatique
    this.trackingInterval = null;
    this.currentUserId = null;
    this.currentEventId = null;
    this.locationSubscription = null;
  }

  /**
   * 🔌 CONNEXION SOCKET.IO avec authentification stricte
   * @param {string} userId - ID de l'utilisateur
   * @param {string} role - Rôle (agent, supervisor, admin)
   * @param {string} eventId - ID de l'événement (optionnel)
   * @param {string} token - JWT token (optionnel)
   */
  connect(userId, role, eventId = null, token = null) {
    if (this.socket?.connected) {
      console.log('ℹ️ Socket.IO déjà connecté');
      return;
    }

    this.currentUserId = userId;
    this.currentEventId = eventId;

    try {
      this.socket = io(SOCKET_URL, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        auth: token ? { token } : undefined
      });

      // Événements de connexion
      this.socket.on('connect', () => {
        console.log('✅ Socket.IO Mobile connecté');
        this.isConnected = true;
        
        // S'authentifier
        this.socket.emit('auth', {
          userId,
          role,
          eventId,
          token
        });
        
        // Rejoindre la room de l'événement
        if (eventId) {
          this.socket.emit('event:join', eventId);
          this.socket.emit('tracking:subscribe', eventId);
        }
        
        this._triggerHandler('connected', { userId, role, eventId });
      });

      this.socket.on('auth:success', (data) => {
        console.log('✅ Authentification Socket.IO réussie:', data);
        this.isAuthenticated = true;
        this._triggerHandler('authenticated', data);
        
        // 🚀 Démarrer le tracking GPS automatique
        this.startGPSTracking();
      });

      this.socket.on('auth:error', (error) => {
        console.error('❌ Erreur authentification Socket.IO:', error);
        this.isAuthenticated = false;
        this._triggerHandler('auth_error', error);
      });

      this.socket.on('disconnect', () => {
        console.log('🔴 Socket.IO Mobile déconnecté');
        this.isConnected = false;
        this.isAuthenticated = false;
        this._triggerHandler('disconnected');
        
        // Arrêter le tracking GPS
        this.stopGPSTracking();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erreur connexion Socket.IO:', error.message);
        this.isConnected = false;
        this.isAuthenticated = false;
        this._triggerHandler('connection_error', error);
      });

      // ========================================
      // ÉVÉNEMENTS MÉTIER
      // ========================================

      // Tracking GPS
      this.socket.on('tracking:position_update', (data) => {
        this._triggerHandler('position_update', data);
      });

      this.socket.on('tracking:current_positions', (positions) => {
        this._triggerHandler('current_positions', positions);
      });

      // Check-in / Présence
      this.socket.on('checkin:new', (data) => {
        this._triggerHandler('checkin_new', data);
      });

      this.socket.on('checkin:updated', (data) => {
        this._triggerHandler('checkin_updated', data);
      });

      // Incidents
      this.socket.on('incident:new', (data) => {
        this._triggerHandler('incident_new', data);
      });

      this.socket.on('incident:updated', (data) => {
        this._triggerHandler('incident_updated', data);
      });

      // SOS / Urgence
      this.socket.on('sos:alert', (data) => {
        this._triggerHandler('sos_alert', data);
      });

      this.socket.on('sos:cancelled', (data) => {
        this._triggerHandler('sos_cancelled', data);
      });

      // Notifications
      this.socket.on('notification:new', (data) => {
        this._triggerHandler('notification_new', data);
      });

      // Événements
      this.socket.on('event:updated', (data) => {
        this._triggerHandler('event_updated', data);
      });

      this.socket.on('event:deleted', (data) => {
        this._triggerHandler('event_deleted', data);
      });

      // Affectations
      this.socket.on('assignment:new', (data) => {
        this._triggerHandler('assignment_new', data);
      });

      // Affectations
      this.socket.on('assignment:new', (data) => {
        this._triggerHandler('assignment_new', data);
      });

      this.socket.on('assignment:updated', (data) => {
        this._triggerHandler('assignment_updated', data);
      });

      // 📸 Demande de capture d'écran depuis le dashboard admin
      this.socket.on('agent:screenshot_request', (data) => {
        console.log('📸 Demande capture reçue du dashboard:', data);
        this._triggerHandler('screenshot_request', data);
      });

    } catch (error) {
      console.error('Erreur connexion Socket.IO:', error);
    }
  }

  /**
   * 🔌 DÉCONNEXION
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.eventHandlers.clear();
      console.log('🔴 Socket.IO Mobile déconnecté manuellement');
    }
  }

  /**
   * 📡 ÉMETTRE UN ÉVÉNEMENT
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données à envoyer
   */
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket.IO non connecté - impossible d\'émettre:', event);
    }
  }

  /**
   * 👂 ÉCOUTER UN ÉVÉNEMENT
   * @param {string} event - Nom de l'événement
   * @param {Function} handler - Fonction de callback
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * 🚫 RETIRER UN ÉCOUTEUR
   * @param {string} event - Nom de l'événement
   * @param {Function} handler - Fonction de callback
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 🔄 DÉCLENCHER LES HANDLERS ENREGISTRÉS
   * @private
   */
  _triggerHandler(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Erreur dans handler ${event}:`, error);
        }
      });
    }
  }

  /**
   * ========================================
   * MÉTHODES SPÉCIFIQUES POUR MOBILE
   * ========================================
   */

  /**
   * 📍 ENVOYER POSITION GPS (version enrichie)
   * @param {object} data - Toutes les données de position
   */
  sendPosition(data) {
    // Support ancien format (lat, lng, accuracy) et nouveau format enrichi (objet)
    if (typeof data === 'number') {
      // Ancien appel: sendPosition(lat, lng, accuracy)
      const [latitude, longitude, accuracy] = arguments;
      this.emit('tracking:position', { latitude, longitude, accuracy, timestamp: Date.now() });
    } else {
      this.emit('tracking:position', { timestamp: Date.now(), ...data });
    }
  }

  /**
   * 📸 ENVOYER RÉPONSE CAPTURE D'ÉCRAN
   * @param {string} agentId
   * @param {string} imageBase64 - data:image/jpeg;base64,...
   */
  sendScreenshotResponse(agentId, imageBase64) {
    this.emit('agent:screenshot_response', { agentId, imageBase64, timestamp: Date.now() });
  }

  /**
   * 📸 ENVOYER ERREUR CAPTURE
   * @param {string} agentId
   * @param {string} message
   */
  sendScreenshotError(agentId, message) {
    this.emit('agent:screenshot_error', { agentId, message });
  }

  /**
   * ✅ ENVOYER CHECK-IN
   * @param {string} eventId - ID de l'événement
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} photo - URI de la photo (base64)
   */
  sendCheckin(eventId, latitude, longitude, photo = null) {
    this.emit('checkin:create', {
      eventId,
      latitude,
      longitude,
      photo,
      timestamp: Date.now()
    });
  }

  /**
   * 🚨 ENVOYER SOS
   * @param {string} eventId - ID de l'événement
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} message - Message d'urgence
   */
  sendSOS(eventId, latitude, longitude, message = '') {
    this.emit('sos:trigger', {
      eventId,
      latitude,
      longitude,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * ❌ ANNULER SOS
   * @param {string} sosId - ID du SOS
   */
  cancelSOS(sosId) {
    this.emit('sos:cancel', { sosId });
  }

  /**
   * 📸 ENVOYER RAPPORT D'INCIDENT
   * @param {string} eventId - ID de l'événement
   * @param {string} type - Type d'incident
   * @param {string} description
   * @param {number} latitude
   * @param {number} longitude
   * @param {Array<string>} photos - URIs des photos
   */
  sendIncident(eventId, type, description, latitude, longitude, photos = []) {
    this.emit('incident:create', {
      eventId,
      type,
      description,
      latitude,
      longitude,
      photos,
      timestamp: Date.now()
    });
  }

  /**
   * 🔔 MARQUER NOTIFICATION COMME LUE
   * @param {string} notificationId - ID de la notification
   */
  markNotificationAsRead(notificationId) {
    this.emit('notification:read', { notificationId });
  }

  /**
   * 📊 S'ABONNER AU TRACKING D'UN ÉVÉNEMENT
   * @param {string} eventId - ID de l'événement
   */
  subscribeToEvent(eventId) {
    this.emit('tracking:subscribe', eventId);
  }

  /**
   * 📊 SE DÉSABONNER DU TRACKING D'UN ÉVÉNEMENT
   * @param {string} eventId - ID de l'événement
   */
  unsubscribeFromEvent(eventId) {
    this.emit('tracking:unsubscribe', eventId);
  }

  /**
   * ========================================
   * TRACKING GPS AUTOMATIQUE - TOUTES LES 5 SECONDES
   * ========================================
   */

  /**
   * 🚀 DÉMARRER LE TRACKING GPS AUTOMATIQUE
   * Envoie la position toutes les 5 secondes avec infos enrichies
   */
  async startGPSTracking() {
    // Ne démarrer que si authentifié
    if (!this.isAuthenticated) {
      console.log('⏳ En attente authentification Socket.IO avant démarrage GPS...');
      return;
    }

    if (this.trackingInterval) {
      console.log('ℹ️ Tracking GPS déjà actif');
      return;
    }

    console.log('🚀 Démarrage tracking GPS automatique (toutes les 5s)...');

    // Vérifier permission GPS
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Permission GPS non accordée');
      return;
    }

    // Envoyer position immédiatement
    await this._sendCurrentPosition();

    // Puis toutes les 5 secondes
    this.trackingInterval = setInterval(async () => {
      await this._sendCurrentPosition();
    }, 5000);

    console.log('✅ Tracking GPS automatique démarré');
  }

  /**
   * 🛑 ARRÊTER LE TRACKING GPS AUTOMATIQUE
   */
  stopGPSTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      console.log('🛑 Tracking GPS automatique arrêté');
    }

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  /**
   * 📍 ENVOYER LA POSITION ACTUELLE avec TOUTES infos enrichies
   * @private
   */
  async _sendCurrentPosition() {
    try {
      if (!this.isAuthenticated || !this.socket?.connected) {
        console.log('⏳ Socket non authentifié, skip position');
        return;
      }

      // Obtenir position GPS
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
        maximumAge: 0
      });

      // Collecter TOUTES les infos enrichies (Battery, Network, Device)
      const transmissionData = await deviceInfoService.getTransmissionData(location.coords);

      // Ajouter userId
      transmissionData.userId = this.currentUserId;

      // Émettre via Socket.IO
      this.emit('location-update', transmissionData);

      console.log('📍 Position envoyée:', {
        lat: location.coords.latitude.toFixed(6),
        lng: location.coords.longitude.toFixed(6),
        battery: transmissionData.batteryLevel + '%',
        network: transmissionData.networkType,
        authenticated: this.isAuthenticated
      });

    } catch (error) {
      console.error('❌ Erreur envoi position GPS:', error.message);
    }
  }

  /**
   * 📡 ENVOYER POSITION MANUELLE (avec infos enrichies)
   * Utilisé pour check-in/check-out avec position ponctuelle
   */
  async sendEnrichedPosition(userId) {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const transmissionData = await deviceInfoService.getTransmissionData(location.coords);
      transmissionData.userId = userId || this.currentUserId;

      this.emit('location-update', transmissionData);
      
      return transmissionData;
    } catch (error) {
      console.error('❌ Erreur position enrichie:', error);
      return null;
    }
  }
}

// Singleton
const socketService = new SocketService();

export default socketService;
