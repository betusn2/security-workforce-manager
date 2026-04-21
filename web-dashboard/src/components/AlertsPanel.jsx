import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Panneau d'alertes persistantes temps réel pour l'admin
 * Props: { eventId, token }
 */
const AlertsPanel = ({ eventId, token }) => {
  const [alerts, setAlerts] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const socket = io(apiUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
    });
    socket.on('connect', () => {
      if (eventId) {
        socket.emit('event:join', eventId);
      }
    });
    const addAlert = (type, data) => {
      setAlerts(prev => [{
        id: Date.now() + Math.random(),
        type,
        data,
        time: new Date(),
        dismissed: false,
      }, ...prev].slice(0, 30));
    };
    socket.on('tracking:geofence_alert', (d) => addAlert('zone_exit', d));
    socket.on('tracking:battery_alert', (d) => addAlert('battery_low', d));
    socket.on('tracking:early_departure', (d) => addAlert('early_departure', d));
    socket.on('agent:zone_exit', (d) => addAlert('zone_exit', d));
    socket.on('agent:battery_low', (d) => addAlert('battery_low', d));
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [eventId, token]);

  const dismiss = (id) => setAlerts(prev => prev.filter(a => a.id !== id));
  const activeAlerts = alerts.filter(a => !a.dismissed);

  const getAlertStyle = (type) => {
    if (type === 'zone_exit') return { bg: '#7f1d1d', border: '#ef4444', icon: '🚨', label: 'HORS ZONE' };
    if (type === 'battery_low') return { bg: '#78350f', border: '#f59e0b', icon: '🔋', label: 'BATTERIE FAIBLE' };
    if (type === 'early_departure') return { bg: '#1e1b4b', border: '#6366f1', icon: '🏃', label: 'DÉPART ANTICIPÉ' };
    return { bg: '#1e293b', border: '#475569', icon: '⚠️', label: 'ALERTE' };
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      width: 360, maxHeight: collapsed ? 50 : 500,
      overflow: 'hidden', transition: 'max-height 0.3s ease',
      borderRadius: 12, border: '1px solid #ef4444',
      backgroundColor: '#0f172a', boxShadow: '0 8px 32px rgba(239,68,68,0.3)'
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{ padding: '10px 16px', backgroundColor: '#1e293b', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>
          🚨 {activeAlerts.length} Alerte{activeAlerts.length > 1 ? 's' : ''} Active{activeAlerts.length > 1 ? 's' : ''}
        </span>
        <span style={{ color: '#64748b', fontSize: 12 }}>{collapsed ? '▲' : '▼'}</span>
      </div>
      <div style={{ maxHeight: 440, overflowY: 'auto', padding: '8px 0' }}>
        {activeAlerts.map(alert => {
          const style = getAlertStyle(alert.type);
          const msg = alert.data?.message || JSON.stringify(alert.data);
          const time = alert.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={alert.id} style={{
              margin: '6px 12px', padding: '10px 12px',
              backgroundColor: style.bg, border: `1px solid ${style.border}`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ color: style.border, fontWeight: 'bold', fontSize: 12 }}>
                  {style.icon} {style.label}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{time}</span>
                  <button onClick={() => dismiss(alert.id)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                </div>
              </div>
              <p style={{ color: '#e2e8f0', fontSize: 12, margin: '4px 0 0', lineHeight: 1.4 }}>{msg}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertsPanel;
