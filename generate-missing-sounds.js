/**
 * Générateur de sons manquants - Security Workforce Manager
 * Crée tous les fichiers WAV requis par soundEffects.js
 */

const fs = require('fs');
const path = require('path');

// Configuration audio
const SAMPLE_RATE = 44100;
const CHANNELS = 1; // Mono
const BITS_PER_SAMPLE = 16;

/**
 * Génère un fichier WAV à partir de samples
 */
function writeWavFile(filename, samples, duration) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2);
  
  // Header WAV
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8, 28);
  buffer.writeUInt16LE(CHANNELS * BITS_PER_SAMPLE / 8, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  
  // Générer les samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const sample = samples(t, duration);
    const value = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.floor(value * 32767), 44 + i * 2);
  }
  
  fs.writeFileSync(filename, buffer);
  console.log(`✅ Créé: ${path.basename(filename)} (${(buffer.length / 1024).toFixed(1)} KB, ${duration.toFixed(2)}s)`);
}

/**
 * Fonctions génératrices pour différents types de sons
 */

// Son de succès: accord majeur ascendant
const success = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  return fade * (
    Math.sin(2 * Math.PI * 523.25 * t) * 0.3 + // C5
    Math.sin(2 * Math.PI * 659.25 * t) * 0.3 + // E5
    Math.sin(2 * Math.PI * 783.99 * t) * 0.4   // G5
  );
};

// Son d'erreur: notes dissonantes
const error = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  return fade * (
    Math.sin(2 * Math.PI * 233.08 * t) * 0.4 + // Bb3
    Math.sin(2 * Math.PI * 369.99 * t) * 0.3 + // F#4
    Math.sin(2 * Math.PI * 587.33 * t) * 0.3   // D5
  );
};

// Avertissement: oscillation rapide
const warning = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const freq = 440 + Math.sin(2 * Math.PI * 8 * t) * 110;
  return fade * Math.sin(2 * Math.PI * freq * t) * 0.5;
};

// Notification: deux notes courtes
const notification = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  if (t < dur * 0.4) {
    return fade * Math.sin(2 * Math.PI * 880 * t) * 0.4; // A5
  } else if (t < dur * 0.8) {
    return fade * Math.sin(2 * Math.PI * 1046.5 * t) * 0.4; // C6
  }
  return 0;
};

// Check-in succès: trois notes ascendantes
const checkInSuccess = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  if (t < dur * 0.33) {
    return fade * Math.sin(2 * Math.PI * 523.25 * t) * 0.4; // C5
  } else if (t < dur * 0.67) {
    return fade * Math.sin(2 * Math.PI * 659.25 * t) * 0.4; // E5
  } else {
    return fade * Math.sin(2 * Math.PI * 783.99 * t) * 0.5; // G5
  }
};

// Check-out succès: trois notes descendantes
const checkOutSuccess = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  if (t < dur * 0.33) {
    return fade * Math.sin(2 * Math.PI * 783.99 * t) * 0.5; // G5
  } else if (t < dur * 0.67) {
    return fade * Math.sin(2 * Math.PI * 659.25 * t) * 0.4; // E5
  } else {
    return fade * Math.sin(2 * Math.PI * 523.25 * t) * 0.4; // C5
  }
};

// Alerte retard: sirène courte
const lateWarning = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const freq = 440 + Math.sin(2 * Math.PI * 5 * t) * 220;
  return fade * Math.sin(2 * Math.PI * freq * t) * 0.6;
};

// Message: bulle sonore
const message = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  return fade * (
    Math.sin(2 * Math.PI * 800 * t) * 0.3 +
    Math.sin(2 * Math.PI * 1200 * t) * 0.2
  );
};

// Alerte: trois bips rapides
const alert = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const beep = Math.floor(t / (dur / 3)) % 2;
  return beep ? 0 : fade * Math.sin(2 * Math.PI * 1000 * t) * 0.5;
};

// SOS: pattern SOS en morse (... --- ...)
const sosAlert = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const unit = dur / 15;
  const phase = t / unit;
  
  // S: 3x short
  if (phase < 3) {
    return (phase % 1 < 0.5) ? fade * Math.sin(2 * Math.PI * 1200 * t) * 0.7 : 0;
  }
  // Gap
  if (phase < 4) return 0;
  // O: 3x long
  if (phase < 10) {
    return ((phase - 4) % 2 < 1.5) ? fade * Math.sin(2 * Math.PI * 1200 * t) * 0.7 : 0;
  }
  // Gap
  if (phase < 11) return 0;
  // S: 3x short
  if (phase < 14) {
    return ((phase - 11) % 1 < 0.5) ? fade * Math.sin(2 * Math.PI * 1200 * t) * 0.7 : 0;
  }
  return 0;
};

// Urgence: sirène forte
const emergency = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const freq = 600 + Math.sin(2 * Math.PI * 4 * t) * 400;
  return fade * Math.sin(2 * Math.PI * freq * t) * 0.8;
};

// Click: impulsion courte
const click = (t, dur) => {
  const fade = Math.max(0, 1 - t / (dur * 0.3));
  return fade * Math.sin(2 * Math.PI * 1500 * t) * 0.3;
};

// Toggle: deux notes rapides
const toggle = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  if (t < dur * 0.5) {
    return fade * Math.sin(2 * Math.PI * 600 * t) * 0.3;
  } else {
    return fade * Math.sin(2 * Math.PI * 900 * t) * 0.3;
  }
};

// Swipe: glissando
const swipe = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const freq = 400 + (t / dur) * 800;
  return fade * Math.sin(2 * Math.PI * freq * t) * 0.4;
};

// GPS activé: signal montant
const gpsEnabled = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  return fade * (
    Math.sin(2 * Math.PI * 440 * t) * 0.3 +
    Math.sin(2 * Math.PI * 880 * t) * 0.2 +
    Math.sin(2 * Math.PI * 1320 * t) * 0.2
  );
};

// Ping GPS: impulsion radar
const locationPing = (t, dur) => {
  const fade = Math.max(0, 1 - t / (dur * 0.4));
  return fade * Math.sin(2 * Math.PI * 1000 * t) * 0.4;
};

// Badge obtenu: fanfare courte
const badgeEarned = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  if (t < dur * 0.25) {
    return fade * Math.sin(2 * Math.PI * 523.25 * t) * 0.4; // C5
  } else if (t < dur * 0.5) {
    return fade * Math.sin(2 * Math.PI * 659.25 * t) * 0.4; // E5
  } else if (t < dur * 0.75) {
    return fade * Math.sin(2 * Math.PI * 783.99 * t) * 0.5; // G5
  } else {
    return fade * Math.sin(2 * Math.PI * 1046.5 * t) * 0.6; // C6
  }
};

// Level up: arpège ascendant rapide
const levelUp = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
  const noteIndex = Math.floor(t / (dur / notes.length));
  const freq = notes[Math.min(noteIndex, notes.length - 1)];
  return fade * Math.sin(2 * Math.PI * freq * t) * 0.5;
};

// Événement créé: signal positif
const eventCreated = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  return fade * (
    Math.sin(2 * Math.PI * 523.25 * t) * 0.3 + // C5
    Math.sin(2 * Math.PI * 783.99 * t) * 0.4   // G5
  );
};

// Affectation créée: signal double
const assignmentCreated = (t, dur) => {
  const fade = Math.min(1, Math.max(0, 1 - t / dur));
  if (t < dur * 0.5) {
    return fade * Math.sin(2 * Math.PI * 659.25 * t) * 0.4; // E5
  } else {
    return fade * Math.sin(2 * Math.PI * 783.99 * t) * 0.4; // G5
  }
};

// Configuration des sons à générer
const sounds = [
  { name: 'success', generator: success, duration: 0.4 },
  { name: 'error', generator: error, duration: 0.3 },
  { name: 'warning', generator: warning, duration: 0.5 },
  { name: 'notification', generator: notification, duration: 0.35 },
  { name: 'check-in-success', generator: checkInSuccess, duration: 0.45 },
  { name: 'check-out-success', generator: checkOutSuccess, duration: 0.45 },
  { name: 'late-warning', generator: lateWarning, duration: 0.6 },
  { name: 'message', generator: message, duration: 0.25 },
  { name: 'alert', generator: alert, duration: 0.5 },
  { name: 'sos-alert', generator: sosAlert, duration: 1.5 },
  { name: 'emergency', generator: emergency, duration: 0.8 },
  { name: 'click', generator: click, duration: 0.1 },
  { name: 'toggle', generator: toggle, duration: 0.2 },
  { name: 'swipe', generator: swipe, duration: 0.3 },
  { name: 'gps-enabled', generator: gpsEnabled, duration: 0.5 },
  { name: 'location-ping', generator: locationPing, duration: 0.2 },
  { name: 'badge-earned', generator: badgeEarned, duration: 0.6 },
  { name: 'level-up', generator: levelUp, duration: 0.7 },
  { name: 'event-created', generator: eventCreated, duration: 0.4 },
  { name: 'assignment-created', generator: assignmentCreated, duration: 0.4 }
];

// Générer tous les sons
const outputDir = path.join(__dirname, 'web-dashboard', 'public', 'sounds');

console.log('\n🎵 Génération des sons manquants...\n');

let totalSize = 0;
sounds.forEach(sound => {
  const filename = path.join(outputDir, `${sound.name}.wav`);
  writeWavFile(filename, sound.generator, sound.duration);
  totalSize += fs.statSync(filename).size;
});

console.log(`\n✅ ${sounds.length} fichiers sons générés`);
console.log(`📦 Taille totale: ${(totalSize / 1024).toFixed(1)} KB\n`);
