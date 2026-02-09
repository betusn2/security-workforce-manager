/**
 * 📊 SERVICE DE STATISTIQUES DE TRACKING EN TEMPS RÉEL (BACKEND)
 * 
 * Calcule et maintient les statistiques de tracking pour tous les agents
 */

class TrackingStatsService {
  constructor() {
    this.agentStats = new Map();
    this.agentPaths = new Map();
  }

  initializeAgent(userId, initialPosition) {
    this.agentStats.set(userId, {
      totalDistance: 0,
      movingDistance: 0,
      totalTime: 0,
      movingTime: 0,
      stoppedTime: 0,
      outsideGeofenceTime: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      positionsCount: 1,
      lastPosition: initialPosition,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      batteryConsumed: 0,
      initialBattery: initialPosition.batteryLevel || 100,
      networkChanges: 0,
      lastNetworkType: initialPosition.networkType || 'unknown',
      screenOffTime: 0,
      lastScreenState: true
    });

    this.agentPaths.set(userId, [{
      lat: initialPosition.latitude,
      lng: initialPosition.longitude,
      timestamp: new Date(),
      batteryLevel: initialPosition.batteryLevel || 100,
      isMoving: initialPosition.isMoving || false
    }]);
  }

  updatePosition(userId, newPosition) {
    const stats = this.agentStats.get(userId);
    if (!stats) {
      this.initializeAgent(userId, newPosition);
      return this.getStats(userId);
    }

    const path = this.agentPaths.get(userId);
    const lastPos = stats.lastPosition;
    const now = new Date();
    
    const timeElapsed = (now - stats.lastUpdateTime) / 1000;
    stats.totalTime += timeElapsed;

    const distance = this.calculateDistance(
      lastPos.latitude,
      lastPos.longitude,
      newPosition.latitude,
      newPosition.longitude
    );

    stats.totalDistance += distance;

    if (distance > 0.005 && newPosition.isMoving) {
      stats.movingDistance += distance;
      stats.movingTime += timeElapsed;
      
      const instantSpeed = (distance / timeElapsed) * 3.6;
      if (instantSpeed > stats.maxSpeed && instantSpeed < 150) {
        stats.maxSpeed = instantSpeed;
      }
    } else {
      stats.stoppedTime += timeElapsed;
    }

    if (!newPosition.isWithinGeofence) {
      stats.outsideGeofenceTime += timeElapsed;
    }

    if (newPosition.batteryLevel && lastPos.batteryLevel) {
      const batteryDiff = lastPos.batteryLevel - newPosition.batteryLevel;
      if (batteryDiff > 0) {
        stats.batteryConsumed += batteryDiff;
      }
    }

    if (newPosition.networkType && newPosition.networkType !== stats.lastNetworkType) {
      stats.networkChanges++;
      stats.lastNetworkType = newPosition.networkType;
    }

    if (newPosition.deviceScreenOn === false) {
      stats.screenOffTime += timeElapsed;
    }
    stats.lastScreenState = newPosition.deviceScreenOn;

    if (stats.movingTime > 0) {
      stats.averageSpeed = (stats.movingDistance / (stats.movingTime / 3600));
    }

    stats.positionsCount++;
    stats.lastPosition = newPosition;
    stats.lastUpdateTime = now;

    path.push({
      lat: newPosition.latitude,
      lng: newPosition.longitude,
      timestamp: now,
      batteryLevel: newPosition.batteryLevel || 100,
      isMoving: newPosition.isMoving || false
    });
    
    if (path.length > 1000) {
      path.shift();
    }

    return this.getStats(userId);
  }

  getStats(userId) {
    const stats = this.agentStats.get(userId);
    if (!stats) return null;

    return {
      userId,
      totalDistance: this.formatDistance(stats.totalDistance),
      totalDistanceMeters: stats.totalDistance * 1000,
      movingDistance: this.formatDistance(stats.movingDistance),
      totalTime: this.formatDuration(stats.totalTime),
      totalTimeSeconds: stats.totalTime,
      movingTime: this.formatDuration(stats.movingTime),
      stoppedTime: this.formatDuration(stats.stoppedTime),
      outsideGeofenceTime: this.formatDuration(stats.outsideGeofenceTime),
      averageSpeed: stats.averageSpeed.toFixed(1),
      maxSpeed: stats.maxSpeed.toFixed(1),
      currentSpeed: stats.lastPosition.speedKmh || '0',
      movingPercentage: stats.totalTime > 0 ? ((stats.movingTime / stats.totalTime) * 100).toFixed(0) : 0,
      stoppedPercentage: stats.totalTime > 0 ? ((stats.stoppedTime / stats.totalTime) * 100).toFixed(0) : 0,
      batteryConsumed: stats.batteryConsumed.toFixed(1),
      initialBattery: stats.initialBattery,
      currentBattery: stats.lastPosition.batteryLevel || 100,
      networkChanges: stats.networkChanges,
      currentNetwork: stats.lastNetworkType,
      screenOffTime: this.formatDuration(stats.screenOffTime),
      positionsCount: stats.positionsCount,
      startTime: stats.startTime,
      lastUpdate: stats.lastUpdateTime
    };
  }

  getPath(userId) {
    return this.agentPaths.get(userId) || [];
  }

  getAllStats() {
    const allStats = {};
    for (const userId of this.agentStats.keys()) {
      allStats[userId] = this.getStats(userId);
    }
    return allStats;
  }

  clearAgent(userId) {
    this.agentStats.delete(userId);
    this.agentPaths.delete(userId);
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(2)} km`;
  }

  formatDuration(seconds) {
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

module.exports = TrackingStatsService;
