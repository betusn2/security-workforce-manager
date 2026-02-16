// Sound Settings Component - Ready to use
// Add to: frontend/src/components/Settings/SoundSettings.jsx

import React, { useState, useEffect } from 'react';
import soundEffects from '../../utils/soundEffects';
import './SoundSettings.css';

const SoundSettings = () => {
  const [enabled, setEnabled] = useState(soundEffects.isEnabled());
  const [volume, setVolume] = useState(soundEffects.getVolume());
  const [testing, setTesting] = useState(null);

  useEffect(() => {
    // Load preferences on mount
    setEnabled(soundEffects.isEnabled());
    setVolume(soundEffects.getVolume());
  }, []);

  const handleToggle = () => {
    const newState = soundEffects.toggle();
    setEnabled(newState);
    
    if (newState) {
      soundEffects.playSuccess();
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    soundEffects.setVolume(newVolume);
  };

  const testSound = (soundName, displayName) => {
    setTesting(soundName);
    soundEffects.test(soundName);
    
    // Reset testing state after animation
    setTimeout(() => setTesting(null), 500);
  };

  const soundTests = [
    { name: 'success', icon: '✅', label: 'Succès' },
    { name: 'checkInSuccess', icon: '🏁', label: 'Check-in' },
    { name: 'checkOutSuccess', icon: '🏁', label: 'Check-out' },
    { name: 'notification', icon: '🔔', label: 'Notification' },
    { name: 'messageReceived', icon: '💬', label: 'Message' },
    { name: 'alertReceived', icon: '🚨', label: 'Alerte' },
    { name: 'warning', icon: '⚠️', label: 'Avertissement' },
    { name: 'error', icon: '❌', label: 'Erreur' },
    { name: 'sos', icon: '🆘', label: 'SOS' },
    { name: 'emergency', icon: '🚨', label: 'Urgence' },
    { name: 'badgeEarned', icon: '🏆', label: 'Badge' },
    { name: 'gpsEnabled', icon: '📍', label: 'GPS' },
    { name: 'click', icon: '🖱️', label: 'Clic' },
  ];

  return (
    <div className="sound-settings-container">
      <div className="sound-settings-header">
        <h2>🔊 Effets Sonores</h2>
        <p className="sound-settings-description">
          Configurez les sons de notification et de feedback de l'application
        </p>
      </div>

      <div className="sound-settings-content">
        {/* Enable/Disable Toggle */}
        <div className="setting-card">
          <div className="setting-row">
            <div className="setting-info">
              <label className="setting-label">Activer les effets sonores</label>
              <p className="setting-hint">
                Sons de notification, feedback et alertes
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={handleToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Volume Control */}
        {enabled && (
          <div className="setting-card fade-in">
            <div className="setting-row">
              <div className="setting-info full-width">
                <label className="setting-label">
                  Volume {Math.round(volume * 100)}%
                </label>
                <div className="volume-control">
                  <span className="volume-icon">🔈</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                  />
                  <span className="volume-icon">🔊</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Sounds */}
        {enabled && (
          <div className="setting-card fade-in">
            <h3 className="section-title">🎵 Tester les sons</h3>
            <p className="section-description">
              Cliquez sur un bouton pour écouter le son correspondant
            </p>
            <div className="test-sounds-grid">
              {soundTests.map((sound) => (
                <button
                  key={sound.name}
                  className={`test-sound-btn ${testing === sound.name ? 'testing' : ''}`}
                  onClick={() => testSound(sound.name, sound.label)}
                  disabled={testing !== null}
                >
                  <span className="test-sound-icon">{sound.icon}</span>
                  <span className="test-sound-label">{sound.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="setting-card info-panel">
          <h3 className="section-title">ℹ️ Information</h3>
          <ul className="info-list">
            <li>
              <strong>Sons désactivés automatiquement</strong> si le navigateur bloque l'autoplay
            </li>
            <li>
              <strong>Mode silencieux</strong> respecté sur mobile
            </li>
            <li>
              <strong>Préférences sauvegardées</strong> automatiquement dans le navigateur
            </li>
            <li>
              <strong>Performance optimisée</strong> avec préchargement des fichiers audio
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SoundSettings;
