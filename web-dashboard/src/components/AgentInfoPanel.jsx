/**
 * 📊 COMPOSANT D'INFORMATIONS ENRICHIES D'UN AGENT
 */

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FiBattery, FiActivity, FiMapPin, FiClock,
  FiWifi, FiSmartphone, FiPhone, FiX, FiNavigation, FiCamera
} from 'react-icons/fi';
import './AgentInfoPanel.css';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const val = (v, suffix = '', fallback = '—') =>
  v != null && v !== '' && v !== 'Unknown' && v !== 'unknown' ? `${v}${suffix}` : fallback;

const AgentInfoPanel = ({ agent, stats, onClose, eventRadius, onScreenshot, screenshotData, screenshotLoading }) => {
  if (!agent) return null;

  const lat = agent.lat || agent.latitude;
  const lng = agent.lng || agent.longitude;
  const battery = agent.batteryLevel || agent.battery;
  const phone = agent.user?.phone || agent.user?.phoneNumber || agent.user?.mobile;

  const getBatteryColor = () => {
    if (agent.batteryCharging) return '#10B981';
    if (battery < 15) return '#EF4444';
    if (battery < 30) return '#F59E0B';
    return '#10B981';
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = ts instanceof Date ? ts : new Date(ts);
    return isNaN(d) ? '—' : d.toLocaleString('fr-FR');
  };

  return (
    <div className="agent-info-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="flex-1">
          <h3>{agent.user?.firstName} {agent.user?.lastName}</h3>
          <p className="agent-id">#{agent.user?.employeeId || agent.user?.cin}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Bouton Appeler */}
          {phone ? (
            <a
              href={`tel:${phone}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#10B981', color: 'white',
                padding: '6px 12px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap'
              }}
              title={`Appeler ${phone}`}
            >
              <FiPhone size={14} /> Appeler
            </a>
          ) : (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.2)', color: 'white',
              padding: '6px 12px', borderRadius: '8px',
              fontSize: '12px', opacity: 0.7
            }}>
              <FiPhone size={14} /> Pas de tél.
            </span>
          )}
          {/* Bouton Capture */}
          {onScreenshot && (
            <button
              onClick={() => onScreenshot(agent.userId || agent.user?.id)}
              disabled={screenshotLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: screenshotLoading ? '#6B7280' : '#8B5CF6', color: 'white',
                padding: '6px 12px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, border: 'none',
                cursor: screenshotLoading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Demander une capture d'écran"
            >
              <FiCamera size={14} />
              {screenshotLoading ? '⏳ Attente...' : 'Capture'}
            </button>
          )}
          <button onClick={onClose} className="close-btn"><FiX /></button>
        </div>
      </div>

      <div className="panel-content">

        {/* 🗺️ MINI CARTE */}
        {lat && lng && (
          <div className="info-section" style={{ padding: 0, overflow: 'hidden', borderRadius: '8px', margin: '12px' }}>
            <div style={{ height: '180px', width: '100%' }}>
              <MapContainer
                center={[lat, lng]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
                doubleClickZoom={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {eventRadius && (
                  <Circle
                    center={[lat, lng]}
                    radius={eventRadius}
                    pathOptions={{ color: '#3B82F6', fillOpacity: 0.1, weight: 2, dashArray: '5,8' }}
                  />
                )}
                <Marker position={[lat, lng]} />
              </MapContainer>
            </div>
            <div style={{
              padding: '6px 10px', background: '#F8FAFC',
              fontSize: '11px', color: '#64748B', borderTop: '1px solid #E2E8F0',
              display: 'flex', gap: '12px'
            }}>
              <span><FiMapPin size={10} style={{ marginRight: 3 }} />{lat.toFixed(6)}, {lng.toFixed(6)}</span>
              {agent.accuracy && <span>±{Math.round(agent.accuracy)}m</span>}
            </div>
          </div>
        )}

        {/* 📍 POSITION GPS */}
        <div className="info-section">
          <div className="section-title"><FiNavigation /> Position GPS</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Altitude</span>
              <span className="value">{val(agent.altitude, 'm')}</span>
            </div>
            <div className="info-item">
              <span className="label">Vitesse</span>
              <span className="value">{agent.speedKmh != null ? `${agent.speedKmh} km/h` : agent.speed != null ? `${Math.round(agent.speed * 3.6)} km/h` : '0 km/h'}</span>
            </div>
            <div className="info-item">
              <span className="label">Direction</span>
              <span className="value">{agent.heading != null ? `${Math.round(agent.heading)}°` : '—'}</span>
            </div>
            <div className="info-item full-width">
              <span className="label">État</span>
              <span className={`value status ${agent.isMoving ? 'moving' : 'stopped'}`}>
                {agent.isMoving ? '🏃 En mouvement' : '🛑 À l\'arrêt'}
              </span>
            </div>
          </div>
        </div>

        {/* 🔋 BATTERIE */}
        <div className="info-section">
          <div className="section-title"><FiBattery /> Batterie</div>
          <div className="battery-display">
            <div className="battery-main">
              <span className="battery-level" style={{ color: getBatteryColor() }}>
                {agent.batteryCharging ? '⚡' : '🔋'} {battery != null ? `${battery}%` : '—'}
              </span>
              {agent.batteryCharging && <span className="charging-badge">En charge</span>}
            </div>
            {battery != null && (
              <div className="battery-progress">
                <div className="battery-fill" style={{ width: `${battery}%`, backgroundColor: getBatteryColor() }} />
              </div>
            )}
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">État charge</span>
              <span className="value">
                {agent.batteryCharging ? '⚡ En charge' : agent.batteryStatus && agent.batteryStatus !== 'Unknown' ? agent.batteryStatus : battery != null ? (battery > 20 ? '🔋 Normal' : '⚠️ Faible') : '—'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Temps restant</span>
              <span className="value">
                {agent.batteryEstimatedTime && agent.batteryEstimatedTime !== 'N/A'
                  ? agent.batteryEstimatedTime
                  : (battery != null && !agent.batteryCharging)
                    ? `~${Math.round(battery * 4)}min`
                    : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 📶 RÉSEAU */}
        <div className="info-section">
          <div className="section-title"><FiWifi /> Réseau</div>
          <div className="network-display">
            <span className="network-icon">
              {agent.networkType?.toLowerCase().includes('wifi') ? '📶'
               : agent.networkType?.toLowerCase().includes('4g') || agent.networkType?.toLowerCase().includes('5g') ? '📱'
               : agent.networkType?.toLowerCase().includes('3g') ? '📡' : '🌐'}
            </span>
            <div>
              <div className="network-type">
                {agent.networkType && agent.networkType !== 'Unknown' ? agent.networkType.toUpperCase() : 'WiFi / Données mobiles'}
              </div>
              <div className="network-status" style={{ color: agent.networkOnline === false ? '#EF4444' : '#10B981' }}>
                {agent.networkOnline === false ? '🔴 Déconnecté' : '🟢 Connecté'}
              </div>
            </div>
          </div>
          {agent.networkDownlink && (
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Débit</span>
                <span className="value">{agent.networkDownlink.toFixed(1)} Mbps</span>
              </div>
              <div className="info-item">
                <span className="label">Latence</span>
                <span className="value">{val(agent.networkRtt, ' ms')}</span>
              </div>
            </div>
          )}
        </div>

        {/* 📱 APPAREIL */}
        <div className="info-section">
          <div className="section-title"><FiSmartphone /> Appareil</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">OS</span>
              <span className="value">{val(agent.deviceOS)}</span>
            </div>
            <div className="info-item">
              <span className="label">Navigateur</span>
              <span className="value">{val(agent.deviceBrowser)}</span>
            </div>
            <div className="info-item">
              <span className="label">Type</span>
              <span className="value">{val(agent.deviceType)}</span>
            </div>
            <div className="info-item">
              <span className="label">Écran</span>
              <span className={`value ${agent.deviceScreenOn ? 'screen-on' : ''}`}>
                {agent.deviceScreenOn === true ? '🟢 Allumé' : agent.deviceScreenOn === false ? '🔴 Éteint' : '—'}
              </span>
            </div>
            {agent.deviceMemory && (
              <div className="info-item">
                <span className="label">RAM</span>
                <span className="value">{agent.deviceMemory} Go</span>
              </div>
            )}
            {agent.deviceCPUCores && (
              <div className="info-item">
                <span className="label">CPU</span>
                <span className="value">{agent.deviceCPUCores} cœurs</span>
              </div>
            )}
          </div>
        </div>

        {/* 📊 STATISTIQUES */}
        {stats && (
          <div className="info-section">
            <div className="section-title"><FiActivity /> Statistiques</div>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Distance totale</span>
                <span className="value bold">{stats.totalDistance || '—'}</span>
              </div>
              <div className="info-item">
                <span className="label">Vitesse moy.</span>
                <span className="value">{stats.averageSpeed || '0'} km/h</span>
              </div>
              <div className="info-item">
                <span className="label">Vitesse max</span>
                <span className="value">{stats.maxSpeed || '0'} km/h</span>
              </div>
              <div className="info-item">
                <span className="label">Batterie consommée</span>
                <span className="value">{stats.batteryConsumed || '0'}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 📸 CAPTURE D'ÉCRAN */}
        {screenshotData && screenshotData.agentId === (agent.userId || agent.user?.id) && (
          <div className="info-section">
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><FiCamera /> Capture reçue</span>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>
                {formatTime(screenshotData.timestamp)}
              </span>
            </div>
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0', cursor: 'pointer' }}
              onClick={() => window.open(screenshotData.imageBase64, '_blank')}
              title="Cliquer pour agrandir"
            >
              <img
                src={screenshotData.imageBase64}
                alt="Capture écran agent"
                style={{ width: '100%', display: 'block' }}
              />
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', marginTop: '4px' }}>
              Cliquer pour agrandir
            </p>
          </div>
        )}

        {/* ⌛ EN ATTENTE DE CAPTURE */}
        {screenshotLoading && (
          <div className="info-section" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '32px' }}>📸</div>
            <p style={{ color: '#6B7280', fontSize: '13px', marginTop: '8px' }}>En attente de la capture...</p>
            <p style={{ color: '#94A3B8', fontSize: '11px' }}>L'agent doit accepter sur son téléphone</p>
          </div>
        )}

        {/* ⏱️ DERNIÈRE MAJ */}
        <div className="info-section">
          <div className="section-title"><FiClock /> Dernière mise à jour</div>
          <div className="timestamp">{formatTime(agent.timestamp)}</div>
        </div>
      </div>
    </div>
  );
};

export default AgentInfoPanel;

