/**
 * Gestionnaire d'effets sonores - Security Workforce Manager
 * Tous les sons de l'application avec fallback Web Audio API
 */

class SoundEffectsManager {
  constructor() {
    this.enabled = this.loadPreference('soundEffects_enabled', true);
    this.volume = this.loadPreference('soundEffects_volume', 0.7);
    this.sounds = {};
    this.initialized = false;
  }

  /**
   * Initialise tous les sons de l'application
   */
  initialize() {
    if (this.initialized) return;

    // Configuration des sons avec leurs chemins
    const soundFiles = {
      // Login & Authentification
      'login-start': '/sounds/login-start.wav',
      'login-success': '/sounds/login-success.wav',
      'login-error': '/sounds/login-error.wav',
      'logout': '/sounds/logout.wav',
      
      // Actions générales
      'success': '/sounds/success.wav',
      'error': '/sounds/error.wav',
      'warning': '/sounds/warning.wav',
      'notification': '/sounds/notification.wav',
      
      // Check-in/Check-out
      'check-in-success': '/sounds/check-in-success.wav',
      'check-out-success': '/sounds/check-out-success.wav',
      'late-warning': '/sounds/late-warning.wav',
      
      // Messages & Alertes
      'message': '/sounds/message.wav',
      'alert': '/sounds/alert.wav',
      'sos-alert': '/sounds/sos-alert.wav',
      'emergency': '/sounds/emergency.wav',
      
      // UI interactions
      'click': '/sounds/click.wav',
      'toggle': '/sounds/toggle.wav',
      'swipe': '/sounds/swipe.wav',
      
      // GPS & Tracking
      'gps-enabled': '/sounds/gps-enabled.wav',
      'location-ping': '/sounds/location-ping.wav',
      
      // Gamification
      'badge-earned': '/sounds/badge-earned.wav',
      'level-up': '/sounds/level-up.wav',
      
      // Événements
      'event-created': '/sounds/event-created.wav',
      'assignment-created': '/sounds/assignment-created.wav'
    };

    // Créer les objets Audio pour chaque son
    Object.keys(soundFiles).forEach(key => {
      try {
        this.sounds[key] = new Audio(soundFiles[key]);
        this.sounds[key].volume = this.volume;
        this.sounds[key].preload = 'auto';
        
        // Gérer les erreurs de chargement
        this.sounds[key].addEventListener('error', (e) => {
          console.warn(`Son "${key}" non disponible, utilisation du fallback`);
          // Fallback: générer un son avec Web Audio API
          this.sounds[key] = null;
        });
      } catch (error) {
        console.warn(`Impossible de charger le son "${key}":`, error);
        this.sounds[key] = null;
      }
    });

    this.initialized = true;
    console.log('🎵 Sound Effects Manager initialisé avec', Object.keys(this.sounds).length, 'sons');
  }

  /**
   * Joue un son par son nom
   * @param {string} soundName - Nom du son à jouer
   */
  play(soundName) {
    if (!this.enabled) return;
    if (!this.initialized) this.initialize();

    const sound = this.sounds[soundName];
    
    if (sound) {
      // Réinitialiser le son s'il est déjà en cours
      sound.currentTime = 0;
      sound.volume = this.volume;
      
      const playPromise = sound.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Erreur lecture son "${soundName}":`, error.message);
          // Fallback: tenter de générer le son
          this.playFallbackSound(soundName);
        });
      }
    } else {
      // Son non chargé, utiliser fallback
      this.playFallbackSound(soundName);
    }
  }

  /**
   * Génère un son de fallback avec Web Audio API
   * @param {string} soundName - Type de son
   */
  playFallbackSound(soundName) {
    if (!window.AudioContext && !window.webkitAudioContext) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configuration selon le type de son
    const soundConfigs = {
      'login-start': { freq: [392, 523, 659], duration: 0.15 },
      'login-success': { freq: [523, 659, 784], duration: 0.4 },
      'login-error': { freq: [440, 370], duration: 0.15 },
      'logout': { freq: [659, 523, 392], duration: 0.2 },
      'success': { freq: [523, 659], duration: 0.2 },
      'error': { freq: [200, 150], duration: 0.15 },
      'notification': { freq: [800, 1000], duration: 0.1 },
      'click': { freq: [1000], duration: 0.05 }
    };

    const config = soundConfigs[soundName] || { freq: [440], duration: 0.1 };
    
    oscillator.frequency.value = config.freq[0];
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(this.volume * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + config.duration);
  }

  /**
   * Active ou désactive les sons
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.savePreference('soundEffects_enabled', enabled);
  }

  /**
   * Définit le volume global (0.0 à 1.0)
   * @param {number} volume
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.savePreference('soundEffects_volume', this.volume);
    
    // Mettre à jour le volume de tous les sons
    Object.values(this.sounds).forEach(sound => {
      if (sound) sound.volume = this.volume;
    });
  }

  /**
   * Toggle activation des sons
   */
  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Obtenir l'état actuel
   */
  getState() {
    return {
      enabled: this.enabled,
      volume: this.volume,
      soundsLoaded: Object.keys(this.sounds).length
    };
  }

  /**
   * Tester tous les sons
   */
  test() {
    const soundNames = Object.keys(this.sounds);
    let index = 0;

    const playNext = () => {
      if (index < soundNames.length) {
        console.log(`🎵 Test: ${soundNames[index]}`);
        this.play(soundNames[index]);
        index++;
        setTimeout(playNext, 1000);
      } else {
        console.log('✅ Test terminé');
      }
    };

    playNext();
  }

  // Méthodes convenience pour les sons principaux

  playLoginStart() {
    this.play('login-start');
  }

  playLoginSuccess() {
    this.play('login-success');
  }

  playLoginError() {
    this.play('login-error');
  }

  playLogout() {
    this.play('logout');
  }

  playSuccess() {
    this.play('success');
  }

  playError() {
    this.play('error');
  }

  playWarning() {
    this.play('warning');
  }

  playNotification() {
    this.play('notification');
  }

  playCheckIn() {
    this.play('check-in-success');
  }

  playCheckOut() {
    this.play('check-out-success');
  }

  playLateWarning() {
    this.play('late-warning');
  }

  playMessage() {
    this.play('message');
  }

  playAlert() {
    this.play('alert');
  }

  playSOS() {
    this.play('sos-alert');
  }

  playEmergency() {
    this.play('emergency');
  }

  playClick() {
    this.play('click');
  }

  playToggle() {
    this.play('toggle');
  }

  playSwipe() {
    this.play('swipe');
  }

  playGPSEnabled() {
    this.play('gps-enabled');
  }

  playLocationPing() {
    this.play('location-ping');
  }

  playBadgeEarned() {
    this.play('badge-earned');
  }

  playLevelUp() {
    this.play('level-up');
  }

  playEventCreated() {
    this.play('event-created');
  }

  playAssignmentCreated() {
    this.play('assignment-created');
  }

  // Helpers localStorage
  savePreference(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Impossible de sauvegarder la préférence:', error);
    }
  }

  loadPreference(key, defaultValue) {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }
}

// Créer une instance singleton
const soundEffects = new SoundEffectsManager();

// Initialiser au chargement de la page
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    soundEffects.initialize();
  });
  
  // Rendre disponible globalement pour les tests
  window.soundEffects = soundEffects;
}

export default soundEffects;
