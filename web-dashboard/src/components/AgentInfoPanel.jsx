/**
 * 📊 COMPOSANT D'INFORMATIONS ENRICHIES D'UN AGENT
 * 
 * Affiche toutes les informations en temps réel :
 * - Position GPS
 * - Batterie complète
 * - Réseau
 * - Appareil
 * - Statistiques
 */

import React from 'react';
import { 
  FiBattery, FiActivity, FiMapPin, FiClock, FiZap,
  FiWifi, FiSmartphone, FiNavigation, FiTrendingUp,
  FiMonitor, FiCpu, FiGlobe
} from 'react-icons/fi';
import './AgentInfoPanel.css';

const AgentInfoPanel = ({ agent, stats, onClose }) => {
  if (!agent) return null;

  // Icône batterie selon niveau et statut
  const getBatteryIcon = () => {
    const level = agent.batteryLevel || 100;
    if (agent.batteryCharging) return '⚡';
    if (level < 15) return '🪫';
    if (level < 30) return '🔋';
    return '🔋';
  };

  // Couleur batterie
  const getBatteryColor = () => {
    const level = agent.batteryLevel || 100;
    if (agent.batteryCharging) return '#10B981';
    if (level < 15) return '#EF4444';
    if (level < 30) return '#F59E0B';
    return '#10B981';
  };

  // Icône réseau selon type
  const getNetworkIcon = () => {
    const type = agent.networkType?.toLowerCase() || 'unknown';
    if (type.includes('wifi')) return '📶';
    if (type.includes('4g') || type.includes('5g')) return '📱';
    if (type.includes('3g')) return '📡';
    return '🌐';
  };

  // Couleur réseau selon statut
  const getNetworkColor = () => {
    const status = agent.networkStatus?.toLowerCase() || 'unknown';
    if (status === 'offline') return '#EF4444';
    if (status === 'slow') return '#F59E0B';
    if (status === 'moderate') return '#F59E0B';
    if (status === 'fast' || status === 'excellent') return '#10B981';
    return '#6B7280';
  };

  return (
    <div className="agent-info-panel">
      <div className="panel-header">
        <div>
          <h3>{agent.user?.firstName} {agent.user?.lastName}</h3>
          <p className="agent-id">#{agent.user?.employeeId || agent.user?.cin}</p>
        </div>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="panel-content">
        {/* 📍 POSITION GPS */}
        <div className="info-section">
          <div className="section-title">
            <FiMapPin /> Position GPS
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Latitude</span>
              <span className="value">{agent.latitude?.toFixed(6)}</span>
            </div>
            <div className="info-item">
              <span className="label">Longitude</span>
              <span className="value">{agent.longitude?.toFixed(6)}</span>
            </div>
            <div className="info-item">
              <span className="label">Précision</span>
              <span className="value">{agent.accuracy ? `±${Math.round(agent.accuracy)}m` : 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Altitude</span>
              <span className="value">{agent.altitude ? `${Math.round(agent.altitude)}m` : 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Vitesse</span>
              <span className="value">{agent.speedKmh ? `${agent.speedKmh} km/h` : '0 km/h'}</span>
            </div>
            <div className="info-item">
              <span className="label">Direction</span>
              <span className="value">{agent.heading ? `${Math.round(agent.heading)}°` : 'N/A'}</span>
            </div>
            <div className="info-item full-width">
              <span className="label">État</span>
              <span className={`value status ${agent.isMoving ? 'moving' : 'stopped'}`}>
                {agent.isMoving ? '🏃 En mouvement' : '🛑 À l\'arrêt'}
              </span>
            </div>
          </div>
        </div>

        {/* 🔋 BATTERIE COMPLÈTE */}
        <div className="info-section">
          <div className="section-title">
            <FiBattery /> Batterie
          </div>
          <div className="battery-display">
            <div className="battery-main">
              <span className="battery-icon" style={{ color: getBatteryColor() }}>
                {getBatteryIcon()}
              </span>
              <span className="battery-level">{agent.batteryLevel || 100}%</span>
              {agent.batteryCharging && <span className="charging-badge">En charge</span>}
            </div>
            <div className="battery-progress">
              <div 
                className="battery-fill" 
                style={{ 
                  width: `${agent.batteryLevel || 100}%`,
                  backgroundColor: getBatteryColor()
                }}
              />
            </div>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">État</span>
              <span className="value">{agent.batteryStatus || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Temps restant</span>
              <span className="value">{agent.batteryEstimatedTime || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* 📶 RÉSEAU */}
        <div className="info-section">
          <div className="section-title">
            <FiWifi /> Réseau
          </div>
          <div className="network-display">
            <span className="network-icon" style={{ color: getNetworkColor() }}>
              {getNetworkIcon()}
            </span>
            <div>
              <div className="network-type">{agent.networkType || 'Unknown'}</div>
              <div className="network-status" style={{ color: getNetworkColor() }}>
                {agent.networkOnline ? '🟢 Connecté' : '🔴 Déconnecté'}
              </div>
            </div>
          </div>
          {agent.networkDownlink && (
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Vitesse</span>
                <span className="value">{agent.networkDownlink.toFixed(1)} Mbps</span>
              </div>
              <div className="info-item">
                <span className="label">Latence</span>
                <span className="value">{agent.networkRtt || 'N/A'} ms</span>
              </div>
            </div>
          )}
        </div>

        {/* 📱 APPAREIL */}
        <div className="info-section">
          <div className="section-title">
            <FiSmartphone /> Appareil
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">OS</span>
              <span className="value">{agent.deviceOS || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Navigateur</span>
              <span className="value">{agent.deviceBrowser || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Type</span>
              <span className="value">{agent.deviceType || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <span className="label">Écran</span>
              <span className={`value ${agent.deviceScreenOn ? 'screen-on' : 'screen-off'}`}>
                {agent.deviceScreenOn ? '🟢 Allumé' : '🔴 Éteint'}
              </span>
            </div>
          </div>
        </div>

        {/* 📊 STATISTIQUES */}
        {stats && (
          <div className="info-section">
            <div className="section-title">
              <FiActivity /> Statistiques
            </div>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Distance totale</span>
                <span className="value bold">{stats.totalDistance || '0 m'}</span>
              </div>
              <div className="info-item">
                <span className="label">Distance en mouv.</span>
                <span className="value">{stats.movingDistance || '0 m'}</span>
              </div>
              <div className="info-item">
                <span className="label">Vitesse moyenne</span>
                <span className="value">{stats.averageSpeed || '0'} km/h</span>
              </div>
              <div className="info-item">
                <span className="label">Vitesse max</span>
                <span className="value">{stats.maxSpeed || '0'} km/h</span>
              </div>
              <div className="info-item">
                <span className="label">Temps actif</span>
                <span className="value">{stats.movingTime || '0s'}</span>
              </div>
              <div className="info-item">
                <span className="label">Temps à l'arrêt</span>
                <span className="value">{stats.stoppedTime || '0s'}</span>
              </div>
              <div className="info-item">
                <span className="label">Batterie consommée</span>
                <span className="value">{stats.batteryConsumed || '0'}%</span>
              </div>
              <div className="info-item">
                <span className="label">Points GPS</span>
                <span className="value">{stats.positionsCount || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* ⏱️ TEMPS */}
        <div className="info-section">
          <div className="section-title">
            <FiClock /> Dernière mise à jour
          </div>
          <div className="timestamp">
            {new Date(agent.timestamp).toLocaleString('fr-FR')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentInfoPanel;
