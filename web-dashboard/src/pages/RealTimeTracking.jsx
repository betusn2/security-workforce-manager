import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FiUsers, FiActivity, FiBattery, FiMapPin, FiZap,
  FiAlertTriangle, FiCheckCircle, FiRefreshCw,
  FiNavigation, FiX, FiMaximize2, FiSmartphone,
  FiMessageSquare, FiSend, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import api, { trackingAPI, notificationsAPI } from '../services/api';
import useAuthStore from '../hooks/useAuth';
import AgentInfoPanel from '../components/AgentInfoPanel';
import AlertsPanel from '../components/AlertsPanel';

// Socket.IO URL — priorité à REACT_APP_SOCKET_URL, sinon dériver de REACT_APP_API_URL
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
                   process.env.REACT_APP_API_URL?.replace('/api', '') ||
                   'https://security-workforce-manager.onrender.com';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Recentrer la carte sur un nouveau centre
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

// Agent offline if no update for this long
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function ago(ts) {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d)) return '—';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5)  return 'à l\'instant';
  if (sec < 60) return `il y a ${sec}s`;
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)}min`;
  return `il y a ${Math.floor(sec / 3600)}h`;
}

// ─── Icône agent ──────────────────────────────────────────────────────────────
const createAgentIcon = (agent) => {
  const { status, batteryLevel, isMoving, batteryCharging, isOnline } = agent;
  let color = '#10B981';
  if (!isOnline) color = '#6B7280';
  else if (status === 'outside_geofence') color = '#EF4444';
  else if (batteryLevel < 20 && !batteryCharging) color = '#F59E0B';

  const pulse = isOnline && isMoving ? 'animation:agpulse 1.6s infinite;' : '';
  const badge = batteryCharging
    ? `<div style="position:absolute;top:-4px;right:-5px;width:18px;height:18px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;font-size:10px;">⚡</div>`
    : (batteryLevel < 20
        ? `<div style="position:absolute;top:-4px;right:-5px;width:18px;height:18px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;font-size:10px;">🪫</div>`
        : '');

  const html = `
  <style>@keyframes agpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}</style>
  <div style="width:46px;height:46px;background:${color};border:3px solid white;border-radius:50%;
    display:flex;align-items:center;justify-content:center;position:relative;
    box-shadow:0 3px 10px rgba(0,0,0,.35),0 0 0 4px ${color}33;${pulse}">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
    ${badge}
  </div>`;
  return L.divIcon({ html, className: '', iconSize: [46, 46], iconAnchor: [23, 23] });
};

// ─── BatteryBadge ─────────────────────────────────────────────────────────────
function BatteryBadge({ level, charging }) {
  if (level == null) return <span className="text-gray-400 text-xs">—</span>;
  const color = charging ? '#10b981' : level < 15 ? '#ef4444' : level < 30 ? '#f59e0b' : '#10b981';
  const fill  = Math.max(2, Math.min(100, level));
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 26, height: 11, border: `2px solid ${color}`, borderRadius: 3, position: 'relative', display: 'flex', alignItems: 'center', padding: 1 }}>
        <div style={{ width: 3, height: 5, background: color, borderRadius: '0 2px 2px 0', position: 'absolute', right: -5 }} />
        <div style={{ width: `${fill}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700 }}>{charging ? '⚡ ' : ''}{level}%</span>
    </div>
  );
}

// ─── NetworkBadge ─────────────────────────────────────────────────────────────
function NetworkBadge({ type, online }) {
  if (!type && online == null) return <span className="text-gray-400 text-xs">—</span>;
  const icon  = type === 'WiFi' ? '📶' : type === '4G' ? '📡' : type === '3G' ? '📡' : '🌐';
  const color = online === false ? 'text-red-500' : 'text-blue-600';
  return <span className={`text-xs font-medium ${color}`}>{icon} {type || (online ? 'En ligne' : 'Hors ligne')}</span>;
}

// ─── SendMessageModal ─────────────────────────────────────────────────────────
function SendMessageModal({ target, onClose, socket }) {
  const [title,    setTitle]    = useState('');
  const [message,  setMessage]  = useState('');
  const [priority, setPriority] = useState('normal');
  const [sending,  setSending]  = useState(false);

  const send = async () => {
    if (!message.trim()) { toast.error('Entrez un message'); return; }
    setSending(true);
    try {
      const payload = {
        title:      title || (priority === 'urgent' ? '🚨 Message Urgent' : '💬 Message Admin'),
        message:    message.trim(),
        priority,
        senderName: 'Admin',
      };
      if (socket?.connected) {
        if (target.type === 'event') {
          socket.emit('admin:message:event', { ...payload, eventId: target.id });
        } else {
          socket.emit('admin:message:user', { ...payload, userId: target.id });
        }
      }
      await notificationsAPI.send({
        recipientId: target.type !== 'event' ? target.id : undefined,
        eventId:     target.type === 'event'  ? target.id : undefined,
        title:       payload.title,
        message:     payload.message,
        type:        'message',
        data: { popup: true, priority },
      }).catch(() => {});
      toast.success(`Message envoyé à ${target.name}`);
      onClose();
    } catch { toast.error('Erreur envoi message'); }
    finally  { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiMessageSquare className="text-blue-600" /> Envoyer un message
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
        </div>
        <div className="mb-3 text-sm text-gray-500">
          Destinataire : <span className="font-semibold text-gray-800">{target.name}</span>
        </div>
        <div className="flex gap-2 mb-3">
          {[
            { v: 'normal', label: '💬 Normal',     cls: 'bg-blue-100 text-blue-700 border-blue-300' },
            { v: 'high',   label: '⚠️ Important',  cls: 'bg-orange-100 text-orange-700 border-orange-300' },
            { v: 'urgent', label: '🚨 Urgent',      cls: 'bg-red-100 text-red-700 border-red-300' },
          ].map(p => (
            <button key={p.v} onClick={() => setPriority(p.v)}
              className={`flex-1 py-2 border-2 rounded-lg text-xs font-semibold transition-all ${priority === p.v ? p.cls + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Titre (optionnel)" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          rows={4} placeholder="Votre message…" value={message} onChange={e => setMessage(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium">Annuler</button>
          <button onClick={send} disabled={sending || !message.trim()}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <FiSend size={13} />{sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const RealTimeTracking = () => {
  const { user } = useAuthStore();
  const [assignments,    setAssignments]    = useState([]);
  const [attendance,     setAttendance]     = useState([]);
  const [locations,      setLocations]      = useState({}); // { userId: { lat, lng, batteryLevel, … } }
  const [events,         setEvents]         = useState([]);
  const [selectedEvent,  setSelectedEvent]  = useState(null);
  const [alerts,         setAlerts]         = useState([]);
  const [showHistory,    setShowHistory]    = useState(false);
  const [selectedAgent,  setSelectedAgent]  = useState(null);
  const [agentHistory,   setAgentHistory]   = useState([]);
  const [msgTarget,      setMsgTarget]      = useState(null);
  const [screenshotData,      setScreenshotData]      = useState(null);
  const [screenshotLoading,   setScreenshotLoading]   = useState(false);
  const [filters,        setFilters]        = useState({
    showActive: true, showOutside: true, showCompleted: false,
    showLowBattery: true, showAgents: true, showSupervisors: true, showOffline: false,
  });
  const [mapCenter,    setMapCenter]    = useState([33.5731, -7.5898]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [tableOpen,    setTableOpen]    = useState(true);
  const [tick,         setTick]         = useState(0); // refresh "il y a Xs"
  const socketRef      = useRef(null);
  const refreshRef     = useRef(null);

  // Tick every 15s for "il y a Xs" refresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  // Connexion Socket.IO
  useEffect(() => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('checkInToken');
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    socket.on('connect', () => {
      if (user) socket.emit('auth', { userId: user.id, role: user.role, token });
    });

    const joinRooms = () => {
      if (selectedEvent) {
        socket.emit('event:join', selectedEvent.id);
        socket.emit('tracking:subscribe', selectedEvent.id);
        socket.emit('tracking:subscribe', { eventId: selectedEvent.id });
      }
    };
    socket.on('auth:success', joinRooms);
    socket.on('auth:error',   joinRooms);

    const handlePosition = (data) => {
      const uid = data.userId || data.agentId;
      if (!uid) return;
      setLocations(prev => ({
        ...prev,
        [uid]: {
          ...prev[uid],
          lat: data.latitude, lng: data.longitude,
          latitude: data.latitude, longitude: data.longitude,
          accuracy: data.accuracy, altitude: data.altitude,
          speed: data.speed,
          speedKmh: data.speedKmh ?? (data.speed != null ? +(data.speed * 3.6).toFixed(1) : 0),
          heading: data.heading, isMoving: data.isMoving,
          batteryLevel: data.batteryLevel, batteryCharging: data.batteryCharging,
          batteryStatus: data.batteryStatus, batteryEstimatedTime: data.batteryEstimatedTime,
          networkType: data.networkType, networkOnline: data.networkOnline,
          networkStatus: data.networkStatus, networkDownlink: data.networkDownlink,
          networkRtt: data.networkRtt,
          deviceOS: data.deviceOS, deviceBrand: data.deviceBrand,
          deviceModel: data.deviceModel, deviceName: data.deviceName,
          deviceType: data.deviceType, deviceScreenOn: data.deviceScreenOn,
          deviceMemory: data.deviceMemory, deviceCPUCores: data.deviceCPUCores,
          deviceScreenResolution: data.deviceScreenResolution,
          isWithinGeofence: data.isWithinGeofence,
          distanceFromEvent: data.distanceFromEvent,
          isOnline: true,
          source: data.source || 'realtime',
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          user: data.user || prev[uid]?.user,
        },
      }));
    };

    socket.on('tracking:position_update', handlePosition);
    socket.on('location-update', (data) => {
      const uid = data.userId;
      if (!uid) return;
      setLocations(prev => ({
        ...prev,
        [uid]: { ...prev[uid], lat: data.latitude, lng: data.longitude,
          batteryLevel: data.batteryLevel, isOnline: true, timestamp: new Date() },
      }));
    });

    socket.on('agent-online',  uid => setLocations(prev => prev[uid] ? { ...prev, [uid]: { ...prev[uid], isOnline: true } } : prev));
    socket.on('agent-offline', uid => setLocations(prev => prev[uid] ? { ...prev, [uid]: { ...prev[uid], isOnline: false } } : prev));

    socket.on('tracking:geofence_alert', (data) => {
      setAlerts(prev => [{ ...data, id: Date.now(), time: new Date() }, ...prev].slice(0, 50));
      if (data.type === 'geofence_exit') toast.error(data.message, { autoClose: 10000 });
      else toast.success(data.message, { autoClose: 5000 });
    });
    socket.on('tracking:battery_alert', (data) => {
      setAlerts(prev => [{ ...data, id: Date.now(), time: new Date() }, ...prev].slice(0, 50));
      toast.warning(data.message, { autoClose: 8000 });
    });

    socket.on('agent:screenshot_response', ({ agentId, screenshot }) => {
      setScreenshotData({ agentId, screenshot, timestamp: new Date() });
      setScreenshotLoading(false);
    });
    socket.on('agent:screenshot_error', () => { setScreenshotLoading(false); toast.error('Capture échouée'); });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [selectedEvent?.id]);

  // Auto-refresh assignments
  useEffect(() => {
    clearInterval(refreshRef.current);
    if (!selectedEvent) return;
    loadAgents(selectedEvent.id);
    const ms = selectedEvent.status === 'active' ? 15000 : 60000;
    refreshRef.current = setInterval(() => loadAgents(selectedEvent.id), ms);
    return () => clearInterval(refreshRef.current);
  }, [selectedEvent?.id, selectedEvent?.status]);

  // Charger les événements au montage
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      console.log('🔄 Chargement des événements pour tracking...');
      // Charger événements actifs (en cours) ET scheduled (futurs)
      const response = await api.get('/events?limit=100');
      console.log('✅ API Response:', response);
      console.log('📦 response.data:', response.data);
      
      // CORRECTION: L'API retourne {success: true, data: {events: [...], pagination: {...}}}
      const eventsData = response.data?.data?.events || response.data?.events || response.data?.data || response.data || [];
      console.log('📅 Events Data extrait:', eventsData);
      console.log('📊 Type:', Array.isArray(eventsData) ? 'Array' : typeof eventsData);
      
      // S'assurer que c'est un tableau
      const eventsArray = Array.isArray(eventsData) ? eventsData : [];
      
      // Filtrer pour garder seulement les événements en cours et futurs
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Garder tous les événements actifs/futurs + ceux des 30 derniers jours
      const relevantEvents = eventsArray.filter(event => {
        const endDate = new Date(event.endDate);
        return endDate > thirtyDaysAgo; // inclure les 30 derniers jours
      }).sort((a, b) => {
        // Trier: actifs d'abord, puis par date de début décroissante
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return new Date(b.startDate) - new Date(a.startDate);
      });

      console.log('🗺️ Tracking - Tous les événements:', eventsArray.length);
      console.log('🗺️ Tracking - Événements affichés (30 jours):', relevantEvents.length);

      setEvents(relevantEvents);
      
      // Sélectionner le premier événement par défaut
      if (relevantEvents.length > 0) selectEvent(relevantEvents[0]);
    } catch (error) {
      toast.error(`Erreur: ${error.response?.data?.message || error.message}`);
      setEvents([]);
    }
  };

  const selectEvent = useCallback(async (evt) => {
    if (!evt) return;
    setSelectedEvent(evt);
    if (evt.latitude && evt.longitude) setMapCenter([parseFloat(evt.latitude), parseFloat(evt.longitude)]);
    loadAgents(evt.id);
    loadLivePositions(evt.id);
  }, []);

  const loadAgents = async (eventId) => {
    setLoading(true);
    try {
      const [aR, attR] = await Promise.allSettled([
        api.get('/assignments', { params: { eventId, limit: 200 } }),
        api.get('/attendance',  { params: { eventId, limit: 200 } }),
      ]);
      const asgns = aR.value?.data?.data?.assignments || aR.value?.data?.data || [];
      const atts  = attR.value?.data?.data?.attendances || attR.value?.data?.data || [];
      setAssignments(Array.isArray(asgns) ? asgns : []);
      setAttendance(Array.isArray(atts)  ? atts  : []);
    } catch (e) { console.warn(e?.message); }
    finally     { setLoading(false); }
  };

  const loadLivePositions = async (eventId) => {
    try {
      const r = await trackingAPI.getEventLivePositions(eventId);
      const positions = r?.data?.data || r?.data || [];
      if (!Array.isArray(positions)) return;
      const now = Date.now();
      setLocations(prev => {
        const next = { ...prev };
        positions.forEach(p => {
          const uid = p.userId || p.agentId;
          if (!uid) return;
          const ts    = new Date(p.timestamp || p.lastUpdate || now);
          const fresh = (now - ts.getTime()) < STALE_THRESHOLD_MS;
          next[uid] = {
            ...next[uid],
            lat: p.latitude, lng: p.longitude,
            latitude: p.latitude, longitude: p.longitude,
            accuracy: p.accuracy, altitude: p.altitude,
            speed: p.speed,
            speedKmh: p.speedKmh ?? (p.speed != null ? +(p.speed * 3.6).toFixed(1) : 0),
            batteryLevel: p.batteryLevel, batteryCharging: p.batteryCharging,
            batteryStatus: p.batteryStatus, networkType: p.networkType,
            networkOnline: p.networkOnline, deviceOS: p.deviceOS,
            deviceBrand: p.deviceBrand, deviceModel: p.deviceModel,
            isWithinGeofence: p.isWithinGeofence,
            distanceFromEvent: p.distanceFromEvent,
            isOnline: fresh, source: 'api', timestamp: ts,
            user: p.user || next[uid]?.user,
          };
        });
        return next;
      });
    } catch (e) { console.warn('Live positions:', e?.message); }
  };

  const loadAgentHistory = async (userId, eventId) => {
    try {
      const r = await trackingAPI.getUserHistory(userId, eventId);
      setAgentHistory(r?.data?.data || []);
      setShowHistory(true);
    } catch { toast.error('Erreur chargement historique'); }
  };

  const requestScreenshot = (agentId) => {
    setScreenshotData(null);
    setScreenshotLoading(true);
    socketRef.current?.emit('agent:screenshot_request', { agentId, requestedBy: user?.id });
    setTimeout(() => setScreenshotLoading(false), 15000);
  };

  // ── Enrichir agents avec données mobile temps réel ───────────────────────
  const enrichedAgents = assignments.map(asgn => {
    const uid = asgn.agentId || asgn.userId;
    const loc = locations[uid];
    const att = attendance.find(a => (a.agentId || a.userId) === uid);
    const now = Date.now();
    const ts  = loc?.timestamp instanceof Date ? loc.timestamp : null;
    const stale   = ts ? (now - ts.getTime()) > STALE_THRESHOLD_MS : true;
    const isOnline = loc ? (loc.isOnline && !stale) : false;
    const speedKmh = loc?.speedKmh ?? 0;

    let dist = null, inPerimeter = null;
    if (loc?.lat && loc?.lng && selectedEvent?.latitude && selectedEvent?.longitude) {
      dist = haversine(parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude), loc.lat, loc.lng);
      const radius = parseFloat(selectedEvent.geoRadius || selectedEvent.radius) || 200;
      inPerimeter = dist !== null ? dist <= radius : null;
    }
    if (loc?.isWithinGeofence != null) inPerimeter = loc.isWithinGeofence;

    const status = !isOnline ? 'offline'
      : inPerimeter === false ? 'outside_geofence'
      : 'active';

    return {
      userId: uid, asgn, att, loc,
      batteryLevel: loc?.batteryLevel ?? null,
      batteryCharging: loc?.batteryCharging ?? false,
      batteryStatus: loc?.batteryStatus ?? null,
      isMoving: loc?.isMoving ?? false,
      speedKmh, inPerimeter, dist, status, isOnline, timestamp: ts,
      user: {
        id: uid,
        firstName:    asgn.agent?.firstName || '',
        lastName:     asgn.agent?.lastName  || '',
        employeeId:   asgn.agent?.employeeId || '',
        cin:          asgn.agent?.cin || '',
        role:         asgn.agent?.role || 'agent',
        phone:        asgn.agent?.phone || asgn.agent?.phoneNumber || '',
        profilePhoto: asgn.agent?.profilePhoto || null,
      },
    };
  });

  const filteredAgents = enrichedAgents.filter(a => {
    if (!filters.showAgents      && a.user.role === 'agent')      return false;
    if (!filters.showSupervisors && a.user.role === 'supervisor')  return false;
    if (!filters.showActive      && a.status === 'active')         return false;
    if (!filters.showOutside     && a.status === 'outside_geofence') return false;
    if (!filters.showLowBattery  && (a.batteryLevel ?? 100) < 20)  return false;
    if (!filters.showOffline     && a.status === 'offline')        return false;
    return true;
  });

  const mapAgents  = filteredAgents.filter(a => a.loc?.lat && a.loc?.lng);
  const sortedAgents = [...filteredAgents].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0);
  });

  const stats = {
    total:      enrichedAgents.length,
    online:     enrichedAgents.filter(a => a.isOnline).length,
    offline:    enrichedAgents.filter(a => !a.isOnline).length,
    active:     enrichedAgents.filter(a => a.status === 'active').length,
    outside:    enrichedAgents.filter(a => a.status === 'outside_geofence').length,
    lowBattery: enrichedAgents.filter(a => (a.batteryLevel ?? 100) < 20).length,
    moving:     enrichedAgents.filter(a => a.isMoving).length,
    withPos:    mapAgents.length,
  };

  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

  return (
    <div className={`${isFullScreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : ''}`}>

      {/* ── Modal envoi message ──────────────────────────────────────────── */}
      {msgTarget && (
        <SendMessageModal target={msgTarget} socket={socketRef.current} onClose={() => setMsgTarget(null)} />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiMapPin className="text-blue-600" />
              Suivi GPS Temps Réel
              {selectedEvent?.status === 'active' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-semibold animate-pulse">
                  <span className="w-2 h-2 bg-red-500 rounded-full" /> EN DIRECT
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? '🔄 Chargement…' : `${stats.total} affectés · `}
              <span className="text-green-600 font-medium">{stats.online} en ligne</span>
              {stats.moving > 0 && <span className="ml-2 text-blue-600">· {stats.moving} en mvt</span>}
              {stats.outside > 0 && <span className="ml-2 text-red-500 animate-pulse">· {stats.outside} hors zone ⚠</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedEvent && (
              <button
                onClick={() => setMsgTarget({ type: 'event', id: selectedEvent.id, name: selectedEvent.name })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FiMessageSquare size={13} /> Message à tous
              </button>
            )}
            <select
              value={selectedEvent?.id || ''}
              onChange={e => {
                const ev = events.find(x => String(x.id) === String(e.target.value));
                if (ev) selectEvent(ev);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Événement --</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.status === 'active' ? '🟢 ' : '⚫ '}{ev.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => { loadEvents(); if (selectedEvent) { loadAgents(selectedEvent.id); loadLivePositions(selectedEvent.id); } }}
              className={`p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}
              title="Rafraîchir"
            >
              <FiRefreshCw size={15} />
            </button>
            <button onClick={() => setIsFullScreen(f => !f)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg" title="Plein écran">
              <FiMaximize2 size={15} />
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-4">
          {[
            { label: 'Total',     value: stats.total,      bg: 'bg-slate-50',   border: 'border-slate-200',   val: 'text-slate-900' },
            { label: 'En ligne',  value: stats.online,     bg: 'bg-green-50',   border: 'border-green-200',   val: 'text-green-900' },
            { label: 'Hors lig.', value: stats.offline,    bg: 'bg-gray-50',    border: 'border-gray-300',    val: 'text-gray-700' },
            { label: 'Sur carte', value: stats.withPos,    bg: 'bg-blue-50',    border: 'border-blue-200',    val: 'text-blue-900' },
            { label: 'Actifs',    value: stats.active,     bg: 'bg-emerald-50', border: 'border-emerald-200', val: 'text-emerald-900' },
            { label: 'Hors zone', value: stats.outside,    bg: 'bg-red-50',     border: 'border-red-200',     val: 'text-red-900' },
            { label: 'Batt ⚠',   value: stats.lowBattery, bg: 'bg-orange-50',  border: 'border-orange-200',  val: 'text-orange-900' },
            { label: 'En mvt',    value: stats.moving,     bg: 'bg-indigo-50',  border: 'border-indigo-200',  val: 'text-indigo-900' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-lg p-2.5`}>
              <p className="text-xs font-medium text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.val}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { key: 'showAgents',      label: 'Agents',       cls: 'bg-purple-600' },
            { key: 'showSupervisors', label: 'Responsables', cls: 'bg-indigo-600' },
            { key: 'showActive',      label: '✅ Actifs',     cls: 'bg-green-600'  },
            { key: 'showOutside',     label: '⚠ Hors zone',  cls: 'bg-red-600'    },
            { key: 'showOffline',     label: '⚫ Hors ligne', cls: 'bg-gray-600'   },
            { key: 'showLowBattery',  label: '🔋 Batt faible',cls: 'bg-orange-600'},
          ].map(f => (
            <button key={f.key}
              onClick={() => setFilters(p => ({ ...p, [f.key]: !p[f.key] }))}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filters[f.key] ? `${f.cls} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Carte + Panneau agent ─────────────────────────────────────────── */}
      <div className="flex" style={{ height: isFullScreen ? 'calc(100vh - 230px)' : 560 }}>
        {/* Carte */}
        <div className="flex-1 relative">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap center={mapCenter} />

            {/* Périmètre */}
            {selectedEvent?.latitude && selectedEvent?.longitude && (
              <>
                <Circle
                  center={[parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)]}
                  radius={parseFloat(selectedEvent.geoRadius || selectedEvent.radius) || 200}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.07, weight: 2, dashArray: '6 10' }}
                />
                <Marker position={[parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)]}>
                  <Popup>
                    <strong>{selectedEvent.name}</strong><br />
                    <span className="text-xs text-gray-500">{selectedEvent.location}</span><br />
                    <span className="text-xs">Rayon : {selectedEvent.geoRadius || 200}m</span>
                  </Popup>
                </Marker>
              </>
            )}

            {/* Markers agents */}
            {mapAgents.map(a => (
              <Marker
                key={a.userId}
                position={[a.loc.lat, a.loc.lng]}
                icon={createAgentIcon({ ...a, batteryLevel: a.batteryLevel ?? 100 })}
                eventHandlers={{ click: () => { setSelectedAgent(a); setShowHistory(false); setAgentHistory([]); } }}
              >
                <Popup>
                  <div style={{ minWidth: 210 }}>
                    <div className="font-bold text-base mb-1">{a.user.firstName} {a.user.lastName}</div>
                    <div className="text-xs text-gray-500 mb-2">{a.user.cin} · {a.user.role === 'supervisor' ? 'Responsable' : 'Agent'}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="text-gray-500">Statut</span>
                      <span className={`font-semibold ${a.isOnline ? (a.status === 'outside_geofence' ? 'text-red-600' : 'text-green-600') : 'text-gray-500'}`}>
                        {a.isOnline ? (a.status === 'outside_geofence' ? '⚠ Hors zone' : '🟢 En ligne') : '⚫ Hors ligne'}
                      </span>
                      <span className="text-gray-500">Batterie</span>
                      <span>{a.batteryCharging ? '⚡ ' : ''}{a.batteryLevel ?? '—'}%</span>
                      <span className="text-gray-500">Vitesse</span>
                      <span>{a.speedKmh > 1 ? `${a.speedKmh} km/h` : '🛑 Arrêté'}</span>
                      <span className="text-gray-500">Précision GPS</span>
                      <span>{a.loc?.accuracy != null ? `±${Math.round(a.loc.accuracy)}m` : '—'}</span>
                      <span className="text-gray-500">Réseau</span>
                      <span>{a.loc?.networkType || '—'}</span>
                      <span className="text-gray-500">Appareil</span>
                      <span>{a.loc?.deviceModel || a.loc?.deviceBrand || '—'}</span>
                      <span className="text-gray-500">Mise à jour</span>
                      <span>{ago(a.timestamp)}</span>
                    </div>
                    <div className="flex gap-1 mt-3">
                      <button
                        onClick={() => { setSelectedAgent(a); loadAgentHistory(a.userId, selectedEvent?.id); }}
                        className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded font-medium"
                      >📊 Historique</button>
                      <button
                        onClick={() => setMsgTarget({ type: 'user', id: a.userId, name: `${a.user.firstName} ${a.user.lastName}` })}
                        className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded font-medium"
                      >💬 Message</button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Trajet historique */}
            {showHistory && agentHistory.length > 1 && (
              <Polyline positions={agentHistory.map(p => [p.latitude, p.longitude])}
                pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7 }} />
            )}
          </MapContainer>

          {/* Alertes flottantes */}
          {alerts.length > 0 && (
            <div className="absolute top-3 right-3 w-80 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 z-[1000]">
              <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  <FiAlertTriangle className="text-red-500" /> Alertes ({alerts.length})
                </span>
                <button onClick={() => setAlerts([])} className="text-gray-400 hover:text-gray-700"><FiX size={15} /></button>
              </div>
              {alerts.map((a, i) => (
                <div key={a.id || i} className={`px-3 py-2 text-xs border-l-4 ${
                  a.type === 'geofence_exit' ? 'bg-red-50 border-red-400' :
                  a.type === 'geofence_return' ? 'bg-green-50 border-green-400' :
                  'bg-orange-50 border-orange-400'}`}>
                  <div className="font-medium">{a.message || a.type}</div>
                  <div className="text-gray-400 mt-0.5">{ago(a.time || a.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Panneau info agent (droite) ───────────────────────────────── */}
        {selectedAgent && (
          <div className="w-80 border-l overflow-y-auto bg-gray-50 flex-shrink-0">
            <AgentInfoPanel
              agent={{
                ...selectedAgent.loc,
                userId: selectedAgent.userId,
                user: selectedAgent.user,
                batteryLevel: selectedAgent.batteryLevel,
                batteryCharging: selectedAgent.batteryCharging,
              }}
              stats={null}
              eventRadius={parseFloat(selectedEvent?.geoRadius || selectedEvent?.radius) || 200}
              onClose={() => { setSelectedAgent(null); setShowHistory(false); setAgentHistory([]); }}
              onScreenshot={requestScreenshot}
              screenshotData={screenshotData}
              screenshotLoading={screenshotLoading}
            />
            <div className="flex gap-2 px-3 pb-3">
              <button
                onClick={() => loadAgentHistory(selectedAgent.userId, selectedEvent?.id)}
                className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-1"
              >
                <FiActivity size={12} /> Historique trajet
              </button>
              <button
                onClick={() => setMsgTarget({ type: 'user', id: selectedAgent.userId,
                  name: `${selectedAgent.user.firstName} ${selectedAgent.user.lastName}` })}
                className="flex-1 py-2 text-xs bg-emerald-600 text-white rounded-lg font-medium flex items-center justify-center gap-1"
              >
                <FiMessageSquare size={12} /> Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tableau agents enrichi ─────────────────────────────────────────── */}
      {selectedEvent && assignments.length > 0 && (
        <div className="bg-white border-t">
          <button
            onClick={() => setTableOpen(o => !o)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 border-b"
          >
            <span className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiUsers className="text-blue-600" />
              Agents — {selectedEvent.name}
              <span className="text-sm font-normal text-gray-500">({stats.online}/{stats.total} en ligne)</span>
            </span>
            {tableOpen ? <FiChevronUp /> : <FiChevronDown />}
          </button>

          {tableOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Position GPS</th>
                    <th className="px-4 py-3">Précision</th>
                    <th className="px-4 py-3">Vitesse</th>
                    <th className="px-4 py-3">Batterie</th>
                    <th className="px-4 py-3">Réseau</th>
                    <th className="px-4 py-3">Appareil</th>
                    <th className="px-4 py-3">Périmètre</th>
                    <th className="px-4 py-3">Pointage</th>
                    <th className="px-4 py-3">Mise à jour</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedAgents.map(a => {
                    const loc = a.loc;
                    return (
                      <tr
                        key={a.userId}
                        className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${selectedAgent?.userId === a.userId ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedAgent(a)}
                      >
                        {/* Agent */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-shrink-0">
                              {a.user.profilePhoto ? (
                                <img src={a.user.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                  {a.user.firstName?.[0]}{a.user.lastName?.[0]}
                                </div>
                              )}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${a.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{a.user.firstName} {a.user.lastName}</div>
                              <div className="text-xs text-gray-400">{a.user.cin} · {a.user.role === 'supervisor' ? 'Resp.' : 'Agent'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                            a.status === 'active'           ? 'bg-green-100 text-green-700' :
                            a.status === 'outside_geofence' ? 'bg-red-100 text-red-700 animate-pulse' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-green-500' : a.status === 'outside_geofence' ? 'bg-red-500' : 'bg-gray-400'}`} />
                            {a.status === 'active' ? 'En ligne' : a.status === 'outside_geofence' ? 'Hors zone' : 'Hors ligne'}
                          </span>
                          {a.isMoving && a.isOnline && <div className="text-xs text-blue-500 mt-0.5">🚶 En mvt</div>}
                        </td>

                        {/* Position GPS */}
                        <td className="px-4 py-3 font-mono text-xs">
                          {loc?.lat ? (
                            <button className="text-blue-600 hover:underline text-left"
                              onClick={e => { e.stopPropagation(); setMapCenter([loc.lat, loc.lng]); }}
                              title="Centrer carte">
                              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                            </button>
                          ) : <span className="text-gray-400">—</span>}
                        </td>

                        {/* Précision GPS */}
                        <td className="px-4 py-3 text-xs">
                          {loc?.accuracy != null ? (
                            <span className={`font-medium ${loc.accuracy < 20 ? 'text-green-600' : loc.accuracy < 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                              ±{Math.round(loc.accuracy)}m
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>

                        {/* Vitesse */}
                        <td className="px-4 py-3 text-xs">
                          {a.isOnline
                            ? (a.speedKmh > 1 ? <span className="text-blue-600 font-medium">{a.speedKmh} km/h</span> : <span className="text-gray-500">🛑 Arrêté</span>)
                            : <span className="text-gray-400">—</span>}
                        </td>

                        {/* Batterie */}
                        <td className="px-4 py-3">
                          <BatteryBadge level={a.batteryLevel} charging={a.batteryCharging} />
                          {a.batteryStatus && a.isOnline && <div className="text-xs text-gray-400 mt-0.5">{a.batteryStatus}</div>}
                        </td>

                        {/* Réseau */}
                        <td className="px-4 py-3">
                          <NetworkBadge type={loc?.networkType} online={loc?.networkOnline} />
                          {loc?.networkDownlink && <div className="text-xs text-gray-400 mt-0.5">{loc.networkDownlink} Mb/s</div>}
                        </td>

                        {/* Appareil */}
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1">
                            <FiSmartphone size={11} className="text-gray-400" />
                            <span className="text-gray-700 font-medium">{loc?.deviceModel || loc?.deviceBrand || '—'}</span>
                          </div>
                          {loc?.deviceOS && <div className="text-gray-400 mt-0.5">{loc.deviceOS}</div>}
                        </td>

                        {/* Périmètre */}
                        <td className="px-4 py-3 text-center text-xs">
                          {a.inPerimeter === null || !a.isOnline ? (
                            <span className="text-gray-400">—</span>
                          ) : a.inPerimeter ? (
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">✓ Dans zone</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium animate-pulse whitespace-nowrap">
                              ⚠ Hors{a.dist != null ? ` +${a.dist}m` : ''}
                            </span>
                          )}
                        </td>

                        {/* Pointage */}
                        <td className="px-4 py-3 text-xs">
                          {a.att?.checkInTime ? (
                            <div>
                              <div className="text-green-600 font-medium">↑ {new Date(a.att.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                              {a.att.checkOutTime && <div className="text-orange-600 font-medium">↓ {new Date(a.att.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
                            </div>
                          ) : <span className="text-gray-400">Non pointé</span>}
                        </td>

                        {/* Mise à jour */}
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {ago(a.timestamp)}
                          {loc?.source === 'background' && <div className="text-xs text-purple-500 mt-0.5">⚙ arrière-plan</div>}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setMsgTarget({ type: 'user', id: a.userId, name: `${a.user.firstName} ${a.user.lastName}` })}
                              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                              title="Envoyer message"
                            ><FiMessageSquare size={12} /></button>
                            <button
                              onClick={() => { setSelectedAgent(a); loadAgentHistory(a.userId, selectedEvent?.id); }}
                              className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                              title="Historique"
                            ><FiActivity size={12} /></button>
                            {loc?.lat && (
                              <button
                                onClick={() => setMapCenter([loc.lat, loc.lng])}
                                className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                                title="Centrer carte"
                              ><FiNavigation size={12} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AlertsPanel eventId={selectedEvent?.id} token={token} />
    </div>
  );
};

export default RealTimeTracking;
