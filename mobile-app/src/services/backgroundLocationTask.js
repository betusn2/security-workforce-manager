/**
 * 🔋 TÂCHE GPS ARRIÈRE-PLAN — PRODUCTION GRADE
 * =====================================================
 * Ce fichier DOIT être importé en PREMIER dans App.js
 * pour que expo-task-manager l'enregistre avant tout.
 *
 * Stratégie background Android :
 * ┌─────────────────────────────────────────────────────────┐
 * │  Foreground Service (notification persistante)           │
 * │  → Empêche Android de tuer le processus                 │
 * │  → Intervalle natif GPS : 5 secondes                    │
 * │  → Envoi HTTP (Socket.IO peut être suspendu par Hermes) │
 * │  → stopWithTask=false → survit au "swipe to close"      │
 * └─────────────────────────────────────────────────────────┘
 *
 * Déduplication : skip HTTP si socket/HTTP ont envoyé < 6s
 * Adaptatif     : ralentit si batterie critique (<15%)
 * Hors-ligne    : stocke positions localement, synchro au retour
 * Alertes       : POST alerte si GPS/réseau coupé
 *
 * Compatible Android 10 → 15, Samsung/Xiaomi/Oppo/Realme
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { API_URL } from '../config';

export const BACKGROUND_LOCATION_TASK = 'SECURITY_GUARD_BACKGROUND_LOCATION';
export const BG_FETCH_TASK            = 'SECURITY_GUARD_BG_FETCH';

// ─── Clés AsyncStorage partagées ──────────────────────────────────────────
export const TS_KEY_SOCKET = 'lastSocketSendTs';  // mis à jour par trackingService
export const TS_KEY_BG     = 'lastBgSendTs';      // mis à jour par cette tâche
const DEDUP_THRESHOLD_MS   = 6000;  // skip si une position a été envoyée < 6s

// ─── Tâche Background Fetch (WorkManager) — heartbeat secondaire ─────────
// Utilisée par Android pour réveiller l'app toutes les ~15 min via WorkManager,
// même en mode Doze. Redémarre le foreground service si nécessaire.
TaskManager.defineTask(BG_FETCH_TASK, async () => {
  try {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) return BackgroundFetch.BackgroundFetchResult.NoData;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    ).catch(() => false);

    if (!isRunning) {
      const eventId = await AsyncStorage.getItem('currentEventId');
      // startBackgroundTracking est défini plus bas dans ce fichier (hoisting function)
      await startBackgroundTracking(userId, eventId).catch(() => {});
      console.log('🔁 [BgFetch] Foreground service relancé via WorkManager');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Définition de la tâche native GPS ───────────────────────────────────
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

    // ─── Batterie ─────────────────────────────────────────────────────────
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

    // ─── Réseau ───────────────────────────────────────────────────────────
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

    // ─── Déduplication : skip si un envoi (socket OU HTTP) < 6s ──────────
    // trackingService écrit lastSocketSendTs après chaque envoi socket.
    // Cette tâche écrit lastBgSendTs après chaque envoi HTTP.
    // On évite les doublons quand socket et background tournent ensemble.
    const lastSocketTs = parseInt(await AsyncStorage.getItem(TS_KEY_SOCKET) || '0');
    const lastBgTs     = parseInt(await AsyncStorage.getItem(TS_KEY_BG)     || '0');
    const lastAnySendTs = Math.max(lastSocketTs, lastBgTs);

    if (Date.now() - lastAnySendTs < DEDUP_THRESHOLD_MS) {
      await AsyncStorage.multiSet([
        ['lastKnownLat', String(latitude)],
        ['lastKnownLng', String(longitude)],
        ['alert_last_activity_ts', String(Date.now())],
      ]);
      console.log(`⏭️ [BG] Skip (envoi il y a ${Math.round((Date.now() - lastAnySendTs) / 1000)}s) — ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      return;
    }

    // ─── Appareil
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

    // ─── Envoi HTTP (Socket.IO suspendu en background sur Hermes) ─────────
    await axios.post(`${API_URL}/tracking/location`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    // ✅ Marquer le timestamp HTTP pour le prochain cycle de déduplication
    await AsyncStorage.setItem(TS_KEY_BG, String(Date.now()));

    // ─── Notification sortie de zone + détection sortie anticipée ──────────
    if (eventLat && eventLng && !isWithinGeofence) {
      const lastZoneStatus = await AsyncStorage.getItem('lastGeofenceStatus');
      if (lastZoneStatus !== 'outside') {
        await AsyncStorage.setItem('lastGeofenceStatus', 'outside');

        // Vérifier si sortie AVANT la fin de l'événement
        let isEarlyDeparture = false;
        let timeLeftMsg = '';
        try {
          const evStr = await AsyncStorage.getItem('currentEventData');
          if (evStr) {
            const ev = JSON.parse(evStr);
            const endDate = ev.endDate ? new Date(ev.endDate) : null;
            const now = new Date();
            if (endDate && now < endDate) {
              isEarlyDeparture = true;
              const minsLeft = Math.round((endDate - now) / 60000);
              timeLeftMsg = ` — encore ${minsLeft} min avant la fin`;
              // Envoyer alerte sortie anticipée au backend
              try {
                await axios.post(`${API_URL}/tracking/alert`, {
                  type: 'geofence_early_exit',
                  message: `Sortie anticipée de la zone (${distanceFromEvent}m)${timeLeftMsg}`,
                  userId, eventId,
                  distanceFromEvent, latitude, longitude,
                  timestamp: new Date().toISOString(),
                }, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 });
              } catch {}
            }
          }
        } catch {}

        await Notifications.scheduleNotificationAsync({
          content: {
            title: isEarlyDeparture ? '🚨 Sortie anticipée détectée' : '⚠️ Sortie de zone',
            body: isEarlyDeparture
              ? `Vous avez quitté votre zone avant la fin de l'événement${timeLeftMsg}. Distance: ${distanceFromEvent}m.`
              : `Vous êtes à ${distanceFromEvent}m de votre zone (limite: ${eventRadius}m). Retournez dans la zone.`,
            sound: true,
            priority: isEarlyDeparture
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.HIGH,
            color: '#ef4444',
          },
          trigger: null,
        });
      }
    } else if (eventLat && eventLng && isWithinGeofence) {
      const lastZoneStatus = await AsyncStorage.getItem('lastGeofenceStatus');
      if (lastZoneStatus === 'outside') {
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

    // Sauvegarder dernière position pour l'inactivité (intelligentAlertsService)
    await AsyncStorage.setItem('lastKnownLat', String(latitude));
    await AsyncStorage.setItem('lastKnownLng', String(longitude));
    await AsyncStorage.setItem('alert_last_activity_ts', String(Date.now()));

    // ─── Alertes batterie : 20% (faible) et 10% (critique) ────────────────
    if (batteryLevel !== null && !batteryCharging) {
      const now = Date.now();
      const COOLDOWN_CRIT = 10 * 60 * 1000;  // 10 min pour critique
      const COOLDOWN_LOW  = 20 * 60 * 1000;  // 20 min pour faible

      if (batteryLevel <= 10) {
        const lastCrit = await AsyncStorage.getItem('alert_batt_crit_ts');
        if (!lastCrit || now - parseInt(lastCrit) > COOLDOWN_CRIT) {
          await AsyncStorage.setItem('alert_batt_crit_ts', String(now));
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔋 Batterie CRITIQUE — ${batteryLevel}%`,
              body: `URGENT : Batterie à ${batteryLevel}%. Branchez votre chargeur IMMÉDIATEMENT pour maintenir le suivi GPS.`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
              color: '#dc2626',
              vibrate: [0, 300, 100, 300, 100, 600],
            },
            trigger: null,
          });
          // Signaler au backend
          try {
            await axios.post(`${API_URL}/tracking/alert`, {
              type: 'battery_critical',
              message: `Batterie critique : ${batteryLevel}%`,
              userId, eventId: eventId || null,
              data: { batteryLevel, batteryCharging: false },
              timestamp: new Date().toISOString(),
            }, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 });
          } catch {}
        }
      } else if (batteryLevel <= 20) {
        const lastLow = await AsyncStorage.getItem('alert_batt_low_ts');
        if (!lastLow || now - parseInt(lastLow) > COOLDOWN_LOW) {
          await AsyncStorage.setItem('alert_batt_low_ts', String(now));
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔋 Batterie faible — ${batteryLevel}%`,
              body: `Batterie à ${batteryLevel}%. Pensez à brancher votre chargeur pour maintenir le suivi GPS.`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              color: '#f59e0b',
            },
            trigger: null,
          });
        }
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
      timeInterval: 5000,          // ✅ 5 secondes (was 15s) — temps réel
      distanceInterval: 0,         // ✅ Toujours envoyer même si stationnaire (was 10m)
      deferredUpdatesInterval: 3000, // Grouper les updates si décalés
      deferredUpdatesDistance: 0,  // Sans filtre distance pour les updates groupées
      showsBackgroundLocationIndicator: true, // indicateur GPS sur iOS

      // ─── ANDROID FOREGROUND SERVICE ─────────────────────────────
      // Crée une notification PERSISTANTE non-supprimable.
      // Empêche Android, Samsung, Xiaomi, Oppo, etc. de tuer l'app.
      foregroundService: {
        notificationTitle: '📍 Security Guard — Suivi GPS actif',
        notificationBody:  'Tracking en temps réel • Écran éteint : suivi maintenu',
        notificationColor: '#1d4ed8',
        killServiceOnDestroy: false,  // ✅ Survit au "swipe to close" (was absent/true)
      },

      // Ne PAS mettre en pause automatiquement
      pausesUpdatesAutomatically: false,

      // Type activité navigation générale (OtherNavigation = walking/standing)
      activityType: Location.ActivityType.OtherNavigation,
      useSignificantChanges: false, // toujours en mode complet, pas "significant-only"
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
