/**
 * SERVICE AVANCÉ POUR CARTE DYNAMIQUE AVEC SOCKET.IO
 * 🚀 Gestion temps réel, Socket.IO, animations et performance
 * Migré de WebSocket natif vers Socket.IO
 */

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class DynamicMapService {
  constructor() {
    this.socket = null;
    this.subscribers = new Set();
    this.cache = new Map();
    this.updateQueue = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * 🌟 CONNEXION SOCKET.IO POUR MISES À JOUR TEMPS RÉEL
   */
  initWebSocket() {
    // Socket.IO optionnel - ne pas bloquer si non disponible
    try {
      this.socket = io(SOCKET_URL, {
        path: '/socket.io/',
        transports: ['polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts
      });
      
      this.socket.on('connect', () => {
        console.log('🟢 Socket.IO carte connecté');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifySubscribers('connected', { status: 'connected' });
        
        // S'authentifier
        this.socket.emit('auth', {
          userId: 'map-service',
          role: 'viewer'
        });
      });

      this.socket.on('auth:success', () => {
        console.log('✅ Socket.IO carte authentifié');
      });
      
      // Événements de tracking GPS
      this.socket.on('tracking:position_update', (data) => {
        this.handleAgentLocationUpdate(data);
      });

      // Événements d'événement
      this.socket.on('event:updated', (data) => {
        this.handleEventUpdate(data);
      });

      // Check-in
      this.socket.on('checkin:new', (data) => {
        this.handleAttendanceUpdate(data);
      });

      // Incidents
      this.socket.on('incident:new', (data) => {
        this.handleRealtimeUpdate({ type: 'incident', payload: data });
      });

      // SOS/Urgence
      this.socket.on('sos:alert', (data) => {
        this.handleEmergencyAlert(data);
      });
      
      this.socket.on('disconnect', () => {
        console.log('🔴 Socket.IO carte déconnecté');
        this.isConnected = false;
      });
      
      this.socket.on('connect_error', (error) => {
        // Erreur silencieuse - Socket.IO est optionnel
        console.warn('⚠️ Socket.IO carte non disponible (mode dégradé)');
        this.isConnected = false;
      });
      
    } catch (error) {
      // Échec silencieux - continuer sans Socket.IO
      console.warn('⚠️ Socket.IO non disponible - fonctionnement en mode dégradé');
    }
  }

  /**
   * 📡 GESTION DES MISES À JOUR TEMPS RÉEL
   */
  handleRealtimeUpdate(data) {
    const { type, payload, timestamp } = data;
    
    switch (type) {
      case 'event_update':
        this.handleEventUpdate(payload);
        break;
      case 'agent_location':
        this.handleAgentLocationUpdate(payload);
        break;
      case 'attendance_update':
        this.handleAttendanceUpdate(payload);
        break;
      case 'emergency':
        this.handleEmergencyAlert(payload);
        break;
      default:
        console.log('📦 Mise à jour inconnue:', type, payload);
    }
    
    // Notifier tous les abonnés
    this.notifySubscribers(type, { ...payload, timestamp });
  }

  /**
   * 📍 MISE À JOUR D'ÉVÉNEMENT EN TEMPS RÉEL
   */
  handleEventUpdate(eventData) {
    const cacheKey = `event_${eventData.id}`;
    const cached = this.cache.get(cacheKey);
    
    // Vérifier si c'est vraiment une mise à jour
    if (cached && cached.updatedAt === eventData.updatedAt) {
      return;
    }
    
    // Mettre à jour le cache
    this.cache.set(cacheKey, eventData);
    
    // Animation de mise à jour
    this.animateMarkerUpdate(eventData.id, 'event');
    
    console.log('📍 Événement mis à jour:', eventData.name);
  }

  /**
   * 👤 MISE À JOUR POSITION AGENT EN TEMPS RÉEL
   */
  handleAgentLocationUpdate(agentData) {
    const cacheKey = `agent_${agentData.id}`;
    const cached = this.cache.get(cacheKey);
    
    // Calculer le mouvement
    if (cached && cached.latitude && cached.longitude) {
      const distance = this.calculateDistance(
        cached.latitude, cached.longitude,
        agentData.latitude, agentData.longitude
      );
      
      // Si l'agent s'est déplacé significativement
      if (distance > 0.001) { // ~100 mètres
        this.animateAgentMovement(cached, agentData);
      }
    }
    
    // Mettre à jour le cache avec la nouvelle position
    this.cache.set(cacheKey, agentData);
    
    console.log(`👤 Agent ${agentData.firstName} en mouvement`);
  }

  /**
   * ⏰ MISE À JOUR POINTAGE EN TEMPS RÉEL
   */
  handleAttendanceUpdate(attendanceData) {
    // Notifier le changement de statut d'agent
    this.notifySubscribers('agent_status_change', attendanceData);
    
    // Mettre à jour le badge de l'événement
    this.updateEventBadge(attendanceData.eventId, attendanceData.agentsCount);
    
    console.log('⏰ Pointage mis à jour:', attendanceData);
  }

  /**
   * 🚨 GESTION ALERTES D'URGENCE
   */
  handleEmergencyAlert(alertData) {
    // Animation d'alerte spéciale
    this.animateEmergencyAlert(alertData);
    
    // Son d'alerte (optionnel)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    
    console.log('🚨 ALERTE D\'URGENCE:', alertData);
  }

  /**
   * ✨ ANIMATIONS AVANCÉES
   */
  animateMarkerUpdate(markerId, type) {
    const marker = document.querySelector(`[data-marker-id="${markerId}"]`);
    if (marker) {
      marker.style.animation = 'updatePulse 1s ease-in-out';
      setTimeout(() => {
        marker.style.animation = '';
      }, 1000);
    }
  }

  animateAgentMovement(fromPos, toPos) {
    const duration = 2000; // 2 secondes
    const steps = 60; // 60fps
    const stepDuration = duration / steps;
    
    const latDiff = toPos.latitude - fromPos.latitude;
    const lngDiff = toPos.longitude - fromPos.longitude;
    
    let currentStep = 0;
    
    const animate = () => {
      if (currentStep >= steps) return;
      
      const progress = currentStep / steps;
      const easeProgress = this.easeInOutCubic(progress);
      
      const currentLat = fromPos.latitude + (latDiff * easeProgress);
      const currentLng = fromPos.longitude + (lngDiff * easeProgress);
      
      this.notifySubscribers('agent_move_frame', {
        id: toPos.id,
        latitude: currentLat,
        longitude: currentLng,
        progress: progress
      });
      
      currentStep++;
      setTimeout(animate, stepDuration);
    };
    
    animate();
  }

  animateEmergencyAlert(alertData) {
    // Faire clignoter tous les marqueurs concernés
    const affectedMarkers = document.querySelectorAll(`[data-event-id="${alertData.eventId}"]`);
    
    affectedMarkers.forEach(marker => {
      marker.style.animation = 'emergency-blink 0.5s infinite';
    });
    
    // Arrêter l'animation après 10 secondes
    setTimeout(() => {
      affectedMarkers.forEach(marker => {
        marker.style.animation = '';
      });
    }, 10000);
  }

  updateEventBadge(eventId, count) {
    const badge = document.querySelector(`[data-event-badge="${eventId}"]`);
    if (badge) {
      badge.textContent = count;
      badge.style.animation = 'bounce 0.5s ease-in-out';
      setTimeout(() => {
        badge.style.animation = '';
      }, 500);
    }
  }

  /**
   * 📊 GESTION AVANCÉE DES DONNÉES
   */
  async loadEventsWithCache(filters = {}) {
    const cacheKey = `events_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    
    // Utiliser le cache si disponible et récent (< 30s)
    if (cached && (Date.now() - cached.timestamp) < 30000) {
      return cached.data;
    }
    
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/map/events?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Mettre en cache
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });
      
      return data.data;
    } catch (error) {
      console.error('❌ Erreur chargement événements:', error);
      
      // Retourner le cache si disponible en cas d'erreur
      if (cached) {
        return cached.data;
      }
      
      throw error;
    }
  }

  async loadAgentsWithCache(filters = {}) {
    const cacheKey = `agents_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    
    // Cache plus court pour les agents (10s)
    if (cached && (Date.now() - cached.timestamp) < 10000) {
      return cached.data;
    }
    
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/map/agents?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now()
      });
      
      return data.data;
    } catch (error) {
      console.error('❌ Erreur chargement agents:', error);
      
      if (cached) {
        return cached.data;
      }
      
      throw error;
    }
  }

  /**
   * 🎯 CALCULS GÉOGRAPHIQUES OPTIMISÉS
   */
  calculateOptimalBounds(events, agents) {
    const allPoints = [
      ...events.filter(e => e.latitude && e.longitude).map(e => [e.latitude, e.longitude]),
      ...agents.filter(a => a.latitude && a.longitude).map(a => [a.latitude, a.longitude])
    ];
    
    if (allPoints.length === 0) return null;
    
    if (allPoints.length === 1) {
      return {
        center: allPoints[0],
        zoom: 15
      };
    }
    
    const lats = allPoints.map(p => p[0]);
    const lngs = allPoints.map(p => p[1]);
    
    const bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
    
    // Calculer le centre et le zoom optimal
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    
    const latDiff = bounds.maxLat - bounds.minLat;
    const lngDiff = bounds.maxLng - bounds.minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Calculer le zoom basé sur la distance maximale
    let zoom = 15;
    if (maxDiff > 1) zoom = 8;
    else if (maxDiff > 0.1) zoom = 11;
    else if (maxDiff > 0.01) zoom = 13;
    
    return {
      bounds,
      center: [centerLat, centerLng],
      zoom
    };
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 🔔 SYSTÈME D'ABONNEMENT
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('❌ Erreur callback subscriber:', error);
      }
    });
  }

  /**
   * 🛠️ FONCTIONS UTILITAIRES
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache carte nettoyé');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.subscribers.clear();
    this.clearCache();
  }

  // Getter pour le statut de connexion
  get connectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      cacheSize: this.cache.size
    };
  }
}

// Instance singleton
const dynamicMapService = new DynamicMapService();

// Auto-connection Socket.IO si disponible (optionnel - mode dégradé si échec)
if (typeof window !== 'undefined') {
  // Initialiser Socket.IO uniquement si nécessaire (ex: sur la page de carte)
  // Pour éviter les erreurs inutiles sur d'autres pages
  setTimeout(() => {
    try {
      dynamicMapService.initWebSocket();
    } catch (error) {
      // Échec silencieux - Socket.IO est optionnel
    }
  }, 2000); // Délai pour éviter la surcharge au chargement initial
}

export default dynamicMapService;
