import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Timeline Gantt de présence pour un agent dans un événement
 * Props: { eventId, agentId, agentName, eventStart, eventEnd }
 */
const PresenceTimeline = ({ eventId, agentId, agentName, eventStart, eventEnd }) => {
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !agentId) return;
    const token = localStorage.getItem('token');
    axios.get(`/api/tracking/timeline/${eventId}/${agentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      // API returns { success: true, data: { segments, compliancePercent, ... } }
      setTimeline(r.data?.data || r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId, agentId]);

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 12 }}>Chargement timeline...</div>;
  if (!timeline) return null;

  const totalMs = new Date(eventEnd) - new Date(eventStart);

  const getSegmentStyle = (segment) => {
    const segStart = Math.max(new Date(segment.start) - new Date(eventStart), 0);
    const segDuration = new Date(segment.end) - new Date(segment.start);
    const left = (segStart / totalMs) * 100;
    const width = Math.max((segDuration / totalMs) * 100, 0.5);
    const colors = {
      in_zone: '#10b981',
      out_zone: '#ef4444',
      offline: '#6b7280'
    };
    return {
      position: 'absolute',
      left: `${left}%`,
      width: `${width}%`,
      height: '100%',
      backgroundColor: colors[segment.status] || '#6b7280',
      borderRadius: 2,
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    };
  };

  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{agentName}</span>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: (timeline.compliancePercent ?? 0) >= 90 ? '#10b981' : (timeline.compliancePercent ?? 0) >= 70 ? '#f59e0b' : '#ef4444' }}>
          {isNaN(timeline.compliancePercent) || timeline.compliancePercent == null ? '—' : Math.round(timeline.compliancePercent)}% conformité
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
        {(timeline.segments || []).map((seg, i) => (
          <div
            key={i}
            style={getSegmentStyle(seg)}
            title={`${seg.status === 'in_zone' ? '✅ Dans zone' : seg.status === 'out_zone' ? '🔴 Hors zone' : '📵 Offline'} — ${seg.durationMinutes} min`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#64748b' }}>
        <span>✅ {timeline.totalInZoneMinutes}min zone</span>
        <span>🔴 {timeline.totalOutZoneMinutes}min hors zone</span>
        <span>📵 {timeline.totalOfflineMinutes}min offline</span>
      </div>
    </div>
  );
};

export default PresenceTimeline;
