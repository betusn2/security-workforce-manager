import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Badge score de conformité
 * Props: { attendanceId, size?: 'sm'|'md'|'lg' }
 */
const ComplianceScore = ({ attendanceId, size = 'md' }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!attendanceId) return;
    const token = localStorage.getItem('token');
    axios.get(`/api/attendance/compliance/${attendanceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => setData(r.data)).catch(() => {});
  }, [attendanceId]);

  if (!data) return null;

  const color = data.grade === 'A' ? '#10b981' : data.grade === 'B' ? '#3b82f6' : data.grade === 'C' ? '#f59e0b' : data.grade === 'D' ? '#f97316' : '#ef4444';
  const sizes = { sm: { fontSize: 11, padding: '2px 6px' }, md: { fontSize: 13, padding: '3px 8px' }, lg: { fontSize: 15, padding: '4px 12px' } };

  const tooltip = (data.details?.criteria || []).map(c => `${c.met ? '✅' : '❌'} ${c.label}: ${c.points}/${c.maxPoints}pts`).join('\n');

  return (
    <span
      title={`Score: ${data.score}/100\n\n${tooltip}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: color + '22',
        border: `1px solid ${color}`,
        borderRadius: 6,
        color,
        fontWeight: 'bold',
        cursor: 'help',
        ...sizes[size]
      }}
    >
      {data.grade} · {data.score}
    </span>
  );
};

export default ComplianceScore;
