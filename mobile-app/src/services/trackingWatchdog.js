/**
 * 🐕 TRACKING WATCHDOG — Production Grade
 * ==========================================
 * Surveille la santé du tracking GPS toutes les 20 secondes.
 * Redémarre automatiquement si la tâche background s'est arrêtée.
 *
 * Gère également :
 *  — Dialog optimisation batterie (Samsung/Xiaomi/Oppo/Realme)
 *  — Alerte si aucune position depuis 60s
 *  — Alerte admin via Socket.IO si tracking interrompu
 *  — Restart automatique après déconnexion réseau
 *
 * À démarrer dans App.js dès la connexion de l'agent.
 * Ne rien faire pour admin (pas de tracking).
 */

import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform, AppState } from 'react-native';
import {
  BACKGROUND_LOCATION_TASK,
  BG_FETCH_TASK,
  startBackgroundTracking,
  TS_KEY_BG,
  TS_KEY_SOCKET,
} from './backgroundLocationTask';
import { API_URL } from '../config';
import axios from 'axios';

// ─── Configuration ──────────────────────────────────────────────────────────
const WATCHDOG_INTERVAL_MS     = 20_000; // vérifier toutes les 20s
const STALE_POSITION_MS        = 60_000; // alerte si pas de position depuis 60s
const RESTART_COOLDOWN_MS      = 30_000; // ne pas redémarrer plus d'1 fois / 30s
const BATT_OPT_PROMPT_KEY      = 'wdg_batt_opt_prompted_v2'; // une seule fois par install

let _watchdogInterval    = null;
let _lastRestartAttempt  = 0;
let _watchdogUserId      = null;
let _watchdogEventId     = null;
let _appStateSubscription = null;

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Démarrer le watchdog (à appeler au login de l'agent)
 */
export async function startTrackingWatchdog(userId, eventId = null) {
  _watchdogUserId  = userId;
  _watchdogEventId = eventId;

  stopTrackingWatchdog(); // éviter les doublons

  console.log('🐕 TrackingWatchdog démarré');

  // ── 1. Demander l'exemption batteries optimisation (une seule fois) ─────
  await requestBatteryOptimizationIfNeeded();

  // ── 2. Enregistrer expo-background-fetch (WorkManager — survit au Doze) ─
  await BackgroundFetch.registerTaskAsync(BG_FETCH_TASK, {
    minimumInterval: 15 * 60,  // 15 min (minimum Android)
    stopOnTerminate: false,    // continue même si app tuée
    startOnBoot: true,         // redémarre après reboot
  }).catch(() => {});          // ignoré si déjà enregistré

  // ── 3. Vérification immédiate, puis toutes les 20s ────────────────────
  await _checkAndHeal();
  _watchdogInterval = setInterval(_checkAndHeal, WATCHDOG_INTERVAL_MS);

  // ── 4. Vérifier aussi à chaque retour au premier plan ─────────────────
  _appStateSubscription = AppState.addEventListener('change', async (nextState) => {
    if (nextState === 'active') {
      await _checkAndHeal();
    }
  });
}

/**
 * Arrêter le watchdog (à appeler au logout)
 */
export function stopTrackingWatchdog() {
  if (_watchdogInterval) {
    clearInterval(_watchdogInterval);
    _watchdogInterval = null;
  }
  if (_appStateSubscription) {
    _appStateSubscription.remove();
    _appStateSubscription = null;
  }
  BackgroundFetch.unregisterTaskAsync(BG_FETCH_TASK).catch(() => {});
  console.log('🐕 TrackingWatchdog arrêté');
}

// ─── Logique interne ────────────────────────────────────────────────────────

async function _checkAndHeal() {
  if (!_watchdogUserId) return;

  try {
    // ── A. Vérifier si la tâche background est active ──────────────────
    let isRunning = false;
    try {
      isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch { isRunning = false; }

    if (!isRunning) {
      const now = Date.now();
      if (now - _lastRestartAttempt > RESTART_COOLDOWN_MS) {
        _lastRestartAttempt = now;
        console.warn('🐕 [Watchdog] Tâche background stopée → redémarrage...');

        const restarted = await startBackgroundTracking(_watchdogUserId, _watchdogEventId);
        if (restarted) {
          console.log('✅ [Watchdog] Background tracking redémarré');
        } else {
          console.error('❌ [Watchdog] Échec redémarrage — permissions manquantes?');
          await _notifyTrackingInterrupted();
        }
      }
      return; // ne pas vérifier le stale si on vient de redémarrer
    }

    // ── B. Vérifier si une position a été envoyée récemment ───────────
    const lastSocketTs = parseInt(await AsyncStorage.getItem(TS_KEY_SOCKET) || '0');
    const lastBgTs     = parseInt(await AsyncStorage.getItem(TS_KEY_BG)     || '0');
    const lastAnySendTs = Math.max(lastSocketTs, lastBgTs);

    if (lastAnySendTs > 0 && Date.now() - lastAnySendTs > STALE_POSITION_MS) {
      console.warn(`🐕 [Watchdog] Position non mise à jour depuis ${Math.round((Date.now() - lastAnySendTs) / 1000)}s`);
      await _notifyTrackingStale(lastAnySendTs);
    }

  } catch (err) {
    console.warn('🐕 [Watchdog] Erreur vérification:', err.message);
  }
}

/**
 * Notifier l'admin + notification locale si tracking interrompu
 */
async function _notifyTrackingInterrupted() {
  try {
    // Notification locale visible même si app en background
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Suivi GPS interrompu',
        body:  'Le suivi GPS s\'est arrêté. Ouvrez l\'application pour le relancer.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#f59e0b',
        data: { type: 'tracking_interrupted' },
      },
      trigger: null,
    });

    // Alerte backend si token disponible
    const token = await AsyncStorage.getItem('accessToken')
                || await AsyncStorage.getItem('checkInToken');
    if (token && _watchdogUserId) {
      await axios.post(`${API_URL}/tracking/alert`, {
        type:      'tracking_interrupted',
        message:   'Tracking GPS interrompu — redémarrage requis',
        userId:    _watchdogUserId,
        eventId:   _watchdogEventId || null,
        timestamp: new Date().toISOString(),
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }).catch(() => {});
    }
  } catch {}
}

/**
 * Notifier si aucune position reçue depuis STALE_POSITION_MS
 */
async function _notifyTrackingStale(lastTs) {
  const staleKey = 'wdg_stale_alerted_ts';
  const lastAlert = parseInt(await AsyncStorage.getItem(staleKey) || '0');
  if (Date.now() - lastAlert < 5 * 60_000) return; // cooldown 5 min

  await AsyncStorage.setItem(staleKey, String(Date.now()));

  const elapsedMin = Math.round((Date.now() - lastTs) / 60_000);

  const token = await AsyncStorage.getItem('accessToken')
              || await AsyncStorage.getItem('checkInToken');
  if (token && _watchdogUserId) {
    await axios.post(`${API_URL}/tracking/alert`, {
      type:    'tracking_stale',
      message: `Aucune position GPS depuis ${elapsedMin} minute(s)`,
      userId:  _watchdogUserId,
      eventId: _watchdogEventId || null,
      data:    { elapsedMin, lastTs },
      timestamp: new Date().toISOString(),
    }, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }).catch(() => {});
  }
}

// ─── Optimisation batterie ────────────────────────────────────────────────

/**
 * Afficher un dialog pour demander à l'utilisateur de désactiver
 * l'optimisation batterie pour l'app (Samsung/Xiaomi/Oppo/Realme/Huawei).
 * Affiché UNE SEULE FOIS par installation.
 */
export async function requestBatteryOptimizationIfNeeded() {
  if (Platform.OS !== 'android') return;

  try {
    const alreadyPrompted = await AsyncStorage.getItem(BATT_OPT_PROMPT_KEY);
    if (alreadyPrompted) return;

    await AsyncStorage.setItem(BATT_OPT_PROMPT_KEY, '1');

    // Petit délai pour ne pas montrer immédiatement au démarrage
    setTimeout(() => {
      Alert.alert(
        '⚡ Suivi GPS — Action requise',
        'Pour un suivi fiable même en veille ou écran éteint, veuillez désactiver l\'optimisation batterie pour cette application.\n\n' +
        '📱 Étapes :\n' +
        '1. Appuyez sur "Ouvrir Paramètres"\n' +
        '2. Trouvez "Batterie" ou "Optimisation"\n' +
        '3. Sélectionnez "Sans restriction" ou "Jamais optimiser"',
        [
          {
            text: 'Plus tard',
            style: 'cancel',
            onPress: () => AsyncStorage.removeItem(BATT_OPT_PROMPT_KEY), // permettre de reposer
          },
          {
            text: 'Activer maintenant',
            onPress: () => {
              // Dialog système direct : "Autoriser à ignorer les optimisations batterie ?"
              // Identique à ce que fait inDrive/Uber/Grab
              IntentLauncher.startActivityAsync(
                'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
                { data: 'package:com.securityguard.mobile' }
              ).catch(() => Linking.openSettings());
            },
          },
        ],
        { cancelable: false }
      );
    }, 3000);

  } catch {}
}

/**
 * Mettre à jour l'eventId si l'agent change d'événement en session
 */
export function updateWatchdogEventId(eventId) {
  _watchdogEventId = eventId;
  if (_watchdogUserId) {
    // Sauvegarder pour la tâche background (qui lit depuis AsyncStorage)
    AsyncStorage.setItem('currentEventId', eventId ? String(eventId) : '').catch(() => {});
  }
}
