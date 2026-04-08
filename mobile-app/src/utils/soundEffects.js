/**
 * 🔊 SERVICE EFFETS SONORES / HAPTIQUES
 * ======================================
 * Retours haptiques professionnels via expo-haptics + Vibration.
 * Chaque action de l'app a son propre motif de vibration distinctif.
 *
 * Événements couverts :
 *  - Connexion (start / succès / erreur)
 *  - Déconnexion
 *  - Check-in / Check-out
 *  - Obturateur caméra (reconnaissance faciale)
 *  - Validation / Rejet
 *  - Alerte urgente
 *  - Nouveau message superviseur
 *  - Incident signalé
 *  - Navigation / Sélection
 */

import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';

// ─── Motifs de vibration Android (ms) ─────────────────────────────────────────
// Format: [silence, vibration, silence, vibration, ...]
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
  message:       [0, 40, 60, 40],
  incident:      [0, 150, 80, 150, 80, 300],
  selection:     [0, 20],
  buttonPress:   [0, 25],
};

class SoundEffects {
  constructor() {
    this.initialized = false;
    this.enabled = true;
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  // Wrapper interne : haptic iOS + vibration Android
  async _play(pattern, hapticsType = 'impact', hapticsStyle = Haptics.ImpactFeedbackStyle.Medium) {
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
        // Android: motif de vibration personnalisé
        Vibration.vibrate(pattern);
      }
    } catch (_) {}
  }

  // ─── Connexion ────────────────────────────────────────────────────────────
  async playLoginStart() {
    await this._play(PATTERNS.loginStart, 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  async playLoginSuccess() {
    await this._play(
      PATTERNS.loginSuccess,
      'notification',
      Haptics.NotificationFeedbackType.Success,
    );
  }

  async playLoginError() {
    await this._play(
      PATTERNS.loginError,
      'notification',
      Haptics.NotificationFeedbackType.Error,
    );
  }

  async playLogout() {
    await this._play(PATTERNS.logout, 'impact', Haptics.ImpactFeedbackStyle.Medium);
  }

  // ─── Check-in / Check-out ─────────────────────────────────────────────────
  async playCheckIn() {
    await this._play(
      PATTERNS.checkIn,
      'notification',
      Haptics.NotificationFeedbackType.Success,
    );
  }

  async playCheckOut() {
    await this._play(PATTERNS.checkOut, 'impact', Haptics.ImpactFeedbackStyle.Heavy);
  }

  // ─── Caméra ───────────────────────────────────────────────────────────────
  async playCameraShutter() {
    await this._play(PATTERNS.cameraShutter, 'impact', Haptics.ImpactFeedbackStyle.Heavy);
  }

  // ─── Validation / Rejet ──────────────────────────────────────────────────────
  async playValidation() {
    await this._play(
      PATTERNS.validation,
      'notification',
      Haptics.NotificationFeedbackType.Success,
    );
  }

  async playRejection() {
    await this._play(
      PATTERNS.rejection,
      'notification',
      Haptics.NotificationFeedbackType.Error,
    );
  }

  // ─── Alertes ──────────────────────────────────────────────────────────────
  async playAlert() {
    await this._play(
      PATTERNS.alert,
      'notification',
      Haptics.NotificationFeedbackType.Warning,
    );
  }

  async playUrgentAlert() {
    // Double alerte pour urgences critiques
    await this._play(PATTERNS.alert, 'notification', Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => this._play(PATTERNS.alert, 'notification', Haptics.NotificationFeedbackType.Warning), 700);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────
  async playMessage() {
    await this._play(PATTERNS.message, 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  // ─── Incident ─────────────────────────────────────────────────────────────
  async playIncident() {
    await this._play(
      PATTERNS.incident,
      'notification',
      Haptics.NotificationFeedbackType.Warning,
    );
  }

  // ─── Navigation / UI ─────────────────────────────────────────────────────
  async playSelection() {
    await this._play(PATTERNS.selection, 'selection');
  }

  async playButtonPress() {
    await this._play(PATTERNS.buttonPress, 'impact', Haptics.ImpactFeedbackStyle.Light);
  }

  // Activer / désactiver les sons (paramètre utilisateur)
  setEnabled(val) {
    this.enabled = !!val;
  }

  async cleanup() {}
}

export default new SoundEffects();
