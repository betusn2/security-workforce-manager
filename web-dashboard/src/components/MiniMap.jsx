import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FiMapPin, FiNavigation, FiCrosshair, FiTruck, FiUser as FiWalk } from 'react-icons/fi';
import styles from './MiniMap.module.css';

// ============================================================================
// LEAFLET ICON CONFIGURATION
// ============================================================================

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Create a custom event marker icon with pulse animation
 * @param {string} color - Hex color for the marker
 * @returns {L.DivIcon} Leaflet DivIcon instance
 */
const createEventIcon = (color = '#8B5CF6') => L.divIcon({
  className: 'event-marker-icon',
  html: `
    <div class="event_marker_wrapper">
      <div class="event_pulse_outer"></div>
      <div class="event_pulse_inner"></div>
      <div class="event_marker_circle" style="background: ${color}; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M12 2L2 22h20L12 2z" fill="white"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20],
  className: 'custom-event-icon'
});

/**
 * Create a custom user location marker icon
 * @returns {L.DivIcon} Leaflet DivIcon instance
 */
const createUserIcon = () => L.divIcon({
  className: 'user-marker-icon',
  html: `
    <div class="user_marker_wrapper">
      <div class="user_pulse_outer"></div>
      <div class="user_pulse_inner"></div>
      <div class="user_marker_circle">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
  className: 'custom-user-icon'
});

/**
 * Create a custom target/destination marker icon
 * @returns {L.DivIcon} Leaflet DivIcon instance
 */
const createTargetIcon = () => L.divIcon({
  className: 'target-marker-icon',
  html: `
    <div class="target_marker_wrapper">
      <div class="target_pulse"></div>
      <div class="target_marker_circle">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <circle cx="12" cy="12" r="3" fill="white"/>
          <circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: 'custom-target-icon'
});

/**
 * Create a custom agent marker icon with real-time tracking
 * @param {boolean} isOnline - Whether agent is online
 * @param {boolean} inPerimeter - Whether agent is in perimeter
 * @returns {L.DivIcon} Leaflet DivIcon instance
 */
const createAgentIcon = (isOnline = false, inPerimeter = true) => {
  const color = !isOnline ? '#9CA3AF' : (inPerimeter ? '#10B981' : '#EF4444');
  const pulseClass = isOnline ? 'user_pulse_outer' : '';
  
  return L.divIcon({
    className: 'agent-marker-icon',
    html: `
      <div class="user_marker_wrapper">
        ${isOnline ? `<div class="${pulseClass}"></div>` : ''}
        <div class="user_marker_circle" style="background: ${color}; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    className: 'custom-agent-icon'
  });
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate travel time based on distance and mode
 * @param {number} distance - Distance in meters
 * @param {string} mode - Travel mode ('walking', 'driving', 'cycling')
 * @returns {string} Formatted time string
 */
const calculateTravelTime = (distance, mode = 'driving') => {
  const speeds = {
    walking: 5,      // km/h
    driving: 30,     // km/h
    cycling: 15      // km/h
  };

  const speed = speeds[mode] || speeds.driving;
  const timeInHours = distance / (speed * 1000);

  const hours = Math.floor(timeInHours);
  const minutes = Math.round((timeInHours - hours) * 60);

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
};

/**
 * Validate coordinate values
 * @param {*} lat - Latitude value
 * @param {*} lng - Longitude value
 * @returns {boolean} True if coordinates are valid
 */
const isValidCoordinate = (lat, lng) => {
  return lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * RouteInfoPanel - Affiche les informations d'itinéraire
 */
const RouteInfoPanel = ({ routeData, hasValidTarget, geoRadius }) => {
  if (!routeData) return null;

  return (
    <div className={`${styles.info_panel} ${styles.route}`}>
      <div className="flex items-center gap-2 mb-3">
        <FiNavigation className="text-blue-600 flex-shrink-0" size={16} />
        <h3 className="text-sm font-bold text-gray-800">Itinéraire vers la destination</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${styles.info_card} ${styles.blue}`}>
          <FiMapPin className="text-blue-600 flex-shrink-0" size={14} />
          <div>
            <p className="text-xs text-gray-500 font-medium">Distance</p>
            <p className="text-sm font-bold text-gray-900">
              {routeData.distance > 1000
                ? `${(routeData.distance / 1000).toFixed(2)} km`
                : `${Math.round(routeData.distance)} m`}
            </p>
          </div>
        </div>

        <div className={`${styles.info_card} ${styles.green}`}>
          <FiWalk className="text-green-600 flex-shrink-0" size={14} />
          <div>
            <p className="text-xs text-gray-500 font-medium">À pied</p>
            <p className="text-sm font-bold text-gray-900">{routeData.walkingTime}</p>
          </div>
        </div>

        <div className={`${styles.info_card} ${styles.blue}`}>
          <FiTruck className="text-blue-600 flex-shrink-0" size={14} />
          <div>
            <p className="text-xs text-gray-500 font-medium">En voiture</p>
            <p className="text-sm font-bold text-gray-900">{routeData.drivingTime}</p>
          </div>
        </div>

        {hasValidTarget && geoRadius > 0 && (
          <div className={`${styles.info_card} ${styles.purple}`}>
            <div className="w-3 h-3 rounded-full bg-purple-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Zone</p>
              <p className="text-sm font-bold text-gray-900">{geoRadius}m</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * EventDetailsPanel - Affiche les détails d'un événement sélectionné
 */
const EventDetailsPanel = ({ event, latitude, longitude, onClose }) => {
  if (!event) return null;

  const distance = calculateDistance(
    parseFloat(latitude),
    parseFloat(longitude),
    event.position[0],
    event.position[1]
  );
  const walkTime = calculateTravelTime(distance, 'walking');
  const driveTime = calculateTravelTime(distance, 'driving');

  return (
    <div className={`${styles.info_panel} ${styles.event}`}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: event.color }}
        />
        <h3 className="text-sm font-bold text-gray-800 truncate flex-1">{event.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={`${styles.info_card} ${styles.blue}`}>
          <FiMapPin className="text-blue-600 flex-shrink-0" size={14} />
          <div>
            <p className="text-xs text-gray-500">Distance</p>
            <p className="text-sm font-bold">{distance > 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`}</p>
          </div>
        </div>

        <div className={`${styles.info_card} ${styles.green}`}>
          <FiWalk className="text-green-600 flex-shrink-0" size={14} />
          <div>
            <p className="text-xs text-gray-500">À pied</p>
            <p className="text-sm font-bold">{walkTime}</p>
          </div>
        </div>

        <div className={`${styles.info_card} ${styles.blue}`}>
          <FiTruck className="text-blue-600 flex-shrink-0" size={14} />
          <div>
            <p className="text-xs text-gray-500">En voiture</p>
            <p className="text-sm font-bold">{driveTime}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * EventsListPanel - Affiche la liste des événements
 */
const EventsListPanel = ({ eventMarkers, onSelectEvent }) => {
  if (eventMarkers.length === 0) return null;

  return (
    <div className={`${styles.info_panel} ${styles.events_list}`}>
      <h3 className="text-sm font-bold text-gray-800 mb-3">Événements ({eventMarkers.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
        {eventMarkers.map((marker, idx) => (
          <button
            type="button"
            key={`event-list-${idx}`}
            onClick={() => onSelectEvent(marker)}
            className="flex items-center gap-2 p-2 rounded-lg bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: marker.color }}
            />
            <span className="text-sm font-medium text-gray-800 truncate">{marker.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAP UPDATER COMPONENT
// ============================================================================

/**
 * Component to handle map view updates and animations
 * Separated from MiniMap to avoid unnecessary re-renders
 */
const MapUpdater = ({ center, zoom, bounds }) => {
  const map = useMap();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!map) return;
    
    let mounted = true;
    
    const checkMapReady = () => {
      try {
        const container = map.getContainer();
        if (container && container._leaflet_pos !== undefined && container.offsetParent !== null) {
          map.whenReady(() => {
            if (mounted) {
              setTimeout(() => setIsReady(true), 100);
            }
          });
        } else {
          setTimeout(checkMapReady, 50);
        }
      } catch (error) {
        console.warn('Map readiness check error:', error);
        if (mounted) {
          setTimeout(checkMapReady, 100);
        }
      }
    };
    
    const timer = setTimeout(checkMapReady, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [map]);

  useEffect(() => {
    if (!isReady || !map) return;
    
    try {
      const container = map.getContainer();
      if (!container || container._leaflet_pos === undefined || !document.contains(container)) return;
      
      if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
        if (bounds && bounds.length >= 2) {
          map.fitBounds(bounds, { padding: [60, 60], animate: true, maxZoom: 16, duration: 0.5 });
        } else {
          const currentZoom = Math.max(zoom || 14, 12);
          map.setView(center, currentZoom, { animate: true, duration: 0.5 });
        }
      }
    } catch (err) {
      console.warn('MapUpdater error:', err.message);
    }
  }, [center, zoom, bounds, map, isReady]);

  return null;
};

// ============================================================================
// MINI MAP COMPONENT
// ============================================================================

/**
 * MiniMap - Interactive map component with route calculation and event markers
 * 
 * Features:
 * - Real-time user location tracking
 * - Multiple event markers with color coding
 * - Route calculation between user and target
 * - Geofencing visualization
 * - Responsive design with collapsible panels
 * - Performance optimized with memoization
 */
const MiniMap = ({
  latitude,
  longitude,
  targetLat,
  targetLng,
  geoRadius = 100,
  radius,
  onPositionChange,
  draggable = false,
  className = '',
  height = '300px',
  events = [],
  zones = [],
  agentLocations = {},
  assignments = []
}) => {
  const mapRef = useRef(null);
  const [routeData, setRouteData] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // ========== COMPUTATIONS ==========
  
  const userIcon = useMemo(() => createUserIcon(), []);
  const targetIcon = useMemo(() => createTargetIcon(), []);

  // Validate coordinates
  const hasValidPosition = isValidCoordinate(latitude, longitude);
  const hasValidTarget = isValidCoordinate(targetLat, targetLng);

  // Memoized event markers with color coding
  const eventMarkers = useMemo(() => {
    return events
      .filter(e => isValidCoordinate(e.latitude, e.longitude))
      .map((event, index) => {
        const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];
        const color = colors[index % colors.length];
        return {
          ...event,
          position: [parseFloat(event.latitude), parseFloat(event.longitude)],
          icon: createEventIcon(color),
          color
        };
      });
  }, [events]);

  // Calculate route and travel times
  useEffect(() => {
    if (hasValidPosition && hasValidTarget) {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(targetLat),
        parseFloat(targetLng)
      );

      setRouteData({
        distance,
        walkingTime: calculateTravelTime(distance, 'walking'),
        drivingTime: calculateTravelTime(distance, 'driving'),
        straightLineRoute: [
          [parseFloat(latitude), parseFloat(longitude)],
          [parseFloat(targetLat), parseFloat(targetLng)]
        ]
      });
    } else {
      setRouteData(null);
    }
  }, [latitude, longitude, targetLat, targetLng, hasValidPosition, hasValidTarget]);

  // ========== EVENT HANDLERS ==========

  const handleEventSelect = useCallback((event) => {
    setSelectedEvent(prev => prev?.id === event.id ? null : event);
  }, []);

  // Center map on user location without triggering auto-save
  const handleLocate = useCallback(() => {
    console.log('🎯 MiniMap handleLocate called - NO SAVE SHOULD HAPPEN');
    if (!mapRef.current) return;
    
    // Si on a une position valide, centrer dessus
    if (hasValidPosition) {
      mapRef.current.setView(
        [parseFloat(latitude), parseFloat(longitude)],
        16,
        { animate: true }
      );
    } else {
      // Sinon, utiliser la géolocalisation du navigateur
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (mapRef.current) {
              const { latitude: lat, longitude: lng } = position.coords;
              mapRef.current.setView([lat, lng], 16, { animate: true });
              console.log('📍 Carte centrée sur:', lat, lng, '- AUCUNE SAUVEGARDE');
            }
          },
          (error) => {
            console.warn('Géolocalisation non disponible:', error);
          }
        );
      }
    }
  }, [latitude, longitude, hasValidPosition]);

  // ========== COMPUTED VALUES ==========

  const defaultCenter = [48.8566, 2.3522]; // Paris
  const hasEvents = eventMarkers.length > 0;

  const center = hasValidPosition 
    ? [parseFloat(latitude), parseFloat(longitude)]
    : hasValidTarget 
      ? [parseFloat(targetLat), parseFloat(targetLng)]
      : hasEvents 
        ? eventMarkers[0].position
        : defaultCenter;

  const target = hasValidTarget ? [parseFloat(targetLat), parseFloat(targetLng)] : null;

  // Calculate bounds for auto-fit
  const allPoints = [];
  if (hasValidPosition) allPoints.push([parseFloat(latitude), parseFloat(longitude)]);
  if (hasValidTarget) allPoints.push([parseFloat(targetLat), parseFloat(targetLng)]);
  eventMarkers.forEach(m => allPoints.push(m.position));
  const bounds = allPoints.length > 1 ? allPoints : null;

  // ========== RENDER ==========

  return (
    <div className={`w-full ${className}`}>
      {/* MAP CONTAINER */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-white backdrop-blur-lg">
        <div
          style={{ height: height || '300px', minHeight: '200px' }}
          className="relative bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50"
        >
          {/* Global Styles for Map */}
          <style>{`
            .leaflet-container {
              height: 100% !important;
              width: 100% !important;
              background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .leaflet-tile-pane {
              filter: brightness(0.98) contrast(1.05);
            }
            
            .leaflet-control-zoom {
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.8);
            }
            
            .leaflet-control-zoom-in, .leaflet-control-zoom-out {
              background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
              border-bottom: 1px solid rgba(226, 232, 240, 0.5);
              font-weight: 600;
              color: #334155;
              transition: all 0.2s ease;
            }
            
            .leaflet-control-zoom-in:hover, .leaflet-control-zoom-out:hover {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
            }
            
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(2); opacity: 0; }
            }
            
            @keyframes pulse-dot {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.2); }
            }
            
            .user_marker_wrapper {
              position: relative;
            }
            
            .user_pulse_outer {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 40px;
              height: 40px;
              background: #3b82f6;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.2;
              animation: pulse-ring 2s infinite;
            }
            
            .user_pulse_inner {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 24px;
              height: 24px;
              background: #3b82f6;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.3;
              animation: pulse-ring 2s 0.5s infinite;
            }
            
            .user_marker_circle {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 20px;
              height: 20px;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              border: 3px solid white;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .event_marker_wrapper {
              position: relative;
            }
            
            .event_pulse_outer {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 32px;
              height: 32px;
              background: #8b5cf6;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.2;
              animation: pulse-ring 2.5s infinite;
            }
            
            .event_pulse_inner {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 20px;
              height: 20px;
              background: #8b5cf6;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.3;
              animation: pulse-ring 2.5s 0.7s infinite;
            }
            
            .event_marker_circle {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              border: 3px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            
            .event_marker_circle:hover {
              transform: translate(-50%, -50%) scale(1.1);
              filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
            }
            
            .target_marker_wrapper {
              position: relative;
            }
            
            .target_pulse {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 32px;
              height: 32px;
              border: 2px solid #ef4444;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.3;
              animation: pulse-ring 2s infinite;
            }
            
            .target_marker_circle {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 24px;
              height: 24px;
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              border: 3px solid white;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
            }
          `}</style>

          {/* LEAFLET MAP */}
          <MapContainer
            ref={mapRef}
            center={center}
            zoom={hasValidPosition ? 14 : 5}
            style={{ height: '100%', width: '100%', display: 'block' }}
            scrollWheelZoom={true}
            zoomControl={true}
            className="enhanced-map"
          >
            {/* OSM Tiles with better appearance */}
            <TileLayer
              attribution=""
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            {/* Map auto-update on coordinate changes */}
            <MapUpdater center={center} bounds={bounds} zoom={hasValidPosition ? 14 : 5} />

            {/* Route Line (User to Target) */}
            {routeData?.straightLineRoute && (
              <Polyline
                positions={routeData.straightLineRoute}
                pathOptions={{
                  color: '#3b82f6',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '8, 6',
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            )}

            {/* Route Lines to Events */}
            {hasValidPosition && eventMarkers.map((marker, idx) => (
              <Polyline
                key={`route-event-${idx}`}
                positions={[
                  [parseFloat(latitude), parseFloat(longitude)],
                  marker.position
                ]}
                pathOptions={{
                  color: marker.color,
                  weight: 2,
                  opacity: 0.5,
                  dashArray: '5, 5',
                  lineCap: 'round'
                }}
              />
            ))}

            {/* Geofence Circle */}
            {hasValidTarget && (
              <>
                <Circle
                  center={target}
                  radius={parseInt(geoRadius)}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#fecaca',
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: '8, 6',
                    opacity: 0.8
                  }}
                />
                {/* Target Marker */}
                <Marker position={target} icon={targetIcon} />
              </>
            )}

            {/* Event Markers */}
            {eventMarkers.map((marker, idx) => (
              <Marker
                key={`event-marker-${idx}`}
                position={marker.position}
                icon={marker.icon}
                eventHandlers={{
                  click: () => handleEventSelect(marker)
                }}
              />
            ))}

            {/* Zone Circles */}
            {zones && zones.map((zone, idx) => (
              zone.latitude && zone.longitude && (
                <Circle
                  key={`zone-${idx}`}
                  center={[parseFloat(zone.latitude), parseFloat(zone.longitude)]}
                  radius={parseInt(zone.radius) || 500}
                  pathOptions={{
                    color: '#10B981',
                    fillColor: '#D1FAE5',
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: '10, 5',
                    opacity: 0.6
                  }}
                />
              )
            ))}

            {/* Event Radius Circle */}
            {hasValidPosition && radius && (
              <Circle
                center={center}
                radius={parseInt(radius)}
                pathOptions={{
                  color: '#3B82F6',
                  fillColor: '#DBEAFE',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '8, 6',
                  opacity: 0.7
                }}
              />
            )}

            {/* Real-time Agent Markers */}
            {Object.entries(agentLocations).map(([agentId, location]) => {
              if (!location.lat || !location.lng) return null;
              
              const assignment = assignments.find(a => a.agentId === agentId);
              const agentName = assignment?.agent ? `${assignment.agent.firstName} ${assignment.agent.lastName}` : 'Agent';
              
              // Calculer si dans périmètre
              let inPerimeter = true;
              if (hasValidPosition && radius) {
                const distance = calculateDistance(
                  parseFloat(latitude),
                  parseFloat(longitude),
                  location.lat,
                  location.lng
                );
                inPerimeter = distance <= parseInt(radius);
              }
              
              return (
                <Marker
                  key={`agent-${agentId}`}
                  position={[location.lat, location.lng]}
                  icon={createAgentIcon(location.isOnline, inPerimeter)}
                >
                  {/* Popup avec informations agent */}
                  <div className="p-2 text-xs">
                    <p className="font-bold text-sm mb-1">{agentName}</p>
                    <p className="text-gray-600">Zone: {assignment?.zone?.name || '-'}</p>
                    <p className="text-gray-600">Batterie: {location.battery}%</p>
                    <p className="text-gray-600">
                      Statut: {location.isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}
                    </p>
                    <p className="text-gray-600">
                      Position: {inPerimeter ? '✅ Dans périmètre' : '⚠️ Hors périmètre'}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-1">
                      Mis à jour: {location.timestamp ? new Date(location.timestamp).toLocaleTimeString('fr-FR') : '-'}
                    </p>
                  </div>
                </Marker>
              );
            })}

            {/* User Location Marker */}
            {hasValidPosition && (
              <Marker position={center} icon={userIcon} />
            )}
          </MapContainer>

          {/* Center Button */}
          <button
            type="button"
            onClick={handleLocate}
            className={`absolute bottom-4 right-4 z-[999] p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 group cursor-pointer ${styles.locate_button}`}
            title="Centrer sur ma position"
          >
            <FiCrosshair className="text-blue-600 group-hover:text-blue-700 transition-colors" size={18} />
          </button>

          {/* Attribution */}
          <div className="absolute bottom-4 left-4 z-[999] text-[9px] text-gray-600 bg-white/85 backdrop-blur-md px-2 py-1 rounded-lg font-medium shadow-sm border border-white/40">
            © OpenStreetMap
          </div>
        </div>
      </div>

      {/* INFO PANELS */}
      <div className="mt-4 space-y-3">
        <RouteInfoPanel routeData={routeData} hasValidTarget={hasValidTarget} geoRadius={geoRadius} />
        
        {selectedEvent && hasValidPosition && (
          <EventDetailsPanel
            event={selectedEvent}
            latitude={latitude}
            longitude={longitude}
            onClose={() => setSelectedEvent(null)}
          />
        )}
        
        {eventMarkers.length > 0 && !selectedEvent && (
          <EventsListPanel eventMarkers={eventMarkers} onSelectEvent={handleEventSelect} />
        )}
      </div>
    </div>
  );
};

export default MiniMap;
