/**
 * 🔊 SERVICE EFFETS SONORES + HAPTIQUES — PRODUCTION GRADE
 * =========================================================
 * Audio RÉEL (expo-av) + haptiques simultanés (expo-haptics).
 * Design inspiré des standards inDrive / Uber / Grab.
 *
 * Architecture :
 *  - Sons WAV chargés à l'initialisation (préalloués)
 *  - Audio + haptique jouent SIMULTANÉMENT
 *  - Mode silencieux respecté (volume = 0 si silencieux)
 *  - Pool de sons pour éviter les conflits (superposition)
 *  - Paramètre global "enabled" (bouton son dans Settings)
 *
 * Sons couverts (16 fichiers WAV) :
 *  - login_start, login_success, login_error
 *  - checkin, checkout, patrol_checkin
 *  - camera_shutter
 *  - alert, alert_critical, geofence_exit
 *  - message, notification, incident
 *  - button_press, selection, battery_low
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Fichiers son ─────────────────────────────────────────────────────────────
const SOUND_FILES = {
  loginStart:    require('../../assets/sounds/login_start.wav'),
  loginSuccess:  require('../../assets/sounds/login_success.wav'),
  loginError:    require('../../assets/sounds/login_error.wav'),
  logout:        require('../../assets/sounds/checkout.wav'),
  checkIn:       require('../../assets/sounds/checkin.wav'),
  checkOut:      require('../../assets/sounds/checkout.wav'),
  patrolCheckIn: require('../../assets/sounds/patrol_checkin.wav'),
  cameraShutter: require('../../assets/sounds/camera_shutter.wav'),
  alert:         require('../../assets/sounds/alert.wav'),
  alertCritical: require('../../assets/sounds/alert_critical.wav'),
  message:       require('../../assets/sounds/message.wav'),
  notification:  require('../../assets/sounds/notification.wav'),
  incident:      require('../../assets/sounds/incident.wav'),
  buttonPress:   require('../../assets/sounds/button_press.wav'),
  selection:     require('../../assets/sounds/selection.wav'),
  batteryLow:    require('../../assets/sounds/battery_low.wav'),
  geofenceExit:  require('../../assets/sounds/geofence_exit.wav'),
};

// ─── Motifs de vibration Android (ms) ─────────────────────────────────────────
const PATTERNS = {
  loginStart:    [0, 30],
  loginSuccess:  [0, 40, 80, 80],
  loginError:    [0, 80, 60, 80, 60, 80],
  logout:        [0, 60, 80, 30],
  checkIn:       [0, 50, 60, 100, 60, 150],
  checkOut:      [0, 100, 60, 50],
  cameraShutter: [0, 20],
  validation:    [0, 50, 50, 50],
  rejection:     [0, 120, 80, 120],
  alert:         [0, 200, 100, 200, 100, 400],
  alertCritical: [0, 300, 80, 300, 80, 300, 80, 600],
  message:       [0, 40, 60, 40],
  incident:      [0, 150, 80, 150, 80, 300],
  selection:     [0, 20],
  buttonPress:   [0, 15],
  batteryLow:    [0, 80, 60, 120],
  geofenceExit:  [0, 200, 100, 200, 100, 400],
};

const SETTINGS_KEY = 'soundEffects_enabled';

class SoundEffects {
  constructor() {
    this.initialized = false;
    this.enabled     = true;
    this._pool       = {};   // clé → { obj: Audio.Sound, busy: false }
  }

  // ─── Init (à appeler au démarrage de l'app) ──────────────────────────────
  async initialize() {
    if (this.initialized) return;

    // Lire le paramètre son sauvegardé
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved !== null) this.enabled = saved === 'true';
    } catch {}

    // Configurer le mode audio : lecture même en mode silencieux
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS:     false,  // respect du mode silencieux iOS
        allowsRecordingIOS:       false,
        staysActiveInBackground:  false,
        shouldDuckAndroid:        true,   // baisser la musique de fond
        playThroughEarpieceAndroid: false,
      });
    } catch {}

    // Précharger tous les sons
    await Promise.all(
      Object.entries(SOUND_FILES).map(async ([key, file]) => {
        try {
          const { sound } = await Audio.Sound.createAsync(file, {
            shouldPlay: false,
            volume: 1.0,
          });
          this._pool[key] = sound;
        } catch (e) {
          console.warn(`[SoundEffects] Impossible de charger ${key}:`, e.message);
        }
      })
    );

    this.initialized = true;
    console.log('🔊 SoundEffects initialisé —', Object.keys(this._pool).length, 'sons chargés');
  }

  // ─── Jouer un son (avec rejeu si déjà en cours) ──────────────────────────
  async _playSound(key) {
    if (!this.enabled) return;
    const sound = this._pool[key];
    if (!sound) return;
    try {
      // Ramener à 0 pour permettre le rejeu
      await sound.stopAsync().catch(() => {});
      await sound.setPositionAsync(0).catch(() => {});
      await sound.playAsync();
    } catch {}
  }

  // ─── Jouer haptique ──────────────────────────────────────────────────────
  async _haptic(key, hapticsType = 'impact', hapticsStyle = Haptics.ImpactFeedbackStyle.Medium) {
    if (!this.enabled) return;
    try {
      if (Platform.OS === 'ios') {
        if (hapticsType === 'notification') {
          await Haptics.notificationAsync(hapticsStyle);
        } else if (hapticsType === 'selection') {
          await Haptics.selectionAsync();
        } else {
          await Haptics.impactAsync(hapticsStyle);
        }
      } else {
        Vibration.vibrate(PATTERNS[key] || [0, 30]);
      }
    } catch {}
  }

  // ─── Jouer son + haptique simultanément ──────────────────────────────────
  async _play(soundKey, hapticsType = 'impact', hapticsStyle = Haptics.ImpactFeedbackStyle.Medium) {
    // Les deux partent en parallèle (comme inDrive)
    await Promise.all([
      this._playSound(soundKey),
      this._haptic(soundKey, hapticsType, hapticsStyle),
    ]);
  }

  // ─── Connexion ────────────────────────────────────────────────────────────
  async playLoginStart() {
    await this._play('loginStart', 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  async playLoginSuccess() {
    await this._play('loginSuccess', 'notification', Haptics.NotificationFeedbackType.Success);
  }

  async playLoginError() {
    await this._play('loginError', 'notification', Haptics.NotificationFeedbackType.Error);
  }

  async playLogout() {
    await this._play('logout', 'impact', Haptics.ImpactFeedbackStyle.Medium);
  }

  // ─── Check-in / Check-out ─────────────────────────────────────────────────
  async playCheckIn() {
    await this._play('checkIn', 'notification', Haptics.NotificationFeedbackType.Success);
  }

  async playCheckOut() {
    await this._play('checkOut', 'impact', Haptics.ImpactFeedbackStyle.Heavy);
  }

  async playPatrolCheckIn() {
    await this._play('patrolCheckIn', 'notification', Haptics.NotificationFeedbackType.Success);
  }

  // ─── Caméra ───────────────────────────────────────────────────────────────
  async playCameraShutter() {
    await this._play('cameraShutter', 'impact', Haptics.ImpactFeedbackStyle.Heavy);
  }

  // ─── Validation / Rejet ──────────────────────────────────────────────────
  async playValidation() {
    await this._play('checkIn', 'notification', Haptics.NotificationFeedbackType.Success);
  }

  async playRejection() {
    await this._play('loginError', 'notification', Haptics.NotificationFeedbackType.Error);
  }

  // ─── Alertes ──────────────────────────────────────────────────────────────
  async playAlert() {
    await this._play('alert', 'notification', Haptics.NotificationFeedbackType.Warning);
  }

  async playUrgentAlert() {
    await this._play('alertCritical', 'notification', Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => this._play('alertCritical', 'notification', Haptics.NotificationFeedbackType.Warning), 900);
  }

  async playGeofenceExit() {
    await this._play('geofenceExit', 'notification', Haptics.NotificationFeedbackType.Warning);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────
  async playMessage() {
    await this._play('message', 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  async playNotification() {
    await this._play('notification', 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  // ─── Incident ─────────────────────────────────────────────────────────────
  async playIncident() {
    await this._play('incident', 'notification', Haptics.NotificationFeedbackType.Warning);
  }

  // ─── Batterie ──────────────────────────────────────────────────────────────
  async playBatteryLow() {
    await this._play('batteryLow', 'notification', Haptics.NotificationFeedbackType.Warning);
  }

  // ─── Navigation / UI ─────────────────────────────────────────────────────
  async playSelection() {
    await this._play('selection', 'selection');
  }

  async playButtonPress() {
    await this._play('buttonPress', 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  // ─── Activer / Désactiver ─────────────────────────────────────────────────
  async setEnabled(val) {
    this.enabled = !!val;
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, val ? 'true' : 'false');
    } catch {}
  }

  // ─── Cleanup (à appeler au logout si nécessaire) ──────────────────────────
  async cleanup() {
    try {
      await Promise.all(
        Object.values(this._pool).map(s => s.unloadAsync().catch(() => {}))
      );
      this._pool = {};
      this.initialized = false;
    } catch {}
  }
}

export default new SoundEffects();
