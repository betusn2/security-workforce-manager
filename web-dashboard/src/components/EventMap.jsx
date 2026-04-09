/**
 * EventMap.jsx — Carte professionnelle temps réel pour EventDetails
 * Features:
 *  - 4 fonds de carte (Plan, Satellite, Hybride, Topo) avec switcher flottant
 *  - Marqueur événement avec Tooltip + Popup détaillé
 *  - Cercle de périmètre animé
 *  - Zones colorées avec Tooltip nom + Popup détails
 *  - Marqueurs agents (initiales, couleur statut, pulse live) avec Tooltip + Popup riche
 *  - FlyTo animé lorsqu'un agent est sélectionné dans le tableau
 *  - Légende flottante bas-gauche
 *  - Badges stats (en ligne, GPS actifs) haut-gauche
 *  - Bouton recentrer + ScaleControl
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  MapContainer, TileLayer, Circle, Marker, Popup, Tooltip, useMap, ScaleControl
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Fix Leaflet default icons ────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── Tile layers ──────────────────────────────────────────────────────────────
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    label: '🗺️ Plan',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; Maxar Technologies',
    label: '🛰️ Satellite',
  },
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlay: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; Esri &copy; CARTO',
    label: '🛰️ Hybride',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    label: '⛰️ Topo',
  },
};

// ─── Zone color palette ───────────────────────────────────────────────────────
const ZONE_PALETTE = [
  { color: '#6366f1', fill: '#e0e7ff', opacity: 0.18 },
  { color: '#10b981', fill: '#d1fae5', opacity: 0.18 },
  { color: '#f59e0b', fill: '#fef3c7', opacity: 0.18 },
  { color: '#ef4444', fill: '#fee2e2', opacity: 0.18 },
  { color: '#8b5cf6', fill: '#ede9fe', opacity: 0.18 },
  { color: '#06b6d4', fill: '#cffafe', opacity: 0.18 },
  { color: '#f97316', fill: '#ffedd5', opacity: 0.18 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180, p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTimeAgo(timestamp) {
  if (!timestamp) return null;
  const s = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? m % 60 + 'min' : ''}`;
}

function batteryColor(lvl) {
  if (lvl >= 50) return '#10b981';
  if (lvl >= 20) return '#f59e0b';
  return '#ef4444';
}

function networkIcon(type) {
  if (!type) return '📡';
  const t = type.toLowerCase();
  if (t.includes('wifi') || t.includes('wi-fi') || t.includes('wlan')) return '📶';
  if (t.includes('4g') || t.includes('lte')) return '4️⃣G';
  if (t.includes('5g')) return '5️⃣G';
  if (t.includes('3g')) return '3️⃣G';
  if (t.includes('2g') || t.includes('edge')) return '2️⃣G';
  return '📡';
}

// ─── Sub-component: FlyTo on agent selection ──────────────────────────────────
function FlyToAgent({ agentId, agentLocations }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!agentId) return;
    if (agentId === prev.current) return;
    const loc = agentLocations[agentId];
    if (!loc?.lat || !loc?.lng) return;
    prev.current = agentId;
    map.flyTo([loc.lat, loc.lng], 17, { duration: 1.3, easeLinearity: 0.4 });
  }, [agentId, agentLocations, map]);
  return null;
}

// ─── Sub-component: Initial fit bounds ───────────────────────────────────────
function InitialFit({ center, radius }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !center) return;
    done.current = true;
    // Fit to perimeter circle
    if (radius) {
      const r = parseInt(radius);
      const bounds = [
        [center[0] - r / 111320, center[1] - r / (111320 * Math.cos((center[0] * Math.PI) / 180))],
        [center[0] + r / 111320, center[1] + r / (111320 * Math.cos((center[0] * Math.PI) / 180))],
      ];
      setTimeout(() => map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 }), 300);
    }
  }, []);
  return null;
}

// ─── Custom DivIcon: Event center ────────────────────────────────────────────
function createEventCenterIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:40px;height:40px;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          width:52px;height:52px;border-radius:50%;
          border:2px solid rgba(99,102,241,0.35);
          animation:evtRingAnim 2.5s ease-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          width:40px;height:40px;border-radius:50%;
          background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);
          border:3px solid white;
          box-shadow:0 4px 16px rgba(99,102,241,0.5);
          display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5">
            <path d="M3 3h18v12H3z"/><path d="M3 15l9 6 9-6"/>
          </svg>
        </div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -26],
  });
}

// ─── Custom DivIcon: Agent marker ────────────────────────────────────────────
function createAgentIcon(firstName = '?', lastName = '?', isOnline = false, inPerimeter = true, battery = null) {
  const initials = `${firstName[0] || '?'}${lastName[0] || '?'}`.toUpperCase();
  const statusColor = !isOnline ? '#9ca3af' : (inPerimeter ? '#10b981' : '#ef4444');
  const pulse = isOnline
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:50px;height:50px;border-radius:50%;
        background:${statusColor};opacity:0.18;
        animation:agentPulseAnim 1.8s ease-out infinite;"></div>
       <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:42px;height:42px;border-radius:50%;
        background:${statusColor};opacity:0.12;
        animation:agentPulseAnim 1.8s 0.6s ease-out infinite;"></div>`
    : '';

  // Battery mini-bar at the bottom edge of the icon
  const battBar = battery != null
    ? `<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:28px;height:4px;border-radius:99px;background:#e5e7eb;overflow:hidden;
        box-shadow:0 1px 3px rgba(0,0,0,0.2);">
        <div style="height:4px;border-radius:99px;width:${Math.max(5, battery)}%;
          background:${batteryColor(battery)};"></div>
      </div>`
    : '';

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;">
        ${pulse}
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          width:36px;height:36px;border-radius:50%;
          background:white;
          border:3px solid ${statusColor};
          box-shadow:0 3px 12px rgba(0,0,0,0.2);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:800;color:#1f2937;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          letter-spacing:-0.5px;">
          ${initials}
        </div>
        ${battBar}
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -26],
  });
}

// ─── CSS keyframes string ─────────────────────────────────────────────────────
const MAP_STYLES = `
  @keyframes evtRingAnim {
    0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
    100% { transform: translate(-50%,-50%) scale(1.9); opacity: 0; }
  }
  @keyframes agentPulseAnim {
    0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.25; }
    100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0;    }
  }
  .leaflet-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .leaflet-control-zoom {
    border-radius: 12px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
    border: 1px solid rgba(255,255,255,0.8) !important;
    overflow: hidden;
  }
  .leaflet-control-zoom-in,
  .leaflet-control-zoom-out {
    background: rgba(255,255,255,0.92) !important;
    color: #374151 !important;
    font-weight: 700 !important;
    transition: all 0.2s !important;
    border-bottom-color: rgba(226,232,240,0.6) !important;
  }
  .leaflet-control-zoom-in:hover,
  .leaflet-control-zoom-out:hover {
    background: #6366f1 !important;
    color: white !important;
  }
  .leaflet-popup-content-wrapper {
    border-radius: 14px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important;
    border: 1px solid rgba(226,232,240,0.6) !important;
    padding: 0 !important;
    overflow: hidden;
  }
  .leaflet-popup-content { margin: 0 !important; }
  .leaflet-popup-tip-container { display: none; }
  .leaflet-tooltip {
    border-radius: 8px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.14) !important;
    border: 1px solid rgba(226,232,240,0.7) !important;
    font-size: 12px !important;
    padding: 5px 10px !important;
    background: rgba(255,255,255,0.96) !important;
    backdrop-filter: blur(8px);
  }
  .leaflet-scale-line {
    border: 2px solid rgba(55,65,81,0.6) !important;
    border-top: none !important;
    background: rgba(255,255,255,0.8) !important;
    border-radius: 0 0 4px 4px !important;
    color: #374151 !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    padding: 1px 4px !important;
  }
`;

// ─── Agent Popup content (pure HTML) ─────────────────────────────────────────
function AgentPopupContent({ agent, loc, isOnline, inPerimeter, distance }) {
  const battery = loc.battery ?? loc.batteryLevel;
  const lastSeen = getTimeAgo(loc.timestamp);
  const name = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Agent';
  const statusTxt = isOnline ? '🟢 En ligne' : '⚫ Hors ligne';
  const perimTxt = inPerimeter ? '✅ Dans périmètre' : '⚠️ Hors périmètre';
  const distTxt = distance != null ? (distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(2)}km`) : null;

  return (
    <div style={{ width: 260, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        padding: '12px 14px 10px',
        color: 'white',
      }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{name}</div>
        {agent.employeeId && <div style={{ fontSize: 11, opacity: 0.85 }}>#{agent.employeeId}</div>}
        <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 8 }}>
          <span>{statusTxt}</span>
          <span>{perimTxt}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>

        {/* Battery */}
        {battery != null && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11, color: '#6b7280' }}>
              <span>🔋 Batterie{loc.batteryCharging ? ' ⚡' : ''}</span>
              <span style={{ fontWeight: 700, color: batteryColor(battery) }}>{battery}%</span>
            </div>
            <div style={{ height: 5, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: 5, width: `${battery}%`, background: batteryColor(battery), borderRadius: 99, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}

        {/* Network */}
        {loc.networkType && (
          <div style={{ fontSize: 11, color: '#374151', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{networkIcon(loc.networkType)}</span>
            <span style={{ fontWeight: 600 }}>{loc.networkType}</span>
            {loc.networkDownlink && <span style={{ color: '#9ca3af' }}>↓{loc.networkDownlink}Mbps</span>}
            {loc.networkRtt && <span style={{ color: '#9ca3af' }}>RTT {loc.networkRtt}ms</span>}
          </div>
        )}

        {/* Device */}
        {(loc.deviceOS || loc.deviceType) && (
          <div style={{ fontSize: 11, color: '#374151', display: 'flex', gap: 6 }}>
            {loc.deviceOS && <span>📱 {loc.deviceOS}</span>}
            {loc.deviceType && <span style={{ color: '#9ca3af' }}>• {loc.deviceType}</span>}
          </div>
        )}

        {/* GPS */}
        {loc.lat && loc.lng && (
          <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', background: '#f9fafb', borderRadius: 6, padding: '3px 6px' }}>
            {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
            {loc.accuracy ? ` ±${Math.round(loc.accuracy)}m` : ''}
            {loc.speedKmh > 0 ? ` · ${loc.speedKmh}km/h` : ''}
          </div>
        )}

        {/* Distance + last seen */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
          {distTxt && <span>📏 {distTxt} du site</span>}
          {lastSeen && <span>🕐 il y a {lastSeen}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Event Popup content ──────────────────────────────────────────────────────
function EventPopupContent({ event, zonesCount, agentsCount }) {
  const start = event.startDate ? format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr }) : '—';
  const time = `${event.checkInTime?.substring(0, 5) || '00:00'} → ${event.checkOutTime?.substring(0, 5) || '00:00'}`;
  return (
    <div style={{ width: 240, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        padding: '12px 14px 10px',
        color: 'white',
      }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{event.name}</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>📍 {event.location}</div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div><span style={{ color: '#9ca3af' }}>📅</span> {start}</div>
          <div><span style={{ color: '#9ca3af' }}>⏰</span> {time}</div>
        </div>
        {event.radius && (
          <div style={{ color: '#374151' }}>🎯 Périmètre: <strong>{event.radius}m</strong></div>
        )}
        <div style={{ display: 'flex', gap: 16, color: '#374151' }}>
          <div>🗂️ <strong>{zonesCount}</strong> zone{zonesCount !== 1 ? 's' : ''}</div>
          <div>👮 <strong>{agentsCount}</strong> agent{agentsCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const EventMap = ({
  event,
  zones = [],
  agentLocations = {},
  assignments = [],
  onlineAgents = new Set(),
  flyToAgentId,
  onAgentClick,
  height = '620px',
}) => {
  const mapRef = useRef(null);
  const [mapTile, setMapTile] = useState('street');
  const [showLegend, setShowLegend] = useState(true);

  // Memoized center & zoom
  const eventCenter = useMemo(() => {
    if (!event?.latitude || !event?.longitude) return null;
    return [parseFloat(event.latitude), parseFloat(event.longitude)];
  }, [event?.latitude, event?.longitude]);

  const eventZoom = useMemo(() => {
    if (!event?.radius) return 15;
    const r = parseInt(event.radius);
    // Approximate: log2 scale based on radius
    return Math.max(12, Math.min(17, Math.round(15.5 - Math.log2(r / 200))));
  }, [event?.radius]);

  const eventIcon = useMemo(() => createEventCenterIcon(), []);

  // Precompute inPerimeter for each agent
  const agentData = useMemo(() => {
    return Object.entries(agentLocations).map(([agentId, loc]) => {
      if (!loc.lat || !loc.lng) return null;
      const assignment = assignments.find(a => a.agentId === agentId);
      const agent = { ...(assignment?.agent || {}), ...(loc.user || {}) };
      const isOnline = onlineAgents.has(agentId);
      let inPerimeter = true;
      let distance = null;
      if (eventCenter && event?.radius) {
        distance = haversine(eventCenter[0], eventCenter[1], loc.lat, loc.lng);
        inPerimeter = distance <= parseInt(event.radius);
      }
      const battery = loc.battery ?? loc.batteryLevel ?? null;
      return { agentId, loc, agent, isOnline, inPerimeter, distance, battery };
    }).filter(Boolean);
  }, [agentLocations, assignments, onlineAgents, eventCenter, event?.radius]);

  const onlineCount = onlineAgents.size;
  const agentsWithGPS = agentData.length;
  const outOfPerimeterCount = agentData.filter(d => d.isOnline && !d.inPerimeter).length;

  if (!eventCenter) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border border-gray-200">
        Coordonnées GPS de l'événement manquantes
      </div>
    );
  }

  const recenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(eventCenter, eventZoom, { duration: 0.9 });
    }
  };

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0' }}>
      <style>{MAP_STYLES}</style>

      {/* ── Leaflet Map ── */}
      <MapContainer
        ref={mapRef}
        center={eventCenter}
        zoom={eventZoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom
        zoomControl
        zoomControlPosition="topleft"
        attributionControl={false}
      >
        {/* Tile layers */}
        <TileLayer
          key={mapTile}
          url={TILE_LAYERS[mapTile].url}
          attribution={TILE_LAYERS[mapTile].attribution}
          maxZoom={20}
        />
        {mapTile === 'hybrid' && (
          <TileLayer url={TILE_LAYERS.hybrid.overlay} attribution="" />
        )}

        {/* Scale */}
        <ScaleControl position="bottomright" imperial={false} maxWidth={120} />

        {/* FlyTo on agent selection */}
        <FlyToAgent agentId={flyToAgentId} agentLocations={agentLocations} />

        {/* Initial fit to perimeter */}
        <InitialFit center={eventCenter} radius={event.radius} />

        {/* ── Event perimeter circle ── */}
        {event.radius && (
          <Circle
            center={eventCenter}
            radius={parseInt(event.radius)}
            pathOptions={{
              color: '#6366f1',
              fillColor: '#6366f1',
              fillOpacity: 0.05,
              weight: 2.5,
              dashArray: '10 6',
              opacity: 0.7,
            }}
          />
        )}

        {/* ── Event center marker ── */}
        <Marker position={eventCenter} icon={eventIcon} zIndexOffset={500}>
          <Tooltip direction="top" offset={[0, -22]} opacity={1}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{event.name}</div>
            {event.radius && <div style={{ fontSize: 11, color: '#6b7280' }}>Périmètre: {event.radius}m</div>}
          </Tooltip>
          <Popup autoPan={false}>
            <EventPopupContent
              event={event}
              zonesCount={zones.length}
              agentsCount={assignments.length}
            />
          </Popup>
        </Marker>

        {/* ── Zone circles ── */}
        {zones.map((zone, idx) => {
          if (!zone.latitude || !zone.longitude) return null;
          const palette = ZONE_PALETTE[idx % ZONE_PALETTE.length];
          return (
            <React.Fragment key={`zone-${zone.id || idx}`}>
              <Circle
                center={[parseFloat(zone.latitude), parseFloat(zone.longitude)]}
                radius={parseInt(zone.radius) || 300}
                pathOptions={{
                  color: palette.color,
                  fillColor: palette.fill,
                  fillOpacity: palette.opacity,
                  weight: 2,
                  dashArray: '8 5',
                  opacity: 0.75,
                }}
              >
                <Tooltip sticky direction="top" opacity={1}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>📍 {zone.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Rayon: {zone.radius || 300}m</div>
                  {zone.description && <div style={{ fontSize: 11, color: '#9ca3af', maxWidth: 180 }}>{zone.description}</div>}
                </Tooltip>
                <Popup autoPan={false}>
                  <div style={{ padding: '10px 14px', fontFamily: '-apple-system,sans-serif', minWidth: 180 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: palette.color }}>
                      📍 {zone.name}
                    </div>
                    {zone.description && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{zone.description}</div>
                    )}
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 12 }}>
                      <span>🎯 {zone.radius || 300}m rayon</span>
                    </div>
                  </div>
                </Popup>
              </Circle>
            </React.Fragment>
          );
        })}

        {/* ── Agent markers ── */}
        {agentData.map(({ agentId, loc, agent, isOnline, inPerimeter, distance, battery }) => {
          const icon = createAgentIcon(
            agent.firstName || '?',
            agent.lastName || '?',
            isOnline,
            inPerimeter,
            battery
          );
          const name = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Agent';
          const statusBadge = isOnline ? '🟢' : '⚫';
          return (
            <Marker
              key={`agent-${agentId}`}
              position={[loc.lat, loc.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onAgentClick?.(agentId),
              }}
            >
              <Tooltip direction="top" offset={[0, -22]} opacity={1}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>
                  {statusBadge} {name}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {battery != null ? `🔋 ${battery}%` : ''}{loc.networkType ? `  ${networkIcon(loc.networkType)} ${loc.networkType}` : ''}
                </div>
              </Tooltip>
              <Popup autoPan={false} maxWidth={280} minWidth={260}>
                <AgentPopupContent
                  agent={agent}
                  loc={loc}
                  isOnline={isOnline}
                  inPerimeter={inPerimeter}
                  distance={distance}
                />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── OVERLAY: Tile switcher (top-right) ── */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(TILE_LAYERS).map(([key, tile]) => (
          <button
            key={key}
            onClick={() => setMapTile(key)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 10,
              border: mapTile === key ? '2px solid #6366f1' : '1px solid rgba(226,232,240,0.8)',
              background: mapTile === key
                ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                : 'rgba(255,255,255,0.92)',
              color: mapTile === key ? 'white' : '#374151',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: mapTile === key
                ? '0 4px 14px rgba(99,102,241,0.4)'
                : '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tile.label}
          </button>
        ))}
      </div>

      {/* ── OVERLAY: Stats badges (top-left, offset from zoom controls) ── */}
      <div style={{ position: 'absolute', top: 14, left: 90, zIndex: 1000, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {onlineCount > 0 && (
          <div style={{
            padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 99,
            background: 'rgba(16,185,129,0.9)', color: 'white',
            boxShadow: '0 2px 8px rgba(16,185,129,0.4)', backdropFilter: 'blur(6px)',
          }}>
            🟢 {onlineCount} en ligne
          </div>
        )}
        {agentsWithGPS > 0 && (
          <div style={{
            padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 99,
            background: 'rgba(99,102,241,0.88)', color: 'white',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)', backdropFilter: 'blur(6px)',
          }}>
            📍 {agentsWithGPS} GPS
          </div>
        )}
        {outOfPerimeterCount > 0 && (
          <div style={{
            padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 99,
            background: 'rgba(239,68,68,0.88)', color: 'white',
            boxShadow: '0 2px 8px rgba(239,68,68,0.35)', backdropFilter: 'blur(6px)',
            animation: 'agentPulseAnim 1.5s ease-out infinite',
          }}>
            ⚠️ {outOfPerimeterCount} hors zone
          </div>
        )}
      </div>

      {/* ── OVERLAY: Legend (bottom-left) ── */}
      {showLegend && (
        <div style={{
          position: 'absolute', bottom: 40, left: 14, zIndex: 1000,
          background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(226,232,240,0.8)', borderRadius: 12,
          padding: '10px 13px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          fontSize: 11, fontWeight: 500, color: '#374151',
          display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160,
        }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2, color: '#1f2937' }}>Légende</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: '2px solid white', boxShadow: '0 1px 4px rgba(99,102,241,0.4)' }} />
            Événement
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#e0e7ff', border: '2px dashed #6366f1' }} />
            Périmètre
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', border: '2.5px solid #10b981', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#1f2937' }}>AB</div>
            Agent en ligne
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', border: '2.5px solid #ef4444', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#1f2937' }}>AB</div>
            Agent hors zone
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', border: '2.5px solid #9ca3af' }} />
            Agent hors ligne
          </div>
          {zones.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#d1fae5', border: '2px dashed #10b981' }} />
              Zone de patrouille
            </div>
          )}
        </div>
      )}

      {/* Toggle legend */}
      <button
        onClick={() => setShowLegend(v => !v)}
        style={{
          position: 'absolute', bottom: 10, left: 14, zIndex: 1001,
          background: showLegend ? '#6366f1' : 'rgba(255,255,255,0.92)',
          color: showLegend ? 'white' : '#374151',
          border: '1px solid rgba(226,232,240,0.8)',
          borderRadius: 8, padding: '4px 8px',
          fontSize: 10, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {showLegend ? '▲ Masquer légende' : '▼ Afficher légende'}
      </button>

      {/* ── OVERLAY: Recenter button ── */}
      <button
        onClick={recenter}
        title="Recentrer sur l'événement"
        style={{
          position: 'absolute', bottom: 60, right: 14, zIndex: 1000,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10,
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontSize: 16, color: '#6366f1',
          transition: 'all 0.2s',
        }}
      >
        ⊕
      </button>

      {/* ── OVERLAY: Attribution (bottom-right, above scale) ── */}
      <div style={{
        position: 'absolute', bottom: 30, right: 150, zIndex: 999,
        fontSize: 9, color: '#9ca3af', pointerEvents: 'none',
      }}>
        {TILE_LAYERS[mapTile].attribution.replace(/<[^>]*>/g, '')}
      </div>
    </div>
  );
};

export default EventMap;
