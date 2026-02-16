// Audio Generator - Generate temporary sounds using Web Audio API
// Use this until you download real sound files
// Add to: frontend/src/utils/audioGenerator.js

class AudioGenerator {
  constructor() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.audioContext = null;
    }
  }

  // Generate a simple beep tone
  playBeep(frequency = 440, duration = 200, volume = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration / 1000
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
  }

  // Success sound - Rising frequency
  playSuccessSound() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(
      783.99,
      this.audioContext.currentTime + 0.3
    ); // G5

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.3
    );

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  // Error sound - Low frequency buzz
  playErrorSound() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 130.81; // C3

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.4
    );

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
  }

  // Notification sound - Two tone bing-bong
  playNotificationSound() {
    if (!this.audioContext) return;

    // First tone
    const osc1 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(this.audioContext.destination);
    osc1.frequency.value = 880; // A5
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
    osc1.start();
    osc1.stop(this.audioContext.currentTime + 0.15);

    // Second tone
    const osc2 = this.audioContext.createOscillator();
    const gain2 = this.audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(this.audioContext.destination);
    osc2.frequency.value = 660; // E5
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, this.audioContext.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.3, this.audioContext.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.35);
    osc2.start(this.audioContext.currentTime + 0.1);
    osc2.stop(this.audioContext.currentTime + 0.35);
  }

  // Warning sound - Alternating tones
  playWarningSound() {
    if (!this.audioContext) return;

    for (let i = 0; i < 3; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.type = 'square';
      osc.frequency.value = i % 2 === 0 ? 440 : 554.37; // A4 / C#5
      
      const startTime = this.audioContext.currentTime + (i * 0.15);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);
      
      osc.start(startTime);
      osc.stop(startTime + 0.12);
    }
  }

  // SOS Alert - Urgent siren-like sound
  playSOSSound() {
    if (!this.audioContext) return;

    const duration = 2;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();

    // LFO for frequency modulation (siren effect)
    lfo.frequency.value = 4; // 4Hz modulation
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 440;

    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + duration
    );

    lfo.start();
    oscillator.start();
    lfo.stop(this.audioContext.currentTime + duration);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Check-in success - Pleasant ascending melody
  playCheckInSound() {
    if (!this.audioContext) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, index) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = this.audioContext.currentTime + (index * 0.1);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // Badge earned - Celebratory fanfare
  playBadgeSound() {
    if (!this.audioContext) return;

    const melody = [
      { freq: 523.25, time: 0 },     // C5
      { freq: 659.25, time: 0.1 },   // E5
      { freq: 783.99, time: 0.2 },   // G5
      { freq: 1046.5, time: 0.3 }    // C6
    ];

    melody.forEach(note => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.type = 'triangle';
      osc.frequency.value = note.freq;
      
      const startTime = this.audioContext.currentTime + note.time;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  // Click sound - Short subtle click
  playClickSound() {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.value = 1000;
    
    gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.05);
  }
}

// Create singleton
const audioGenerator = new AudioGenerator();

export default audioGenerator;

// Fallback sound effects using Web Audio API
// Use these if real sound files are not available
export const generatedSounds = {
  success: () => audioGenerator.playSuccessSound(),
  error: () => audioGenerator.playErrorSound(),
  notification: () => audioGenerator.playNotificationSound(),
  warning: () => audioGenerator.playWarningSound(),
  sos: () => audioGenerator.playSOSSound(),
  checkIn: () => audioGenerator.playCheckInSound(),
  checkOut: () => audioGenerator.playCheckInSound(),
  badge: () => audioGenerator.playBadgeSound(),
  click: () => audioGenerator.playClickSound(),
};
