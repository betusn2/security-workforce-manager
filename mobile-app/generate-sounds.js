/**
 * generate-sounds.js
 * ==================
 * Génère tous les fichiers WAV de l'app Security Guard.
 * Pur Node.js, aucune dépendance externe.
 *
 * Usage: node generate-sounds.js
 * Output: assets/sounds/*.wav
 */

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR  = path.join(__dirname, 'assets', 'sounds');
const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 1;   // mono
const BITS_PER_SAMPLE = 16;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Helpers WAV ─────────────────────────────────────────────────────────────

function writeWav(filename, samples) {
  const numSamples  = samples.length;
  const byteRate    = SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8;
  const blockAlign  = NUM_CHANNELS * BITS_PER_SAMPLE / 8;
  const dataSize    = numSamples * blockAlign;
  const chunkSize   = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);
  let pos = 0;

  const write = (fn, val, size) => { buf[fn](val, pos, true); pos += size; };

  buf.write('RIFF',  0); pos = 4;
  write('writeUInt32LE', chunkSize, 4);
  buf.write('WAVE', pos); pos += 4;
  buf.write('fmt ', pos); pos += 4;
  write('writeUInt32LE', 16, 4);          // PCM subchunk size
  write('writeUInt16LE', 1,  2);          // PCM format
  write('writeUInt16LE', NUM_CHANNELS, 2);
  write('writeUInt32LE', SAMPLE_RATE, 4);
  write('writeUInt32LE', byteRate, 4);
  write('writeUInt16LE', blockAlign, 2);
  write('writeUInt16LE', BITS_PER_SAMPLE, 2);
  buf.write('data', pos); pos += 4;
  write('writeUInt32LE', dataSize, 4);

  for (const s of samples) {
    const clamped = Math.max(-1, Math.min(1, s));
    buf.writeInt16LE(Math.round(clamped * 32767), pos);
    pos += 2;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, filename), buf);
  console.log(`✅ ${filename} (${numSamples} samples, ${(dataSize / 1024).toFixed(1)} KB)`);
}

// Fade envelope (attack + decay + release)
function envelope(i, total, attack = 0.01, release = 0.06) {
  const t = i / total;
  const attackSamples  = attack  * total;
  const releaseSamples = release * total;
  const releaseStart   = total - releaseSamples;
  if (i < attackSamples) return i / attackSamples;
  if (i > releaseStart)  return (total - i) / releaseSamples;
  return 1;
}

function sine(freq, t) { return Math.sin(2 * Math.PI * freq * t); }

// Tone segment: generates `durationMs` ms of a given frequency at `volume`
function tone(freq, durationMs, volume = 0.5, attack = 0.01, release = 0.08) {
  const n = Math.round(SAMPLE_RATE * durationMs / 1000);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    samples.push(volume * envelope(i, n, attack, release) * sine(freq, t));
  }
  return samples;
}

// Chord segment: mix multiple frequencies
function chord(freqs, durationMs, volume = 0.4, attack = 0.01, release = 0.1) {
  const n = Math.round(SAMPLE_RATE * durationMs / 1000);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const mix = freqs.reduce((sum, f) => sum + sine(f, t), 0) / freqs.length;
    samples.push(volume * envelope(i, n, attack, release) * mix);
  }
  return samples;
}

// Silence segment
function silence(durationMs) {
  return new Array(Math.round(SAMPLE_RATE * durationMs / 1000)).fill(0);
}

// Concatenate segments
const concat = (...segs) => [].concat(...segs);

// ─── Sons ─────────────────────────────────────────────────────────────────────

// 1. login_success — 2 montées harmonieuses (inDrive style)
//    G4 → B4 → D5 (accord de sol majeur)
writeWav('login_success.wav', concat(
  tone(392.0, 80,  0.45, 0.02, 0.05),   // G4
  silence(20),
  tone(493.9, 80,  0.45, 0.01, 0.05),   // B4
  silence(20),
  chord([587.3, 740.0, 880.0], 220, 0.5, 0.02, 0.15),  // D5+F#5+A5 (arpeggiated)
));

// 2. login_error — descente dissonante
//    E4 → C4 buzz (erreur claire, pas agressive)
writeWav('login_error.wav', concat(
  tone(329.6, 120, 0.5, 0.01, 0.05),   // E4
  silence(30),
  tone(261.6, 80,  0.45, 0.01, 0.04),  // C4
  silence(30),
  tone(196.0, 160, 0.4, 0.01, 0.12),   // G3 (grave, erreur)
));

// 3. checkin — militaire 3 bips + confirmation grave
//    Style badge scanner / accès autorisé
writeWav('checkin.wav', concat(
  tone(880.0, 60,  0.5,  0.01, 0.04),  // A5 beep 1
  silence(40),
  tone(880.0, 60,  0.5,  0.01, 0.04),  // A5 beep 2
  silence(40),
  chord([1046.5, 1318.5, 1568.0], 280, 0.55, 0.02, 0.18),  // C6+E6+G6 (accès OK)
));

// 4. checkout — style "fermeture session"
//    Descente douce, plus mélancolique que login_success
writeWav('checkout.wav', concat(
  chord([880.0, 1108.7, 1318.5], 120, 0.45, 0.02, 0.08),  // A5+C#6+E6
  silence(30),
  tone(698.5, 100, 0.4, 0.01, 0.08),   // F5
  silence(25),
  tone(523.3, 220, 0.4, 0.01, 0.15),   // C5 (fin)
));

// 5. camera_shutter — ultra-court clic mécanique
//    White noise dampé = son obturateur réaliste
writeWav('camera_shutter.wav', (() => {
  const n = Math.round(SAMPLE_RATE * 0.08); // 80ms
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Bruit blanc + fréquence clé (1200Hz)
    const noise  = (Math.random() * 2 - 1) * 0.3;
    const click  = sine(1200, t) * 0.25;
    const env    = envelope(i, n, 0.002, 0.6);
    samples.push(env * (noise + click));
  }
  return samples;
})());

// 6. alert — 3 pulsations urgentes
//    Fréquence d'alerte standard sécurité (770Hz)
writeWav('alert.wav', concat(
  tone(770.0, 120, 0.65, 0.01, 0.04),  // alerte 1
  silence(80),
  tone(770.0, 120, 0.65, 0.01, 0.04),  // alerte 2
  silence(80),
  tone(900.0, 200, 0.7,  0.01, 0.08),  // montée final
));

// 7. alert_critical — pattern SOD urgence extrême
writeWav('alert_critical.wav', concat(
  tone(1046.5, 80, 0.7, 0.01, 0.03),
  silence(40),
  tone(1046.5, 80, 0.7, 0.01, 0.03),
  silence(40),
  tone(1046.5, 80, 0.7, 0.01, 0.03),
  silence(80),
  tone(880.0,  60, 0.65, 0.01, 0.03),
  silence(40),
  tone(880.0,  60, 0.65, 0.01, 0.03),
  silence(80),
  tone(1046.5, 200, 0.75, 0.02, 0.12),
));

// 8. message — notification douce (style iMessage)
writeWav('message.wav', concat(
  tone(1046.5, 60,  0.35, 0.02, 0.06),  // C6
  silence(15),
  tone(1318.5, 120, 0.4,  0.02, 0.10),  // E6
));

// 9. incident — alerte incident grave
//    Motif graves + aigus successifs
writeWav('incident.wav', concat(
  tone(130.8, 100, 0.6, 0.01, 0.03),   // C3
  silence(30),
  tone(440.0, 100, 0.6, 0.01, 0.03),   // A4
  silence(30),
  tone(130.8, 100, 0.6, 0.01, 0.03),   // C3
  silence(60),
  chord([220.0, 440.0, 660.0], 280, 0.65, 0.02, 0.15),
));

// 10. button_press — micro-clic UI ultra-discret (Apple HIG style)
writeWav('button_press.wav', concat(
  tone(1400.0, 12, 0.2, 0.002, 0.08),
));

// 11. selection — sélection tab/menu
writeWav('selection.wav', concat(
  tone(1047.0, 25, 0.25, 0.002, 0.07),
));

// 12. notification — ping notification push (doux)
writeWav('notification.wav', concat(
  tone(880.0,  60,  0.35, 0.02, 0.08),
  silence(20),
  tone(1108.7, 100, 0.4,  0.02, 0.12),
));

// 13. geofence_exit — sortie de zone (alarme)
writeWav('geofence_exit.wav', concat(
  tone(659.3, 100, 0.6, 0.01, 0.04),
  silence(50),
  tone(523.3, 100, 0.6, 0.01, 0.04),
  silence(50),
  tone(392.0, 200, 0.65, 0.01, 0.12),
));

// 14. battery_low — batterie faible (1 pip montant)
writeWav('battery_low.wav', concat(
  tone(440.0, 80,  0.4, 0.01, 0.06),
  silence(30),
  tone(523.3, 140, 0.35, 0.01, 0.10),
));

// 15. login_start — clic menu doux au tap bouton connexion
writeWav('login_start.wav', concat(
  tone(660.0, 40, 0.3, 0.005, 0.08),
));

// 16. patrol_checkin — checkin patrouille (différent du checkin event)
writeWav('patrol_checkin.wav', concat(
  tone(659.3, 60, 0.45, 0.01, 0.04),
  silence(30),
  tone(880.0, 60, 0.45, 0.01, 0.04),
  silence(30),
  tone(1046.5, 180, 0.5, 0.02, 0.12),
));

console.log('\n🎵 GÉNÉRATION TERMINÉE');
console.log(`📁 ${OUTPUT_DIR}`);
console.log(`📦 16 fichiers WAV générés`);
