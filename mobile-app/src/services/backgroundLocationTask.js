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
import { API_URL } from '../config';

export const BACKGROUND_LOCATION_TASK = 'SECURITY_GUARD_BACKGROUND_LOCATION';

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

    // ─── Infos événement pour géofence ─────────────────────────────────────
    let eventLat = null, eventLng = null, eventRadius = 200;
    try {
      const eventDataStr = await AsyncStorage.getItem('currentEventData');
      if (eventDataStr) {
        const ev = JSON.parse(eventDataStr);
        eventLat = ev.latitude ? parseFloat(ev.latitude) : null;
        eventLng = ev.longitude ? parseFloat(ev.longitude) : null;
        eventRadius = ev.geoRadius || 200;
      }
    } catch {}

    // ─── Calcul géofence ───────────────────────────────────────────────────
    let distanceFromEvent = null;
    let isWithinGeofence = true; // défaut: dans zone
    if (eventLat && eventLng) {
      const R = 6371e3;
      const p1 = (latitude * Math.PI) / 180;
      const p2 = (eventLat * Math.PI) / 180;
      const dp = ((eventLat - latitude) * Math.PI) / 180;
      const dl = ((eventLng - longitude) * Math.PI) / 180;
      const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
      distanceFromEvent = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      isWithinGeofence = distanceFromEvent <= eventRadius;
    }

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
      isWithinGeofence,
      distanceFromEvent,
      source: 'background',
    };

    // Envoyer via HTTP API (Socket.IO peut être suspendu)
    await axios.post(`${API_URL}/tracking/location`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    // ─── Notification locale si sortie de zone ─────────────────────────────
    if (eventLat && eventLng && !isWithinGeofence) {
      const lastZoneStatus = await AsyncStorage.getItem('lastGeofenceStatus');
      // N'envoyer la notification que si le statut a changé (entré/sorti)
      if (lastZoneStatus !== 'outside') {
        await AsyncStorage.setItem('lastGeofenceStatus', 'outside');
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Sortie de zone',
            body: `Vous êtes à ${distanceFromEvent}m de votre zone de travail (limite: ${eventRadius}m). Retournez dans la zone.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: '#ef4444',
          },
          trigger: null, // immédiate
        });
      }
    } else if (eventLat && eventLng && isWithinGeofence) {
      const lastZoneStatus = await AsyncStorage.getItem('lastGeofenceStatus');
      if (lastZoneStatus === 'outside') {
        // Agent revenu dans la zone
        await AsyncStorage.setItem('lastGeofenceStatus', 'inside');
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '✅ Retour en zone',
            body: 'Vous êtes revenu dans votre zone de travail.',
            sound: false,
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
            color: '#10b981',
          },
          trigger: null,
        });
      }
    }

    // ─── Alerte batterie critique ──────────────────────────────────────────
    if (batteryLevel !== null && batteryLevel <= 15 && !batteryCharging) {
      const lastBattWarn = await AsyncStorage.getItem('lastBatteryWarning');
      const now = Date.now();
      // Alerte max 1 fois par 15 minutes
      if (!lastBattWarn || now - parseInt(lastBattWarn) > 15 * 60 * 1000) {
        await AsyncStorage.setItem('lastBatteryWarning', String(now));
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🔋 Batterie ${batteryLevel <= 5 ? 'critique' : 'faible'} — ${batteryLevel}%`,
            body: batteryLevel <= 5
              ? 'Batterie critique ! Connectez votre chargeur immédiatement.'
              : `Batterie à ${batteryLevel}%. Branchez votre téléphone bientôt.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: '#ef4444',
          },
          trigger: null,
        });
      }
    }

    // ─── Preuve de présence périodique (toutes les 30 min) ────────────────
    try {
      const attendanceId = await AsyncStorage.getItem('currentAttendanceId');
      if (attendanceId && eventId) {
        const lastProofStr = await AsyncStorage.getItem('lastPeriodicProof');
        const lastProof = lastProofStr ? parseInt(lastProofStr) : 0;
        const thirtyMin = 30 * 60 * 1000;
        if (Date.now() - lastProof >= thirtyMin) {
          await AsyncStorage.setItem('lastPeriodicProof', String(Date.now()));
          await axios.post(`${API_URL}/attendance/periodic-proof`, {
            eventId,
            attendanceId,
            latitude, longitude, accuracy,
            isWithinGeofence, distanceFromEvent,
          }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          });
          console.log('📸 [BG] Preuve périodique envoyée');
        }
      }
    } catch (proofErr) {
      console.warn('⚠️ [BG] Preuve périodique échouée:', proofErr.message);
    }

    console.log(`📍 [BG] ${latitude.toFixed(5)}, ${longitude.toFixed(5)} | ${speedKmh}km/h | batt:${batteryLevel}% | zone:${isWithinGeofence ? '✅' : `❌ ${distanceFromEvent}m`}`);

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
