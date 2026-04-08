/**
 * 🔐 GESTIONNAIRE DE PERMISSIONS — DEMANDE UNIQUE AU PREMIER LANCEMENT
 * =====================================================================
 * Demande TOUTES les permissions nécessaires une seule fois au démarrage.
 * Après validation initiale, l'application ne demande plus rien.
 *
 * Permissions gérées :
 *  - GPS (foreground)
 *  - GPS arrière-plan (background location)
 *  - Caméra (reconnaissance faciale)
 *  - Notifications push
 *  - Optimisation batterie Android (exclusion)
 */

import * as Location from 'expo-location';
import * as Camera from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';

const PERMISSIONS_DONE_KEY  = 'permissions_initialized_v2';
const PERMISSIONS_STATE_KEY = 'permissions_state_v2';

/**
 * Résumé des permissions accordées
 * @typedef {Object} PermissionsState
 * @property {boolean} location          - GPS foreground
 * @property {boolean} locationBackground - GPS arrière-plan
 * @property {boolean} camera            - Caméra
 * @property {boolean} notifications     - Notifications
 * @property {boolean} batteryOptimization - Exclusion batterie
 * @property {string}  requestedAt       - ISO date de la demande
 */

/**
 * Vérifier si les permissions ont déjà été demandées (premier lancement)
 */
export async function hasPermissionsBeenRequested() {
  const val = await AsyncStorage.getItem(PERMISSIONS_DONE_KEY);
  return val === 'true';
}

/**
 * Récupérer l'état sauvegardé des permissions
 * @returns {PermissionsState|null}
 */
export async function getSavedPermissionsState() {
  try {
    const raw = await AsyncStorage.getItem(PERMISSIONS_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Vérifier le statut actuel de toutes les permissions (sans demander)
 * @returns {PermissionsState}
 */
export async function checkPermissionsStatus() {
  const [locFg, locBg, cam, notif] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => ({ status: 'denied' })),
    Location.getBackgroundPermissionsAsync().catch(() => ({ status: 'denied' })),
    Camera.getCameraPermissionsAsync().catch(() => ({ status: 'denied' })),
    Notifications.getPermissionsAsync().catch(() => ({ status: 'denied' })),
  ]);

  return {
    location:             locFg.status === 'granted',
    locationBackground:   locBg.status === 'granted',
    camera:               cam.status === 'granted',
    notifications:        notif.status === 'granted',
    batteryOptimization:  true, // pas d'API de vérification standard
  };
}

/**
 * Demander toutes les permissions nécessaires (flow complet)
 * Appelé UNE SEULE FOIS au premier lancement.
 *
 * @param {function} onProgress - Callback (step, total, label) pour afficher la progression
 * @returns {PermissionsState}
 */
export async function requestAllPermissions(onProgress) {
  const state = {
    location: false,
    locationBackground: false,
    camera: false,
    notifications: false,
    batteryOptimization: false,
    requestedAt: new Date().toISOString(),
  };

  const notify = (stepIndex, key, status) => {
    if (onProgress) onProgress(stepIndex, key, status);
  };

  try {
    // ─── 1. GPS Foreground ────────────────────────────────────────────
    notify(0, 'location', 'pending');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      state.location = status === 'granted';
      notify(0, 'location', status);
    } catch (e) {
      console.warn('⚠️ GPS foreground:', e.message);
      notify(0, 'location', 'denied');
    }

    // ─── 2. GPS Arrière-plan ──────────────────────────────────────────
    notify(1, 'locationBackground', 'pending');
    if (state.location) {
      try {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        state.locationBackground = status === 'granted';
        if (!state.locationBackground) {
          // Sur Android 11+ : ouvrir les paramètres si refusé
          if (Platform.OS === 'android') {
            await new Promise((resolve) => {
              Alert.alert(
                '📍 Localisation en arrière-plan',
                'Pour que le suivi GPS fonctionne quand l\'écran est verrouillé, activez "Toujours autoriser" dans les paramètres.',
                [
                  {
                    text: 'Paramètres',
                    onPress: () => {
                      if (IntentLauncher?.startActivityAsync) {
                        IntentLauncher.startActivityAsync(
                          IntentLauncher.ActionActivity?.APPLICATION_DETAILS_SETTINGS
                        ).catch(() => Linking.openSettings()).finally(resolve);
                      } else {
                        Linking.openSettings().finally(resolve);
                      }
                    }
                  },
                  { text: 'Plus tard', style: 'cancel', onPress: resolve },
                ],
                { cancelable: false }
              );
            });
            // Re-check après retour des paramètres
            const { status: s2 } = await Location.getBackgroundPermissionsAsync();
            state.locationBackground = s2 === 'granted';
          }
        }
        notify(1, 'locationBackground', state.locationBackground ? 'granted' : 'denied');
      } catch (e) {
        console.warn('⚠️ GPS background:', e.message);
        notify(1, 'locationBackground', 'denied');
      }
    } else {
      notify(1, 'locationBackground', 'denied');
    }

    // ─── 3. Caméra ────────────────────────────────────────────────────
    notify(2, 'camera', 'pending');
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      state.camera = status === 'granted';
      notify(2, 'camera', status);
    } catch (e) {
      console.warn('⚠️ Caméra:', e.message);
      notify(2, 'camera', 'denied');
    }

    // ─── 4. Notifications ─────────────────────────────────────────────
    notify(3, 'notifications', 'pending');
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
        android: {},
      });
      state.notifications = status === 'granted';
      notify(3, 'notifications', status);
    } catch (e) {
      console.warn('⚠️ Notifications:', e.message);
      notify(3, 'notifications', 'denied');
    }

    // ─── 5. Optimisation batterie Android ─────────────────────────────
    notify(4, 'batteryOptimization', 'pending');
    if (Platform.OS === 'android') {
      try {
        // Demander l'exclusion de l'optimisation batterie
        if (IntentLauncher?.startActivityAsync) {
          await new Promise((resolve) => {
            Alert.alert(
              '⚡ Fonctionnement en arrière-plan',
              'Pour que le suivi GPS fonctionne en permanence, désactivez l\'optimisation batterie pour cette application.',
              [
                {
                  text: 'Désactiver',
                  onPress: () => {
                    IntentLauncher.startActivityAsync(
                      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
                      { data: 'package:com.securityguard.mobile' }
                    ).catch(() => Linking.openSettings()).finally(resolve);
                  }
                },
                { text: 'Plus tard', style: 'cancel', onPress: resolve },
              ]
            );
          });
        }
        state.batteryOptimization = true;
        notify(4, 'batteryOptimization', 'granted');
      } catch (e) {
        console.warn('⚠️ Batterie optim:', e.message);
        state.batteryOptimization = true; // Non bloquant
        notify(4, 'batteryOptimization', 'granted');
      }
    } else {
      state.batteryOptimization = true;
      notify(4, 'batteryOptimization', 'granted');
    }

  } catch (globalErr) {
    console.error('❌ Erreur demande permissions:', globalErr.message);
  }

  // ── Sauvegarder l'état ────────────────────────────────────────────────
  await AsyncStorage.setItem(PERMISSIONS_DONE_KEY, 'true');
  await AsyncStorage.setItem(PERMISSIONS_STATE_KEY, JSON.stringify(state));

  return state;
}

/**
 * Forcer la re-demande de permissions (debug / reset)
 */
export async function resetPermissions() {
  await AsyncStorage.removeItem(PERMISSIONS_DONE_KEY);
  await AsyncStorage.removeItem(PERMISSIONS_STATE_KEY);
}

/**
 * Ouvrir les paramètres de l'app pour correction manuelle
 */
export async function openAppSettings() {
  if (Platform.OS === 'android' && IntentLauncher?.startActivityAsync) {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActionActivity?.APPLICATION_DETAILS_SETTINGS ||
      'android.settings.APPLICATION_DETAILS_SETTINGS'
    ).catch(() => Linking.openSettings());
  } else {
    await Linking.openSettings();
  }
}
