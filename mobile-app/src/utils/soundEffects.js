/**
 * Service de gestion des effets sonores pour React Native
 * Équivalent du soundEffects web pour mobile
 * 
 * REMARQUE: Pour activer les sons réels, installez expo-av:
 * npm install expo-av
 * 
 * Puis décommentez les imports et utilisez Audio.Sound.createAsync()
 */

// import { Audio } from 'expo-av';

class SoundEffects {
  constructor() {
    this.initialized = false;
    this.sounds = {};
  }

  /**
   * Initialiser le service audio
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔊 Sound effects initialized (placeholder mode)');
      // Pour activer les sons réels avec expo-av:
      // await Audio.setAudioModeAsync({
      //   playsInSilentModeIOS: true,
      //   staysActiveInBackground: false,
      // });
      
      this.initialized = true;
    } catch (error) {
      console.error('Erreur initialisation audio:', error);
    }
  }

  /**
   * Jouer le son de démarrage de connexion
   */
  playLoginStart() {
    console.log('🎵 Sound: Login Start');
    // Pour sons réels:
    // this.playSound('loginStart', require('../../assets/sounds/login-start.mp3'));
  }

  /**
   * Jouer le son de connexion réussie
   */
  playLoginSuccess() {
    console.log('✅ Sound: Login Success');
    // Pour sons réels:
    // this.playSound('loginSuccess', require('../../assets/sounds/success.mp3'));
  }

  /**
   * Jouer le son d'erreur de connexion
   */
  playLoginError() {
    console.log('❌ Sound: Login Error');
    // Pour sons réels:
    // this.playSound('loginError', require('../../assets/sounds/error.mp3'));
  }

  /**
   * Jouer le son de capture photo
   */
  playCameraShutter() {
    console.log('📸 Sound: Camera Shutter');
    // Pour sons réels:
    // this.playSound('shutter', require('../../assets/sounds/shutter.mp3'));
  }

  /**
   * Jouer le son de validation
   */
  playValidation() {
    console.log('✔️ Sound: Validation');
    // Pour sons réels:
    // this.playSound('validation', require('../../assets/sounds/validation.mp3'));
  }

  /**
   * Méthode générique pour jouer un son
   */
  async playSound(key, source) {
    try {
      // Si le son existe déjà, le décharger d'abord
      if (this.sounds[key]) {
        await this.sounds[key].unloadAsync();
      }

      // Pour activer avec expo-av:
      // const { sound } = await Audio.Sound.createAsync(source);
      // this.sounds[key] = sound;
      // await sound.playAsync();
      
      console.log(`🎵 Playing sound: ${key}`);
    } catch (error) {
      console.error(`Erreur lecture son ${key}:`, error);
    }
  }

  /**
   * Décharger tous les sons
   */
  async cleanup() {
    try {
      for (const key in this.sounds) {
        if (this.sounds[key]) {
          await this.sounds[key].unloadAsync();
        }
      }
      this.sounds = {};
      console.log('🔊 Sound effects cleaned up');
    } catch (error) {
      console.error('Erreur cleanup audio:', error);
    }
  }
}

// Export singleton
export default new SoundEffects();
