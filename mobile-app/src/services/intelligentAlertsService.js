/**
 * 🚨 SERVICE ALERTES INTELLIGENTES
 * ==================================
 * Détecte et déclenche automatiquement des alertes pour :
 *
 *  1. Sortie de zone AVANT la fin de l'événement
 *  2. Batterie faible (20%) et critique (10%)
 *  3. GPS désactivé
 *  4. Internet désactivé
 *  5. Absence d'activité (pas de mouvement > 30 min)
 *  6. Retard check-in
 *
 * Chaque alerte :
 *  → Notification locale sur le mobile de l'agent
 *  → Popup PopupMessageOverlay (si app ouverte)
 *  → Socket.IO vers dashboard admin
 *  → HTTP POST vers l'API backend
 *
 * Fonctionnement en ARRIÈRE-PLAN via backgroundLocationTask.js
 * Fonctionnement en PREMIER PLAN via ce service (polling)
 */

import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import { scheduleLocalNotification } from './notificationService';

// ─── Constantes ───────────────────────────────────────────────────────────────
const BATTERY_LOW_THRESHOLD      = 20;  // %
const BATTERY_CRITICAL_THRESHOLD = 10;  // %
const INACTIVITY_THRESHOLD       = 30 * 60 * 1000; // 30 minutes
const ALERT_COOLDOWN             = 10 * 60 * 1000; // 10 min entre deux alertes identiques

// Clés AsyncStorage pour état des alertes
const KEYS = {
  lastBattLowAlert:      'alert_batt_low_ts',
  lastBattCritAlert:     'alert_batt_crit_ts',
  lastGeofenceExitAlert: 'alert_geofence_exit_ts',
  lastGpsDisabledAlert:  'alert_gps_disabled_ts',
  lastNetDisabledAlert:  'alert_net_disabled_ts',
  lastInactivityAlert:   'alert_inactivity_ts',
  lastActivityTime:      'alert_last_activity_ts',
  lastCheckinAlert:      'alert_checkin_late_ts',
  geofenceStatus:        'lastGeofenceStatus',
};

let _alertsInterval  = null;
let _batterySubscription = null;
let _appStateSubscription = null;

/**
 * Vérifier si une alerte est en cooldown
 */
async function isInCooldown(key, cooldown = ALERT_COOLDOWN) {
  const last = await AsyncStorage.getItem(key);
  if (!last) return false;
  return (Date.now() - parseInt(last)) < cooldown;
}

async function setCooldown(key) {
  await AsyncStorage.setItem(key, String(Date.now()));
}

/**
 * Envoyer notification locale — délègue au service centralisé avec type de canal
 */
async function sendLocalNotification({ title, body, priority = 'high', type = 'default', data = {} }) {
  try {
    await scheduleLocalNotification({
      title,
      body,
      data,
      type,
      urgent: priority === 'urgent',
    });
  } catch (e) {
    console.warn('⚠️ Notification locale:', e.message);
  }
}

/**
 * Envoyer alerte vers backend (sockets + base de données)
 */
async function sendBackendAlert({ type, message, data = {}, userId, eventId }) {
  try {
    const token = await AsyncStorage.getItem('accessToken')
      || await AsyncStorage.getItem('checkInToken');
    if (!token || !userId) return;

    await axios.post(`${API_URL}/tracking/alert`, {
      type, message, userId, eventId: eventId || null,
      ...data,
      timestamp: new Date().toISOString(),
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
  } catch (e) {
    console.warn('⚠️ Alerte backend:', e.message);
  }
}

// ─── CHECK BATTERIE ────────────────────────────────────────────────────────────
async function checkBattery(userId, eventId) {
  try {
    const level  = await Battery.getBatteryLevelAsync();
    const state  = await Battery.getBatteryStateAsync();
    const pct    = Math.round(level * 100);
    const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

    if (charging) return; // Pas d'alerte si en charge

    // Alerte critique (10%)
    if (pct <= BATTERY_CRITICAL_THRESHOLD) {
      if (!(await isInCooldown(KEYS.lastBattCritAlert))) {
        await setCooldown(KEYS.lastBattCritAlert);
        const title = `🔋 Batterie CRITIQUE — ${pct}%`;
        const body  = `URGENT : Batterie à ${pct}%. Branchez votre chargeur IMMÉDIATEMENT pour maintenir le suivi.`;
        await sendLocalNotification({ title, body, priority: 'urgent', type: 'battery_critical' });
        await sendBackendAlert({
          type: 'battery_critical', message: body,
          data: { batteryLevel: pct, batteryCharging: false },
          userId, eventId,
        });
      }
      return;
    }

    // Alerte faible (20%)
    if (pct <= BATTERY_LOW_THRESHOLD) {
      if (!(await isInCooldown(KEYS.lastBattLowAlert))) {
        await setCooldown(KEYS.lastBattLowAlert);
        const title = `🔋 Batterie faible — ${pct}%`;
        const body  = `Batterie à ${pct}%. Veuillez charger votre téléphone pour maintenir le suivi GPS.`;
        await sendLocalNotification({ title, body, priority: 'high', type: 'battery_low' });
        await sendBackendAlert({
          type: 'battery_low', message: body,
          data: { batteryLevel: pct, batteryCharging: false },
          userId, eventId,
        });
      }
    }
  } catch (e) {
    console.warn('⚠️ Check batterie:', e.message);
  }
}

// ─── CHECK GÉOFENCE (sortie avant fin événement) ──────────────────────────────
async function checkGeofenceEarlyDeparture(userId, eventId) {
  if (!eventId) return;
  try {
    const eventDataStr = await AsyncStorage.getItem('currentEventData');
    if (!eventDataStr) return;
    const ev = JSON.parse(eventDataStr);

    const eventEndTime = ev.endDate ? new Date(ev.endDate) : null;
    const now          = new Date();

    // Actif seulement si avant la fin de l'événement
    if (eventEndTime && now >= eventEndTime) return;

    // Récupérer dernière position connue
    const lastPos = await AsyncStorage.getItem('lastKnownLat');
    const lastLng = await AsyncStorage.getItem('lastKnownLng');
    if (!lastPos || !lastLng) return;

    const lat = parseFloat(lastPos);
    const lng = parseFloat(lastLng);
    const evLat = parseFloat(ev.latitude);
    const evLng = parseFloat(ev.longitude);
    const radius = ev.geoRadius || 200;

    if (!evLat || !evLng) return;

    // Calcul distance
    const R = 6371e3;
    const p1 = (lat * Math.PI) / 180, p2 = (evLat * Math.PI) / 180;
    const dp = ((evLat - lat) * Math.PI) / 180;
    const dl = ((evLng - lng) * Math.PI) / 180;
    const a  = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    const isOutside = dist > radius;
    const prevStatus = await AsyncStorage.getItem(KEYS.geofenceStatus);

    if (isOutside && prevStatus !== 'outside') {
      await AsyncStorage.setItem(KEYS.geofenceStatus, 'outside');

      if (!(await isInCooldown(KEYS.lastGeofenceExitAlert))) {
        await setCooldown(KEYS.lastGeofenceExitAlert);

        const timeLeft = eventEndTime
          ? `${Math.round((eventEndTime - now) / 60000)} min avant la fin`
          : 'événement en cours';

        const title = '⚠️ Sortie de zone détectée';
        const body  = `Vous avez quitté l'événement avant l'heure de fin (${timeLeft}). Distance: ${dist}m.`;

        await sendLocalNotification({ title, body, priority: 'urgent', type: 'geofence_early_exit' });
        await sendBackendAlert({
          type: 'geofence_early_exit', message: body,
          data: { distanceFromEvent: dist, eventRadius: radius, timeBeforeEnd: timeLeft },
          userId, eventId,
        });
      }
    } else if (!isOutside && prevStatus === 'outside') {
      await AsyncStorage.setItem(KEYS.geofenceStatus, 'inside');
      await sendLocalNotification({
        title: '✅ Retour en zone',
        body: 'Vous êtes revenu dans votre zone de travail.',
        priority: 'normal',
        type: 'checkin_success',
      });
    }
  } catch (e) {
    console.warn('⚠️ Check géofence:', e.message);
  }
}

// ─── CHECK GPS DÉSACTIVÉ ──────────────────────────────────────────────────────
async function checkGpsEnabled(userId) {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      if (!(await isInCooldown(KEYS.lastGpsDisabledAlert))) {
        await setCooldown(KEYS.lastGpsDisabledAlert);
        await sendLocalNotification({
          title: '📍 GPS désactivé',
          body: 'Le GPS est désactivé sur votre appareil. Activez-le pour continuer le suivi de sécurité.',
          priority: 'urgent',
          type: 'gps_disabled',
        });
        await sendBackendAlert({
          type: 'gps_disabled',
          message: 'Le GPS est désactivé sur l\'appareil de l\'agent.',
          userId,
        });
      }
    }
  } catch (e) {
    console.warn('⚠️ Check GPS:', e.message);
  }
}

// ─── CHECK INTERNET DÉSACTIVÉ ─────────────────────────────────────────────────
async function checkNetwork(userId) {
  try {
    const net = await Network.getNetworkStateAsync();
    const connected = net.isConnected && net.isInternetReachable;
    if (!connected) {
      if (!(await isInCooldown(KEYS.lastNetDisabledAlert, 5 * 60 * 1000))) {
        await setCooldown(KEYS.lastNetDisabledAlert);
        await sendLocalNotification({
          title: '📡 Internet désactivé',
          body: 'Connexion internet perdue. Les positions seront synchronisées dès la reconnexion.',
          priority: 'high',
          type: 'network_disabled',
        });
      }
    }
  } catch {}
}

// ─── CHECK INACTIVITÉ ─────────────────────────────────────────────────────────
async function checkInactivity(userId, eventId) {
  if (!eventId) return;
  try {
    const lastActivity = await AsyncStorage.getItem(KEYS.lastActivityTime);
    if (!lastActivity) {
      await AsyncStorage.setItem(KEYS.lastActivityTime, String(Date.now()));
      return;
    }
    const elapsed = Date.now() - parseInt(lastActivity);
    if (elapsed >= INACTIVITY_THRESHOLD) {
      if (!(await isInCooldown(KEYS.lastInactivityAlert))) {
        await setCooldown(KEYS.lastInactivityAlert);
        const mins = Math.round(elapsed / 60000);
        await sendLocalNotification({
          title: '⏰ Pas d\'activité détectée',
          body: `Aucun mouvement depuis ${mins} minutes. Êtes-vous encore en poste ?`,
          priority: 'high',
          type: 'inactivity',
        });
        await sendBackendAlert({
          type: 'inactivity',
          message: `Aucun mouvement détecté depuis ${mins} minutes.`,
          data: { inactivityDuration: elapsed },
          userId, eventId,
        });
      }
    }
  } catch {}
}

/**
 * Enregistrer une activité (mouvement détecté) — appeler depuis trackingService
 */
export async function recordActivity() {
  await AsyncStorage.setItem(KEYS.lastActivityTime, String(Date.now()));
}

/**
 * Démarrer le service d'alertes intelligentes (premier plan)
 * @param {string} userId
 * @param {string|null} eventId
 */
export function startIntelligentAlertsService(userId, eventId) {
  if (_alertsInterval) clearInterval(_alertsInterval);

  const runChecks = async () => {
    const eid = eventId || (await AsyncStorage.getItem('currentEventId'));
    await Promise.allSettled([
      checkBattery(userId, eid),
      checkGeofenceEarlyDeparture(userId, eid),
      checkGpsEnabled(userId),
      checkNetwork(userId),
      checkInactivity(userId, eid),
    ]);
  };

  // Vérifications toutes les 60 secondes
  runChecks(); // immédiatement au démarrage
  _alertsInterval = setInterval(runChecks, 60 * 1000);

  // Abonnement en temps réel pour la batterie
  try {
    _batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      const pct = Math.round(batteryLevel * 100);
      if (pct <= BATTERY_CRITICAL_THRESHOLD || pct <= BATTERY_LOW_THRESHOLD) {
        checkBattery(userId, eventId);
      }
    });
  } catch {}

  console.log('✅ Service alertes intelligentes démarré');
}

/**
 * Arrêter le service d'alertes intelligentes
 */
export function stopIntelligentAlertsService() {
  if (_alertsInterval) {
    clearInterval(_alertsInterval);
    _alertsInterval = null;
  }
  if (_batterySubscription) {
    _batterySubscription.remove();
    _batterySubscription = null;
  }
  console.log('🛑 Service alertes intelligentes arrêté');
}

/**
 * Déclencher l'alerte de retard check-in
 * À appeler depuis CheckInScreen si l'heure de début est dépassée
 */
export async function triggerLateCheckinAlert(userId, eventId, minutesLate) {
  if (await isInCooldown(KEYS.lastCheckinAlert, 30 * 60 * 1000)) return;
  await setCooldown(KEYS.lastCheckinAlert);

  const title = '⏰ Retard de pointage';
  const body  = `Vous avez ${minutesLate} minute(s) de retard pour votre pointage d'arrivée.`;

  await sendLocalNotification({ title, body, priority: 'high', type: 'checkin_late' });
  await sendBackendAlert({
    type: 'late_checkin',
    message: body,
    data: { minutesLate },
    userId, eventId,
  });
}

/**
 * Déclencher l'alerte de redémarrage téléphone
 * Appelé automatiquement depuis le BootReceiver après un redémarrage
 */
export async function triggerRebootAlert(userId) {
  const title = '📱 Téléphone redémarré';
  const body  = 'Le suivi GPS a été relancé automatiquement après le redémarrage.';
  await sendLocalNotification({ title, body, priority: 'normal', type: 'default' });
}

export default {
  startIntelligentAlertsService,
  stopIntelligentAlertsService,
  recordActivity,
  triggerLateCheckinAlert,
  triggerRebootAlert,
};
