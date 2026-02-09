/**
 * 📊 SERVICE DE STATISTIQUES DE TRACKING EN TEMPS RÉEL
 * 
 * Calcule les statistiques de tracking pour un agent :
 * - Distance totale parcourue
 * - Vitesse moyenne
 * - Temps actif / temps d'arrêt
 * - Temps hors périmètre
 * - Historique de trajet (polyline)
 */

class TrackingStatsService {
  constructor() {
    this.agentStats = new Map(); // userId -> stats
    this.agentPaths = new Map(); // userId -> array of positions
  }

  /**
   * 🎯 Initialiser le tracking pour un agent
   */
  initializeAgent(userId, initialPosition) {
    this.agentStats.set(userId, {
      totalDistance: 0, // Distance totale en mètres
      movingDistance: 0, // Distance en mouvement
      totalTime: 0, // Temps total en secondes
      movingTime: 0, // Temps en mouvement
      stoppedTime: 0, // Temps à l'arrêt
      outsideGeofenceTime: 0, // Temps hors périmètre
      averageSpeed: 0, // Vitesse moyenne en km/h
      maxSpeed: 0, // Vitesse max en km/h
      positionsCount: 1,
      lastPosition: initialPosition,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      batteryConsumed: 0, // Batterie consommée en %
      initialBattery: initialPosition.batteryLevel || 100,
      networkChanges: 0, // Nombre de changements de réseau
      lastNetworkType: initialPosition.networkType || 'unknown',
      screenOffTime: 0, // Temps écran éteint
      lastScreenState: true
    });

    // Historique du trajet (pour polyline sur carte)
    this.agentPaths.set(userId, [{
      lat: initialPosition.latitude,
      lng: initialPosition.longitude,
      timestamp: new Date(),
      batteryLevel: initialPosition.batteryLevel || 100,
      isMoving: initialPosition.isMoving || false,
      networkType: initialPosition.networkType || 'unknown'
    }]);
  }

  /**
   * 📍 Mettre à jour les stats avec une nouvelle position
   */
  updatePosition(userId, newPosition) {
    const stats = this.agentStats.get(userId);
    if (!stats) {
      // Initialiser si pas encore fait
      this.initializeAgent(userId, newPosition);
      return this.getStats(userId);
    }

    const path = this.agentPaths.get(userId);
    const lastPos = stats.lastPosition;
    const now = new Date();
    
    // Calculer le temps écoulé depuis dernière mise à jour
    const timeElapsed = (now - stats.lastUpdateTime) / 1000; // en secondes
    stats.totalTime += timeElapsed;

    // Calculer la distance depuis dernière position
    const distance = this._calculateDistance(
      lastPos.latitude,
      lastPos.longitude,
      newPosition.latitude,
      newPosition.longitude
    );

    stats.totalDistance += distance;

    // Si en mouvement (distance > 5m pour filtrer bruit GPS)
    if (distance > 0.005 && newPosition.isMoving) {
      stats.movingDistance += distance;
      stats.movingTime += timeElapsed;
      
      // Calculer vitesse instantanée
      const instantSpeed = (distance / timeElapsed) * 3.6; // km/h
      if (instantSpeed > stats.maxSpeed && instantSpeed < 150) { // Max 150 km/h pour filtrer erreurs
        stats.maxSpeed = instantSpeed;
      }
    } else {
      stats.stoppedTime += timeElapsed;
    }

    // Temps hors périmètre
    if (!newPosition.isWithinGeofence) {
      stats.outsideGeofenceTime += timeElapsed;
    }

    // Batterie consommée
    if (newPosition.batteryLevel && lastPos.batteryLevel) {
      const batteryDiff = lastPos.batteryLevel - newPosition.batteryLevel;
      if (batteryDiff > 0) {
        stats.batteryConsumed += batteryDiff;
      }
    }

    // Changements de réseau
    if (newPosition.networkType && newPosition.networkType !== stats.lastNetworkType) {
      stats.networkChanges++;
      stats.lastNetworkType = newPosition.networkType;
    }

    // Temps écran éteint
    if (newPosition.deviceScreenOn === false && stats.lastScreenState === true) {
      // Écran vient de s'éteindre
      stats.lastScreenOffTime = now;
    } else if (newPosition.deviceScreenOn === false) {
      // Écran toujours éteint
      stats.screenOffTime += timeElapsed;
    }
    stats.lastScreenState = newPosition.deviceScreenOn;

    // Mettre à jour vitesse moyenne
    if (stats.movingTime > 0) {
      stats.averageSpeed = (stats.movingDistance / (stats.movingTime / 3600)); // km/h
    }

    // Incrémenter compteur positions
    stats.positionsCount++;
    stats.lastPosition = newPosition;
    stats.lastUpdateTime = now;

    // Ajouter au chemin (limiter à 1000 points max)
    path.push({
      lat: newPosition.latitude,
      lng: newPosition.longitude,
      timestamp: now,
      batteryLevel: newPosition.batteryLevel || 100,
      isMoving: newPosition.isMoving || false,
      networkType: newPosition.networkType || 'unknown'
    });
    
    if (path.length > 1000) {
      path.shift(); // Retirer le plus ancien
    }

    return this.getStats(userId);
  }

  /**
   * 📊 Obtenir les statistiques d'un agent
   */
  getStats(userId) {
    const stats = this.agentStats.get(userId);
    if (!stats) return null;

    const now = new Date();
    const totalTimeMinutes = Math.floor(stats.totalTime / 60);
    const movingTimeMinutes = Math.floor(stats.movingTime / 60);
    const stoppedTimeMinutes = Math.floor(stats.stoppedTime / 60);
    const outsideTimeMinutes = Math.floor(stats.outsideGeofenceTime / 60);
    const screenOffTimeMinutes = Math.floor(stats.screenOffTime / 60);

    return {
      userId,
      
      // Distance
      totalDistance: this._formatDistance(stats.totalDistance),
      totalDistanceMeters: stats.totalDistance,
      movingDistance: this._formatDistance(stats.movingDistance),
      
      // Temps
      totalTime: this._formatDuration(stats.totalTime),
      totalTimeSeconds: stats.totalTime,
      movingTime: this._formatDuration(stats.movingTime),
      movingTimeMinutes,
      stoppedTime: this._formatDuration(stats.stoppedTime),
      stoppedTimeMinutes,
      outsideGeofenceTime: this._formatDuration(stats.outsideGeofenceTime),
      outsideTimeMinutes,
      
      // Vitesse
      averageSpeed: stats.averageSpeed.toFixed(1),
      maxSpeed: stats.maxSpeed.toFixed(1),
      currentSpeed: stats.lastPosition.speedKmh || '0',
      
      // Pourcentages
      movingPercentage: stats.totalTime > 0 ? ((stats.movingTime / stats.totalTime) * 100).toFixed(0) : 0,
      stoppedPercentage: stats.totalTime > 0 ? ((stats.stoppedTime / stats.totalTime) * 100).toFixed(0) : 0,
      outsidePercentage: stats.totalTime > 0 ? ((stats.outsideGeofenceTime / stats.totalTime) * 100).toFixed(0) : 0,
      
      // Battérie
      batteryConsumed: stats.batteryConsumed.toFixed(1),
      initialBattery: stats.initialBattery,
      currentBattery: stats.lastPosition.batteryLevel || 100,
      batteryPerHour: stats.totalTime > 0 ? ((stats.batteryConsumed / (stats.totalTime / 3600))).toFixed(1) : 0,
      
      // Réseau & Appareil
      networkChanges: stats.networkChanges,
      currentNetwork: stats.lastNetworkType,
      screenOffTime: this._formatDuration(stats.screenOffTime),
      screenOffTimeMinutes,
      
      // Méta
      positionsCount: stats.positionsCount,
      dataPoints: stats.positionsCount,
      startTime: stats.startTime,
      duration: this._formatDuration((now - stats.startTime) / 1000),
      
      // Position actuelle
      lastPosition: stats.lastPosition,
      
      // Dernière mise à jour
      lastUpdate: stats.lastUpdateTime
    };
  }

  /**
   * 🗺️ Obtenir le chemin parcouru (pour polyline)
   */
  getPath(userId) {
    return this.agentPaths.get(userId) || [];
  }

  /**
   * 📈 Obtenir toutes les stats de tous les agents
   */
  getAllStats() {
    const allStats = {};
    for (const userId of this.agentStats.keys()) {
      allStats[userId] = this.getStats(userId);
    }
    return allStats;
  }

  /**
   * 🗑️ Nettoyer les stats d'un agent (check-out)
   */
  clearAgent(userId) {
    this.agentStats.delete(userId);
    this.agentPaths.delete(userId);
  }

  /**
   * 🗑️ Tout nettoyer
   */
  clearAll() {
    this.agentStats.clear();
    this.agentPaths.clear();
  }

  // ====================================
  // HELPERS PRIVÉS
  // ====================================

  /**
   * Calculer distance entre 2 points GPS (formule Haversine)
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon terre en km
    const dLat = this._toRad(lat2 - lat1);
    const dLon = this._toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance en km
    
    return distance; // en km
  }

  _toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  _formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(2)} km`;
  }

  _formatDuration(seconds) {
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`;
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min ${secs}s`;
  }
}

// Export singleton
const trackingStatsService = new TrackingStatsService();
export default trackingStatsService;
