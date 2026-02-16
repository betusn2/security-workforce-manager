const fs = require('fs');
const path = require('path');

/**
 * Générateur de sons pour Login et Déconnexion
 * Crée des fichiers audio WAV optimisés
 */

// Note: Ce script génère des fichiers WAV bruts
// Utilisez FFmpeg pour convertir en MP3: ffmpeg -i login.wav -b:a 128k login.mp3

class AudioGenerator {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
  }

  /**
   * Crée un buffer audio
   */
  createBuffer(duration) {
    return new Float32Array(Math.floor(this.sampleRate * duration));
  }

  /**
   * Génère une onde sinusoïdale
   */
  generateSine(frequency, duration, amplitude = 0.3) {
    const buffer = this.createBuffer(duration);
    for (let i = 0; i < buffer.length; i++) {
      const time = i / this.sampleRate;
      buffer[i] = Math.sin(2 * Math.PI * frequency * time) * amplitude;
    }
    return buffer;
  }

  /**
   * Applique une enveloppe ADSR
   */
  applyEnvelope(buffer, attack, decay, sustain, release) {
    const attackSamples = Math.floor(this.sampleRate * attack);
    const decaySamples = Math.floor(this.sampleRate * decay);
    const releaseSamples = Math.floor(this.sampleRate * release);
    const sustainStart = attackSamples + decaySamples;
    const releaseStart = buffer.length - releaseSamples;

    for (let i = 0; i < buffer.length; i++) {
      let envelope = 1;

      // Attack
      if (i < attackSamples) {
        envelope = i / attackSamples;
      }
      // Decay
      else if (i < sustainStart) {
        const decayProgress = (i - attackSamples) / decaySamples;
        envelope = 1 - (decayProgress * (1 - sustain));
      }
      // Sustain
      else if (i < releaseStart) {
        envelope = sustain;
      }
      // Release
      else {
        const releaseProgress = (i - releaseStart) / releaseSamples;
        envelope = sustain * (1 - releaseProgress);
      }

      buffer[i] *= envelope;
    }

    return buffer;
  }

  /**
   * Mélange plusieurs buffers
   */
  mixBuffers(...buffers) {
    const maxLength = Math.max(...buffers.map(b => b.length));
    const mixed = new Float32Array(maxLength);

    for (let i = 0; i < maxLength; i++) {
      let sum = 0;
      let count = 0;
      for (const buffer of buffers) {
        if (i < buffer.length) {
          sum += buffer[i];
          count++;
        }
      }
      mixed[i] = count > 0 ? sum / count : 0;
    }

    return mixed;
  }

  /**
   * Génère un son de LOGIN (montée optimiste)
   * Notes: G4 (392 Hz) -> C5 (523 Hz) -> E5 (659 Hz)
   */
  generateLoginSound() {
    console.log('🎵 Génération du son de LOGIN...');

    // Note 1: G4 (sol)
    const note1 = this.generateSine(392, 0.15, 0.25);
    this.applyEnvelope(note1, 0.01, 0.05, 0.7, 0.09);

    // Note 2: C5 (do)
    const note2 = this.generateSine(523, 0.15, 0.25);
    this.applyEnvelope(note2, 0.01, 0.05, 0.7, 0.09);

    // Note 3: E5 (mi) - plus long
    const note3 = this.generateSine(659, 0.25, 0.3);
    this.applyEnvelope(note3, 0.01, 0.08, 0.6, 0.16);

    // Concaténer les notes
    const totalLength = note1.length + note2.length + note3.length;
    const buffer = new Float32Array(totalLength);
    
    buffer.set(note1, 0);
    buffer.set(note2, note1.length);
    buffer.set(note3, note1.length + note2.length);

    return buffer;
  }

  /**
   * Génère un son de LOGOUT (descente douce)
   * Notes: E5 (659 Hz) -> C5 (523 Hz) -> G4 (392 Hz)
   */
  generateLogoutSound() {
    console.log('🎵 Génération du son de LOGOUT...');

    // Note 1: E5 (mi)
    const note1 = this.generateSine(659, 0.15, 0.25);
    this.applyEnvelope(note1, 0.01, 0.05, 0.7, 0.09);

    // Note 2: C5 (do)
    const note2 = this.generateSine(523, 0.15, 0.25);
    this.applyEnvelope(note2, 0.01, 0.05, 0.7, 0.09);

    // Note 3: G4 (sol) - fade out long
    const note3 = this.generateSine(392, 0.3, 0.25);
    this.applyEnvelope(note3, 0.01, 0.05, 0.6, 0.24);

    // Concaténer les notes
    const totalLength = note1.length + note2.length + note3.length;
    const buffer = new Float32Array(totalLength);
    
    buffer.set(note1, 0);
    buffer.set(note2, note1.length);
    buffer.set(note3, note1.length + note2.length);

    return buffer;
  }

  /**
   * Génère un son de LOGIN SUCCESS (cloche joyeuse)
   * Accord majeur avec harmoniques
   */
  generateLoginSuccessSound() {
    console.log('🎵 Génération du son de LOGIN SUCCESS...');

    // Accord C major (do majeur): C5 + E5 + G5
    const c5 = this.generateSine(523, 0.4, 0.2);  // Do
    const e5 = this.generateSine(659, 0.4, 0.15); // Mi
    const g5 = this.generateSine(784, 0.4, 0.12); // Sol

    this.applyEnvelope(c5, 0.01, 0.1, 0.5, 0.29);
    this.applyEnvelope(e5, 0.01, 0.1, 0.5, 0.29);
    this.applyEnvelope(g5, 0.01, 0.1, 0.5, 0.29);

    // Mélanger l'accord
    const chord = this.mixBuffers(c5, e5, g5);

    return chord;
  }

  /**
   * Génère un son de LOGIN ERROR (erreur)
   */
  generateLoginErrorSound() {
    console.log('🎵 Génération du son de LOGIN ERROR...');

    // Note dissonante descendante
    const note1 = this.generateSine(440, 0.12, 0.3); // La
    const note2 = this.generateSine(370, 0.18, 0.25); // F#- (dissonant)

    this.applyEnvelope(note1, 0.01, 0.04, 0.6, 0.07);
    this.applyEnvelope(note2, 0.01, 0.06, 0.5, 0.11);

    const totalLength = note1.length + note2.length;
    const buffer = new Float32Array(totalLength);
    
    buffer.set(note1, 0);
    buffer.set(note2, note1.length);

    return buffer;
  }

  /**
   * Écrit un buffer en fichier WAV
   */
  writeWAV(buffer, filename) {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = this.sampleRate * blockAlign;
    const dataSize = buffer.length * bytesPerSample;
    const fileSize = 44 + dataSize;

    // Créer le buffer WAV
    const wav = Buffer.alloc(fileSize);
    let offset = 0;

    // RIFF header
    wav.write('RIFF', offset); offset += 4;
    wav.writeUInt32LE(fileSize - 8, offset); offset += 4;
    wav.write('WAVE', offset); offset += 4;

    // fmt chunk
    wav.write('fmt ', offset); offset += 4;
    wav.writeUInt32LE(16, offset); offset += 4; // chunk size
    wav.writeUInt16LE(1, offset); offset += 2;  // audio format (PCM)
    wav.writeUInt16LE(numChannels, offset); offset += 2;
    wav.writeUInt32LE(this.sampleRate, offset); offset += 4;
    wav.writeUInt32LE(byteRate, offset); offset += 4;
    wav.writeUInt16LE(blockAlign, offset); offset += 2;
    wav.writeUInt16LE(bytesPerSample * 8, offset); offset += 2;

    // data chunk
    wav.write('data', offset); offset += 4;
    wav.writeUInt32LE(dataSize, offset); offset += 4;

    // Write audio samples
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      const int16 = Math.floor(sample * 32767);
      wav.writeInt16LE(int16, offset);
      offset += 2;
    }

    // Écrire le fichier
    const outputPath = path.join(__dirname, filename);
    fs.writeFileSync(outputPath, wav);
    
    console.log(`✅ Fichier créé: ${filename} (${(fileSize / 1024).toFixed(1)} KB)`);
    console.log(`   Durée: ${(buffer.length / this.sampleRate).toFixed(2)}s`);
  }
}

// Générer tous les sons
console.log('═'.repeat(80));
console.log('🎵 GÉNÉRATEUR DE SONS - LOGIN & LOGOUT');
console.log('═'.repeat(80));
console.log('\n');

const generator = new AudioGenerator();

// Générer les sons
const loginSound = generator.generateLoginSound();
const logoutSound = generator.generateLogoutSound();
const loginSuccessSound = generator.generateLoginSuccessSound();
const loginErrorSound = generator.generateLoginErrorSound();

// Sauvegarder en WAV
generator.writeWAV(loginSound, 'login-start.wav');
generator.writeWAV(logoutSound, 'logout.wav');
generator.writeWAV(loginSuccessSound, 'login-success.wav');
generator.writeWAV(loginErrorSound, 'login-error.wav');

console.log('\n');
console.log('═'.repeat(80));
console.log('✅ GÉNÉRATION TERMINÉE');
console.log('═'.repeat(80));
console.log('\n📁 Fichiers créés:');
console.log('   - login-start.wav    → Son au clic sur "Se connecter"');
console.log('   - login-success.wav  → Son quand authentification réussie');
console.log('   - login-error.wav    → Son quand mot de passe incorrect');
console.log('   - logout.wav         → Son lors de la déconnexion');

console.log('\n🔧 CONVERSION EN MP3 (avec FFmpeg):');
console.log('   ffmpeg -i login-start.wav -b:a 128k login-start.mp3');
console.log('   ffmpeg -i login-success.wav -b:a 128k login-success.mp3');
console.log('   ffmpeg -i login-error.wav -b:a 128k login-error.mp3');
console.log('   ffmpeg -i logout.wav -b:a 128k logout.mp3');

console.log('\n📦 PLACEMENT DANS LE PROJET:');
console.log('   Copier les fichiers MP3 dans: frontend/public/sounds/');

console.log('\n💻 INTÉGRATION DANS Login.jsx:');
console.log(`
import soundEffects from '../utils/soundEffects';

// Au clic sur bouton login
const handleLoginClick = () => {
  soundEffects.play('login-start');
};

// Après authentification réussie
const onLoginSuccess = () => {
  soundEffects.playLoginSuccess();
  navigate('/dashboard');
};

// En cas d'erreur
const onLoginError = () => {
  soundEffects.playLoginError();
};

// Au logout (dans Header/Navbar)
const handleLogout = () => {
  soundEffects.playLogout();
  // ... reste du code logout
};
`);

console.log('═'.repeat(80));
console.log('🎉 Prêt à utiliser!');
console.log('═'.repeat(80));
