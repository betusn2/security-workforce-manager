/**
 * 🔋 TÂCHE GPS ARRIÈRE-PLAN (Background Location Task)
 * =====================================================
 * Ce fichier DOIT être importé dans App.js (racine du projet)
 * avant tout autre import, pour que expo-task-manager l'enregistre.
 *
 * Fonctionnement :
 * - Android : crée un Foreground Service avec notification persistante
 *   → Le GPS continue même si l'écran est éteint / app en arrière-plan
 * - iOS     : Background mode "location" (déclaré dans app.json)
 *
 * En arrière-plan, Socket.IO peut être suspendu → on POSTe via HTTP API.
 * En premier plan, trackingService.js utilise Socket.IO pour le temps réel.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

export const BACKGROUND_LOCATION_TASK = 'SECURITY_GUARD_BACKGROUND_LOCATION';
const API_URL = 'https://security-guard-backend-w3qv.onrender.com/api';

// ─── Définition de la tâche ────────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('❌ Erreur tâche background GPS:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  const loc = locations[locations.length - 1]; // prendre la plus récente
  const { latitude, longitude, accuracy, altitude, speed, heading } = loc.coords;
  const timestamp = loc.timestamp;

  try {
    // Récupérer userId et token depuis AsyncStorage (pas de contexte React dispo)
    const userId = await AsyncStorage.getItem('userId');
    const eventId = await AsyncStorage.getItem('currentEventId');
    const token = await AsyncStorage.getItem('accessToken')
      || await AsyncStorage.getItem('checkInToken');

    if (!userId || !token) return;

    // Batterie
    let batteryLevel = null, batteryCharging = false, batteryStatus = '—';
    try {
      const level = await Battery.getBatteryLevelAsync();
      const state = await Battery.getBatteryStateAsync();
      batteryLevel = Math.round(level * 100);
      batteryCharging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
      batteryStatus = batteryCharging ? 'En charge'
        : batteryLevel > 80 ? 'Bon'
        : batteryLevel > 30 ? 'Normal'
        : batteryLevel > 15 ? 'Faible' : 'Critique';
    } catch {}

    // Réseau
    let networkType = 'Inconnu', networkOnline = true;
    try {
      const net = await Network.getNetworkStateAsync();
      const typeMap = {
        [Network.NetworkStateType.WIFI]: 'WiFi',
        [Network.NetworkStateType.CELLULAR]: '4G',
        [Network.NetworkStateType.NONE]: 'Aucun',
        [Network.NetworkStateType.UNKNOWN]: 'Inconnu',
      };
      networkType = typeMap[net.type] || 'Inconnu';
      networkOnline = !!(net.isConnected && net.isInternetReachable);
    } catch {}

    // Appareil
    const deviceOS = Platform.OS === 'android'
      ? `Android ${Platform.Version}`
      : `iOS ${Platform.Version}`;
    const deviceType = Device.deviceType === Device.DeviceType.PHONE ? 'Téléphone' : 'Tablette';

    const speedKmh = speed != null ? Math.round(speed * 3.6 * 10) / 10 : 0;

    // Payload complet
    const payload = {
      latitude, longitude, accuracy,
      altitude, speed, speedKmh, heading,
      isMoving: speedKmh > 0.5,
      timestamp,
      batteryLevel, batteryCharging, batteryStatus,
      batteryEstimatedTime: !batteryCharging && batteryLevel > 0
        ? `~${Math.round(batteryLevel * 4)}min` : null,
      networkType, networkOnline,
      deviceOS, deviceType,
      deviceScreenOn: false, // écran éteint (app en arrière-plan)
      deviceBrowser: `Expo/${Device.modelName || 'Mobile'}`,
      userId,
      eventId: eventId || null,
      source: 'background',
    };

    // Envoyer via HTTP API (Socket.IO peut être suspendu)
    await axios.post(`${API_URL}/tracking/location`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    // Mettre à jour la notification Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    }

    console.log(`📍 [BG] ${latitude.toFixed(5)}, ${longitude.toFixed(5)} | ${speedKmh}km/h | batt:${batteryLevel}%`);

  } catch (err) {
    // Stocker localement si pas de réseau
    try {
      const pending = JSON.parse(await AsyncStorage.getItem('pendingPositions') || '[]');
      pending.push({ latitude, longitude, accuracy, altitude, speed, heading, timestamp });
      // Garder max 50 positions en attente
      if (pending.length > 50) pending.splice(0, pending.length - 50);
      await AsyncStorage.setItem('pendingPositions', JSON.stringify(pending));
    } catch {}
    console.warn('⚠️ [BG] Position stockée localement:', err.message);
  }
});

/**
 * Démarrer le tracking GPS arrière-plan
 * @param {string} userId
 * @param {string|null} eventId
 */
export async function startBackgroundTracking(userId, eventId = null) {
  try {
    // Sauvegarder dans AsyncStorage pour la tâche background
    await AsyncStorage.setItem('userId', String(userId));
    await AsyncStorage.setItem('currentEventId', eventId ? String(eventId) : '');

    // Vérifier si déjà actif
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      console.log('✅ Background tracking déjà actif');
      return true;
    }

    // ─── DEMANDER LA PERMISSION FOREGROUND D'ABORD ────────────────────
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      console.error('❌ Permission GPS foreground refusée');
      return false;
    }

    // ─── DEMANDER LA PERMISSION BACKGROUND (obligatoire Android 11+) ──
    // Sans cette permission, startLocationUpdatesAsync échoue silencieusement
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      console.warn('⚠️ Permission GPS arrière-plan refusée - tracking limité au premier plan');
      // Continuer quand même (iOS peut ne pas l'exiger)
    }

    // Démarrer le tracking background avec foreground service
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 30000,          // toutes les 30 secondes (économie stockage 3×)
      distanceInterval: 15,         // ou si déplacé de 15m
      deferredUpdatesInterval: 5000,
      deferredUpdatesDistance: 10,
      showsBackgroundLocationIndicator: true, // indicateur GPS sur iOS

      // ─── ANDROID FOREGROUND SERVICE ───────────────────────────────
      // Crée une notification persistante qui empêche Android de tuer l'app
      foregroundService: {
        notificationTitle: '📍 Sécurité — Suivi actif',
        notificationBody: 'Votre position est suivie en temps réel',
        notificationColor: '#2563eb',
      },

      // Pause si pas de mouvement (économie batterie)
      pausesUpdatesAutomatically: false,

      // Actif en arrière-plan
      activityType: Location.ActivityType.OtherNavigation,
      useSignificantChanges: false,  // ne pas utiliser le mode "changements significatifs"
    });

    console.log('✅ Background tracking GPS démarré');
    return true;
  } catch (error) {
    console.error('❌ Erreur démarrage background tracking:', error.message);
    return false;
  }
}

/**
 * Arrêter le tracking GPS arrière-plan
 */
export async function stopBackgroundTracking() {
  try {
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('🛑 Background tracking GPS arrêté');
    }
  } catch (error) {
    console.error('❌ Erreur arrêt background tracking:', error.message);
  }
}

/**
 * Synchroniser les positions stockées localement (quand réseau revient)
 * @param {string} token
 */
export async function syncPendingPositions(token) {
  try {
    const raw = await AsyncStorage.getItem('pendingPositions');
    if (!raw) return;
    const pending = JSON.parse(raw);
    if (pending.length === 0) return;

    const userId = await AsyncStorage.getItem('userId');
    const eventId = await AsyncStorage.getItem('currentEventId');

    for (const pos of pending) {
      try {
        await axios.post(`${API_URL}/tracking/position`, {
          ...pos,
          userId,
          eventId: eventId || null,
          source: 'offline_sync',
        }, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });
      } catch {}
    }

    await AsyncStorage.removeItem('pendingPositions');
    console.log(`✅ ${pending.length} positions synchronisées`);
  } catch {}
}
