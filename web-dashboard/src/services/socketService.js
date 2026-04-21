/**
 * Service Socket.IO pour les communications en temps réel
 * - Mises à jour de présence en direct
 * - Alertes incidents instantanées
 * - Localisation temps réel des agents
 * - Notifications push
 */

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connected = false;
  }

  /**
   * Initialiser la connexion Socket.IO
   */
  connect(token) {
    if (this.socket?.connected) {
      console.log('Socket déjà connecté');
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventHandlers();
    return this.socket;
  }

  /**
   * Configurer les gestionnaires d'événements de base
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ Socket connecté:', this.socket.id);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('client:ready', { timestamp: Date.now() });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket déconnecté:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erreur connexion socket:', error.message);
      this.reconnectAttempts++;
    });

    this.socket.on('error', (error) => {
      console.error('Erreur socket:', error);
    });

    // Écouter les événements serveur
    this.socket.on('server:message', (data) => {
      console.log('Message serveur:', data);
    });
  }

  /**
   * Déconnecter
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Émettre un événement
   */
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      return true;
    }
    console.warn('Socket non connecté, impossible d\'émettre:', event);
    return false;
  }

  /**
   * Écouter un événement
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      // Stocker pour pouvoir supprimer plus tard
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  /**
   * Arrêter d'écouter un événement
   */
  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  /**
   * Écouter une seule fois
   */
  once(event, callback) {
    if (this.socket) {
      this.socket.once(event, callback);
    }
  }

  // ============================================
  // ÉVÉNEMENTS MÉTIER SPÉCIFIQUES
  // ============================================

  /**
   * Rejoindre une room (événement, équipe, etc.)
   */
  joinRoom(roomId) {
    return this.emit('room:join', { roomId });
  }

  /**
   * Quitter une room
   */
  leaveRoom(roomId) {
    return this.emit('room:leave', { roomId });
  }

  /**
   * Rejoindre la room d'un événement
   */
  joinEventRoom(eventId) {
    return this.joinRoom(`event:${eventId}`);
  }

  /**
   * Rejoindre la room superviseurs
   */
  joinSupervisorRoom() {
    return this.joinRoom('supervisors');
  }

  // --- POINTAGES ---

  /**
   * Écouter les nouveaux pointages
   */
  onNewAttendance(callback) {
    this.on('attendance:new', callback);
  }

  /**
   * Écouter les mises à jour de pointage
   */
  onAttendanceUpdate(callback) {
    this.on('attendance:update', callback);
  }

  /**
   * Signaler un pointage (pour mise à jour temps réel)
   */
  emitAttendance(attendance) {
    return this.emit('attendance:checkin', attendance);
  }

  // --- INCIDENTS ---

  /**
   * Écouter les nouveaux incidents
   */
  onNewIncident(callback) {
    this.on('incident:new', callback);
  }

  /**
   * Écouter les mises à jour d'incident
   */
  onIncidentUpdate(callback) {
    this.on('incident:update', callback);
  }

  /**
   * Signaler un incident
   */
  emitIncident(incident) {
    return this.emit('incident:report', incident);
  }

  // --- LOCALISATION ---

  /**
   * Mettre à jour sa position
   */
  updateLocation(location) {
    return this.emit('location:update', {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: Date.now()
    });
  }

  /**
   * Écouter les positions des agents (superviseurs)
   */
  onAgentLocationUpdate(callback) {
    this.on('agent:location', callback);
  }

  /**
   * Écouter les sorties de zone (alerte dashboard)
   */
  onAgentZoneExit(callback) {
    this.on('agent:zone_exit', callback);
  }

  /**
   * Écouter les alertes batterie faible
   */
  onAgentBatteryLow(callback) {
    this.on('agent:battery_low', callback);
  }

  /**
   * Demander les positions de tous les agents
   */
  requestAgentLocations(eventId = null) {
    return this.emit('agents:locations:request', { eventId });
  }

  // --- ALERTES ---

  /**
   * Écouter les alertes
   */
  onAlert(callback) {
    this.on('alert', callback);
  }

  /**
   * Envoyer une alerte
   */
  sendAlert(alert) {
    return this.emit('alert:send', alert);
  }

  /**
   * Alerte SOS (urgence)
   */
  sendSOS(data) {
    return this.emit('alert:sos', {
      ...data,
      type: 'SOS',
      timestamp: Date.now()
    });
  }

  // --- NOTIFICATIONS ---

  /**
   * Écouter les notifications
   */
  onNotification(callback) {
    this.on('notification', callback);
  }

  // --- CHAT / MESSAGES ---

  /**
   * Envoyer un message
   */
  sendMessage(message) {
    return this.emit('message:send', message);
  }

  /**
   * Écouter les messages
   */
  onMessage(callback) {
    this.on('message:receive', callback);
  }

  // --- STATUT CONNEXION ---

  /**
   * Vérifier si connecté
   */
  isConnected() {
    return this.socket?.connected || false;
  }

  /**
   * Obtenir l'ID du socket
   */
  getSocketId() {
    return this.socket?.id || null;
  }
}

// Singleton
const socketService = new SocketService();

export default socketService;

// Hook React pour utiliser le socket
export const useSocket = () => {
  return socketService;
};
