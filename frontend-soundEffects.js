// Sound Effects Manager for Security Workforce Manager
// Add this file to: frontend/src/utils/soundEffects.js

class SoundEffectsManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.5;
    this.initialized = false;
    
    // Load sound preferences from localStorage
    this.loadPreferences();
    
    // Initialize sounds
    this.initializeSounds();
  }

  loadPreferences() {
    try {
      const savedEnabled = localStorage.getItem('soundEffects_enabled');
      const savedVolume = localStorage.getItem('soundEffects_volume');
      
      this.enabled = savedEnabled !== null ? savedEnabled === 'true' : true;
      this.volume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;
    } catch (error) {
      console.warn('Could not load sound preferences:', error);
    }
  }

  savePreferences() {
    try {
      localStorage.setItem('soundEffects_enabled', this.enabled.toString());
      localStorage.setItem('soundEffects_volume', this.volume.toString());
    } catch (error) {
      console.warn('Could not save sound preferences:', error);
    }
  }

  initializeSounds() {
    // Sound URLs - Using free notification sounds from various sources
    // Replace these URLs with your own hosted sound files
    this.soundUrls = {
      // Success & Confirmation
      success: '/sounds/success.mp3',
      checkInSuccess: '/sounds/check-in-success.mp3',
      checkOutSuccess: '/sounds/check-out-success.mp3',
      assignmentCreated: '/sounds/assignment-created.mp3',
      eventCreated: '/sounds/event-created.mp3',
      
      // Notifications
      notification: '/sounds/notification.mp3',
      messageReceived: '/sounds/message.mp3',
      alertReceived: '/sounds/alert.mp3',
      
      // Warnings & Errors
      warning: '/sounds/warning.mp3',
      error: '/sounds/error.mp3',
      late: '/sounds/late-warning.mp3',
      
      // Emergency
      sos: '/sounds/sos-alert.mp3',
      emergency: '/sounds/emergency.mp3',
      
      // UI Interactions
      click: '/sounds/click.mp3',
      toggle: '/sounds/toggle.mp3',
      swipe: '/sounds/swipe.mp3',
      
      // GPS & Tracking
      gpsEnabled: '/sounds/gps-enabled.mp3',
      locationUpdate: '/sounds/location-ping.mp3',
      
      // Badges & Achievements
      badgeEarned: '/sounds/badge-earned.mp3',
      levelUp: '/sounds/level-up.mp3',
    };

    // Pre-load all sounds
    this.preloadSounds();
    this.initialized = true;
  }

  preloadSounds() {
    Object.keys(this.soundUrls).forEach(key => {
      try {
        const audio = new Audio(this.soundUrls[key]);
        audio.volume = this.volume;
        audio.preload = 'auto';
        
        // Handle load errors gracefully
        audio.addEventListener('error', () => {
          console.warn(`Could not load sound: ${key}`);
        });
        
        this.sounds[key] = audio;
      } catch (error) {
        console.warn(`Error preloading sound ${key}:`, error);
      }
    });
  }

  play(soundName) {
    if (!this.enabled || !this.initialized) {
      return;
    }

    const sound = this.sounds[soundName];
    if (!sound) {
      console.warn(`Sound not found: ${soundName}`);
      return;
    }

    try {
      // Clone the audio to allow multiple simultaneous plays
      const soundClone = sound.cloneNode();
      soundClone.volume = this.volume;
      
      soundClone.play().catch(error => {
        // Handle autoplay restrictions
        if (error.name === 'NotAllowedError') {
          console.warn('Sound autoplay blocked by browser. User interaction required.');
        } else {
          console.warn(`Error playing sound ${soundName}:`, error);
        }
      });
    } catch (error) {
      console.warn(`Error playing sound ${soundName}:`, error);
    }
  }

  // Specific sound effect methods
  playSuccess() {
    this.play('success');
  }

  playCheckIn() {
    this.play('checkInSuccess');
  }

  playCheckOut() {
    this.play('checkOutSuccess');
  }

  playNotification() {
    this.play('notification');
  }

  playMessage() {
    this.play('messageReceived');
  }

  playAlert() {
    this.play('alertReceived');
  }

  playWarning() {
    this.play('warning');
  }

  playError() {
    this.play('error');
  }

  playSOS() {
    this.play('sos');
  }

  playEmergency() {
    this.play('emergency');
  }

  playBadgeEarned() {
    this.play('badgeEarned');
  }

  playGPSEnabled() {
    this.play('gpsEnabled');
  }

  playLocationUpdate() {
    this.play('locationUpdate');
  }

  playClick() {
    this.play('click');
  }

  // Settings
  setEnabled(enabled) {
    this.enabled = enabled;
    this.savePreferences();
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    
    // Update volume for all loaded sounds
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
    });
    
    this.savePreferences();
  }

  isEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // Test a specific sound
  test(soundName) {
    const wasEnabled = this.enabled;
    this.enabled = true;
    this.play(soundName);
    this.enabled = wasEnabled;
  }
}

// Create singleton instance
const soundEffects = new SoundEffectsManager();

// Export for use in other modules
export default soundEffects;

// Also export class for testing
export { SoundEffectsManager };
