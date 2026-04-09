/**
 * 📍 SERVICE GPS TRACKING (Premier plan)
 * ==========================================
 * Utilisé quand l'app est ACTIVE au premier plan.
 * Envoie via Socket.IO pour le temps réel.
 *
 * Quand l'écran est éteint ou l'app en arrière-plan :
 * → backgroundLocationTask.js prend automatiquement le relais
 *   et envoie via HTTP API (Socket.IO peut être suspendu).
 */

import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from './socketService';

const FOREGROUND_INTERVAL_MS = 5000;  // ✅ 5s — temps réel premier plan (was 15s)
const BACKGROUND_INTERVAL_MS = 8000;  // 8s — foreground service garde socket vivant (was 20s)
const MIN_DISTANCE_METERS = 3;

class TrackingService {
  constructor() {
    this.isTracking = false;
    this.intervalId = null;
    this.lastPosition = null;
    this.userId = null;
    this.eventId = null;
    this.startBattery = null;
    this.positionsCount = 0;
    this.totalDistance = 0;
    this.movingDistance = 0;
    this.maxSpeed = 0;
    this.speedSum = 0;
    this.speedCount = 0;
    this.appStateSubscription = null;
    this._appState = 'active'; // track current state
  }

  /**
   * Démarrer le tracking en premier plan
   */
  async start(userId, eventId) {
    if (this.isTracking) return;

    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      console.error('❌ Permission GPS refusée');
      return false;
    }

    this.userId = userId;
    this.eventId = eventId;
    this.isTracking = true;
    this.startBattery = await this._getBatteryLevel();

    console.log(`✅ TrackingService (foreground+background socket) démarré`);

    // Première position immédiate
    await this._sendPosition();

    // Intervalle de 5s en premier plan.
    // Note : ce timer JS peut être ralenti par Hermes en background.
    // C'est OK — backgroundLocationTask.js (natif) prend le relais écran éteint.
    this.intervalId = setInterval(() => {
      this._sendPosition();
    }, FOREGROUND_INTERVAL_MS);

    // Surveiller l'état de l'app (actif / arrière-plan / veille)
    this.appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      const prev = this._appState;
      this._appState = nextState;
      console.log(`📱 AppState: ${prev} → ${nextState}`);

      if (nextState === 'background' || nextState === 'inactive') {
        // L'écran va s'éteindre — envoyer une dernière position
        // avec deviceScreenOn: false pour signaler à l'interface
        await this._sendPosition(false);
      } else if (nextState === 'active' && prev !== 'active') {
        // Retour au premier plan — envoyer immédiatement
        await this._sendPosition(true);
      }
    });

    return true;
  }

  /**
   * Arrêter le tracking premier plan
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isTracking = false;
    console.log('🛑 TrackingService (socket) arrêté');
  }

  /**
   * Envoyer une position enrichie
   * @param {boolean|null} screenOn - null = auto-détecter depuis AppState
   * @private
   */
  async _sendPosition(screenOn = null) {
    try {
      // GPS
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const { latitude, longitude, accuracy, altitude, speed, heading } = loc.coords;
      const timestamp = loc.timestamp;

      // Calcul distance depuis dernière position
      let isMoving = false;
      if (this.lastPosition) {
        const dist = this._haversine(
          this.lastPosition.latitude, this.lastPosition.longitude,
          latitude, longitude
        );
        this.totalDistance += dist;
        if (dist >= MIN_DISTANCE_METERS) {
          this.movingDistance += dist;
          isMoving = true;
        }
      }
      this.lastPosition = { latitude, longitude };

      // Vitesse
      const speedKmh = speed != null ? Math.round(speed * 3.6 * 10) / 10 : 0;
      if (speedKmh > this.maxSpeed) this.maxSpeed = speedKmh;
      if (speedKmh > 0) { this.speedSum += speedKmh; this.speedCount++; }

      this.positionsCount++;

      // Batterie
      const batteryInfo = await this._getBatteryInfo();

      // Réseau
      const networkInfo = await this._getNetworkInfo();

      // Appareil
      const deviceInfo = this._getDeviceInfo();

      // Statistiques session
      const currentBattery = batteryInfo.batteryLevel;
      const batteryConsumed = this.startBattery != null
        ? Math.max(0, Math.round((this.startBattery - currentBattery) * 100))
        : 0;
      const stats = {
        totalDistance: this._formatDistance(this.totalDistance),
        movingDistance: this._formatDistance(this.movingDistance),
        averageSpeed: this.speedCount > 0 ? Math.round(this.speedSum / this.speedCount * 10) / 10 : 0,
        maxSpeed: Math.round(this.maxSpeed * 10) / 10,
        positionsCount: this.positionsCount,
        batteryConsumed,
      };

      // Statut écran basé sur AppState (ou paramètre explicite)
      const isScreenOn = screenOn !== null
        ? screenOn
        : (this._appState === 'active');

      // Payload complet
      const payload = {
        // GPS
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        speedKmh,
        heading,
        isMoving,
        timestamp,

        // Batterie
        batteryLevel: batteryInfo.batteryLevel,
        batteryCharging: batteryInfo.batteryCharging,
        batteryStatus: batteryInfo.batteryStatus,
        batteryEstimatedTime: batteryInfo.batteryEstimatedTime,

        // Réseau
        networkType: networkInfo.networkType,
        networkOnline: networkInfo.isOnline,
        networkStatus: networkInfo.networkStatus,
        networkDownlink: networkInfo.downlink,
        networkRtt: networkInfo.rtt,

        // Appareil
        deviceOS: deviceInfo.os,
        deviceBrowser: deviceInfo.browser,
        deviceType: deviceInfo.type,
        deviceMemory: deviceInfo.memory,
        deviceCPUCores: deviceInfo.cpuCores,
        deviceScreenOn: isScreenOn,

        // Stats session
        stats,

        // IDs
        userId: this.userId,
        eventId: this.eventId,

        // Source
        source: isScreenOn ? 'realtime' : 'background_socket',
      };

      socketService.emit('tracking:position', payload);
      // 💾 Horodatage partagé — backgroundLocationTask lit cette clé
      // pour éviter les doublons socket/HTTP (seuil 6s)
      AsyncStorage.setItem('lastSocketSendTs', String(Date.now())).catch(() => {});
      console.log(`📍 Position envoyée (socket): ${latitude.toFixed(5)}, ${longitude.toFixed(5)} | batt:${batteryInfo.batteryLevel}% | ${speedKmh}km/h | écran:${isScreenOn ? 'ON' : 'OFF'}`);

    } catch (error) {
      console.error('❌ Erreur envoi position:', error.message);
    }
  }

  /**
   * Lire la batterie complète
   * @private
   */
  async _getBatteryInfo() {
    try {
      const level = await Battery.getBatteryLevelAsync();
      const state = await Battery.getBatteryStateAsync();
      const batteryLevel = Math.round(level * 100);
      const batteryCharging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

      let batteryStatus = '—';
      if (batteryCharging) batteryStatus = 'En charge';
      else if (batteryLevel > 80) batteryStatus = 'Bon';
      else if (batteryLevel > 30) batteryStatus = 'Normal';
      else if (batteryLevel > 15) batteryStatus = 'Faible';
      else batteryStatus = 'Critique';

      const minutesRemaining = !batteryCharging && batteryLevel > 0
        ? Math.round(batteryLevel * 4) // estimation grossière : 1% ≈ 4min
        : null;
      const batteryEstimatedTime = minutesRemaining
        ? minutesRemaining > 60
          ? `~${Math.floor(minutesRemaining / 60)}h${minutesRemaining % 60}min`
          : `~${minutesRemaining}min`
        : null;

      return { batteryLevel, batteryCharging, batteryStatus, batteryEstimatedTime };
    } catch {
      return { batteryLevel: null, batteryCharging: false, batteryStatus: '—', batteryEstimatedTime: null };
    }
  }

  async _getBatteryLevel() {
    try {
      const level = await Battery.getBatteryLevelAsync();
      return level;
    } catch { return null; }
  }

  /**
   * Lire les infos réseau
   * @private
   */
  async _getNetworkInfo() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const typeMap = {
        [Network.NetworkStateType.WIFI]: 'WiFi',
        [Network.NetworkStateType.CELLULAR]: '4G',
        [Network.NetworkStateType.NONE]: 'Aucun',
        [Network.NetworkStateType.UNKNOWN]: 'Inconnu',
        [Network.NetworkStateType.BLUETOOTH]: 'Bluetooth',
        [Network.NetworkStateType.ETHERNET]: 'Ethernet',
      };
      const networkType = typeMap[networkState.type] || 'Inconnu';
      const isOnline = networkState.isConnected && networkState.isInternetReachable;
      const networkStatus = isOnline ? 'Connecté' : 'Hors ligne';

      return { networkType, isOnline, networkStatus, downlink: null, rtt: null };
    } catch {
      return { networkType: 'Inconnu', isOnline: true, networkStatus: 'Connecté', downlink: null, rtt: null };
    }
  }

  /**
   * Infos appareil (statiques)
   * @private
   */
  _getDeviceInfo() {
    const os = Platform.OS === 'android'
      ? `Android ${Platform.Version}`
      : `iOS ${Platform.Version}`;
    const type = Device.deviceType === Device.DeviceType.PHONE
      ? 'Téléphone'
      : Device.deviceType === Device.DeviceType.TABLET
      ? 'Tablette'
      : 'Inconnu';
    const memory = Device.totalMemory
      ? Math.round(Device.totalMemory / (1024 ** 3))
      : null;

    return {
      os,
      browser: `Expo/${Device.modelName || 'Mobile'}`,
      type,
      memory,
      cpuCores: null,
    };
  }

  /**
   * Formule Haversine — distance en mètres
   * @private
   */
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const f1 = lat1 * Math.PI / 180, f2 = lat2 * Math.PI / 180;
    const df = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _formatDistance(meters) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  }
}

const trackingService = new TrackingService();
export default trackingService;
