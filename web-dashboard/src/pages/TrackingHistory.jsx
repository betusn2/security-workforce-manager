import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FiMapPin, FiClock, FiActivity, FiFilter, FiRefreshCw,
  FiUsers, FiBattery, FiNavigation, FiAlertTriangle,
  FiCheckCircle, FiCalendar, FiSearch, FiDownload, FiList
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { eventsAPI, trackingAPI, assignmentsAPI } from '../services/api';
import useAuthStore from '../hooks/useAuth';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom map fitter component
const MapFitter = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
};

// Create start/end icons
const createPointIcon = (color, label) => L.divIcon({
  className: '',
  html: `<div style="
    width:32px; height:32px; border-radius:50%; background:${color};
    border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.4);
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:bold; color:white;
  ">${label}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Calculate distance between two GPS points (Haversine formula) in meters
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (m) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default function TrackingHistory() {
  const { user } = useAuthStore();

  // Selectors
  const [events, setEvents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // History data
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'timeline'
  const [showFilters, setShowFilters] = useState(true);
  const [selectedEventInfo, setSelectedEventInfo] = useState(null);

  // Computed stats
  const stats = React.useMemo(() => {
    if (!historyData.length) return null;
    let totalDistance = 0;
    let inZoneCount = 0;
    let outZoneCount = 0;
    const batteries = historyData.map(p => p.batteryLevel).filter(b => b !== null && b !== undefined);
    for (let i = 1; i < historyData.length; i++) {
      totalDistance += haversineDistance(
        historyData[i - 1].latitude, historyData[i - 1].longitude,
        historyData[i].latitude, historyData[i].longitude
      );
    }
    historyData.forEach(p => {
      if (p.isWithinGeofence) inZoneCount++;
      else outZoneCount++;
    });
    const first = new Date(historyData[0].recordedAt);
    const last = new Date(historyData[historyData.length - 1].recordedAt);
    const durationSec = (last - first) / 1000;
    return {
      totalPoints: historyData.length,
      totalDistance,
      durationSec,
      inZoneCount,
      outZoneCount,
      batteryMin: batteries.length ? Math.min(...batteries) : null,
      batteryMax: batteries.length ? Math.max(...batteries) : null,
      startTime: first,
      endTime: last,
    };
  }, [historyData]);

  // Load events on mount
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await eventsAPI.getAll({ limit: 100 });
        const list = res?.data?.data || res?.data || [];
        setEvents(Array.isArray(list) ? list : []);
      } catch {
        toast.error('Erreur lors du chargement des événements');
      }
    };
    loadEvents();
  }, []);

  // Load agents when event changes
  useEffect(() => {
    if (!selectedEvent) {
      setAgents([]);
      setSelectedAgent('');
      setSelectedEventInfo(null);
      return;
    }
    const loadAgents = async () => {
      setLoadingAgents(true);
      try {
        // Find event info for geofence
        const eventObj = events.find(e => String(e.id) === String(selectedEvent));
        setSelectedEventInfo(eventObj || null);

        const res = await assignmentsAPI.getAll({ eventId: selectedEvent, limit: 200 });
        const assignments = res?.data?.data || res?.data || [];
        const agentList = Array.isArray(assignments)
          ? assignments
              .filter(a => a.user || a.agent)
              .map(a => ({ ...(a.user || a.agent), assignmentId: a.id }))
          : [];
        setAgents(agentList);
        setSelectedAgent('');
        setHistoryData([]);
      } catch {
        toast.error('Erreur lors du chargement des agents');
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, [selectedEvent, events]);

  // Load tracking history
  const loadHistory = useCallback(async () => {
    if (!selectedEvent || !selectedAgent) {
      toast.warning('Veuillez sélectionner un événement et un agent');
      return;
    }
    setLoading(true);
    setHistoryData([]);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await trackingAPI.getUserHistory(selectedAgent, selectedEvent);
      const data = res?.data?.data || res?.data || [];
      const validData = Array.isArray(data)
        ? data.filter(p => p.latitude && p.longitude)
        : [];
      if (validData.length === 0) {
        toast.info('Aucune donnée GPS trouvée pour cette sélection');
      } else {
        toast.success(`${validData.length} points GPS chargés`);
      }
      setHistoryData(validData);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement de l\'historique GPS');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, selectedAgent, startDate, endDate]);

  const polylinePositions = historyData.map(p => [p.latitude, p.longitude]);

  // Color each segment by in/out of zone
  const getPointColor = (point) => {
    if (point.isWithinGeofence === false) return '#ef4444';
    if (point.isWithinGeofence === true) return '#22c55e';
    return '#3b82f6';
  };

  const exportCSV = () => {
    if (!historyData.length) return;
    const headers = ['Heure', 'Latitude', 'Longitude', 'Précision (m)', 'Vitesse (m/s)',
      'Batterie (%)', 'Dans zone', 'Distance (m)', 'En mouvement'];
    const rows = historyData.map(p => [
      new Date(p.recordedAt).toLocaleString('fr-FR'),
      p.latitude, p.longitude,
      p.accuracy ?? '',
      p.speed ?? '',
      p.batteryLevel ?? '',
      p.isWithinGeofence ? 'Oui' : 'Non',
      p.distanceFromEvent ?? '',
      p.isMoving ? 'Oui' : 'Non',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const agentName = agents.find(a => String(a.id) === String(selectedAgent));
    a.download = `historique_gps_${agentName?.firstName || 'agent'}_${selectedEvent}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiNavigation className="text-blue-600 text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Historique GPS par Événement</h1>
              <p className="text-sm text-gray-500">Visualisez le trajet GPS d'un agent sur un événement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiFilter />
              {showFilters ? 'Masquer filtres' : 'Afficher filtres'}
            </button>
            {historyData.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
              >
                <FiDownload />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Filters panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Event selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  <FiCalendar className="inline mr-1" />Événement
                </label>
                <select
                  value={selectedEvent}
                  onChange={e => setSelectedEvent(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Choisir un événement --</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name || ev.title || `Événement #${ev.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  <FiUsers className="inline mr-1" />Agent
                  {loadingAgents && <span className="ml-1 text-blue-500">(chargement...)</span>}
                </label>
                <select
                  value={selectedAgent}
                  onChange={e => setSelectedAgent(e.target.value)}
                  disabled={!selectedEvent || loadingAgents}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Choisir un agent --</option>
                  {agents.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.firstName} {ag.lastName}
                      {ag.cin ? ` (${ag.cin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  <FiClock className="inline mr-1" />Date début (opt.)
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  <FiClock className="inline mr-1" />Date fin (opt.)
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={loadHistory}
                disabled={loading || !selectedEvent || !selectedAgent}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiSearch />
                )}
                {loading ? 'Chargement...' : 'Charger l\'historique'}
              </button>
            </div>
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard icon={<FiMapPin className="text-blue-500" />} label="Points GPS" value={stats.totalPoints} />
            <StatCard icon={<FiNavigation className="text-green-500" />} label="Distance totale" value={formatDistance(stats.totalDistance)} />
            <StatCard icon={<FiClock className="text-purple-500" />} label="Durée" value={formatDuration(stats.durationSec)} />
            <StatCard icon={<FiCheckCircle className="text-green-500" />} label="En zone" value={stats.inZoneCount} />
            <StatCard icon={<FiAlertTriangle className="text-red-500" />} label="Hors zone" value={stats.outZoneCount} />
            {stats.batteryMin !== null && (
              <StatCard
                icon={<FiBattery className={stats.batteryMin < 20 ? 'text-red-500' : 'text-yellow-500'} />}
                label="Batterie min"
                value={`${stats.batteryMin}%`}
              />
            )}
          </div>
        )}

        {/* Tab switcher */}
        {historyData.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'map' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
            >
              <FiMapPin /> Carte
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'timeline' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
            >
              <FiList /> Timeline ({historyData.length})
            </button>
          </div>
        )}

        {/* Map View */}
        {(activeTab === 'map' || !historyData.length) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div style={{ height: '520px' }}>
              {historyData.length > 0 ? (
                <MapContainer
                  center={[historyData[0].latitude, historyData[0].longitude]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <MapFitter positions={historyData} />

                  {/* Geofence circle if event has coordinates */}
                  {selectedEventInfo?.latitude && selectedEventInfo?.longitude && (
                    <Circle
                      center={[selectedEventInfo.latitude, selectedEventInfo.longitude]}
                      radius={selectedEventInfo.geofenceRadius || 200}
                      pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 2 }}
                    />
                  )}

                  {/* Trajectory polyline */}
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.8 }}
                  />

                  {/* Out-of-zone segments highlighted in red */}
                  {historyData.map((point, i) => {
                    if (i === 0) return null;
                    if (point.isWithinGeofence === false) {
                      return (
                        <Polyline
                          key={`out-${i}`}
                          positions={[[historyData[i - 1].latitude, historyData[i - 1].longitude], [point.latitude, point.longitude]]}
                          pathOptions={{ color: '#ef4444', weight: 4, opacity: 0.9 }}
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Start marker */}
                  <Marker
                    position={[historyData[0].latitude, historyData[0].longitude]}
                    icon={createPointIcon('#22c55e', 'D')}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>Départ</strong><br />
                        {new Date(historyData[0].recordedAt).toLocaleString('fr-FR')}
                        {historyData[0].batteryLevel !== null && (
                          <><br />Batterie: {historyData[0].batteryLevel}%</>
                        )}
                      </div>
                    </Popup>
                  </Marker>

                  {/* End marker */}
                  <Marker
                    position={[historyData[historyData.length - 1].latitude, historyData[historyData.length - 1].longitude]}
                    icon={createPointIcon('#ef4444', 'A')}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>Arrivée</strong><br />
                        {new Date(historyData[historyData.length - 1].recordedAt).toLocaleString('fr-FR')}
                        {historyData[historyData.length - 1].batteryLevel !== null && (
                          <><br />Batterie: {historyData[historyData.length - 1].batteryLevel}%</>
                        )}
                      </div>
                    </Popup>
                  </Marker>

                  {/* Anomaly markers (out-of-zone points) */}
                  {historyData
                    .filter(p => p.isWithinGeofence === false)
                    .slice(0, 20) // Limit to avoid too many markers
                    .map((point, i) => (
                      <Marker
                        key={`anomaly-${i}`}
                        position={[point.latitude, point.longitude]}
                        icon={createPointIcon('#f59e0b', '!')}
                      >
                        <Popup>
                          <div className="text-sm">
                            <strong>Hors zone</strong><br />
                            {new Date(point.recordedAt).toLocaleString('fr-FR')}<br />
                            Distance: {point.distanceFromEvent ? `${Math.round(point.distanceFromEvent)}m` : 'N/A'}
                          </div>
                        </Popup>
                      </Marker>
                    ))
                  }
                </MapContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <FiMapPin className="text-5xl mb-3 opacity-30" />
                  <p className="text-lg font-medium">Aucun historique à afficher</p>
                  <p className="text-sm mt-1">Sélectionnez un événement et un agent, puis cliquez sur "Charger l'historique"</p>
                </div>
              )}
            </div>

            {/* Map legend */}
            {historyData.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Départ (D)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Arrivée (A)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-1 bg-blue-500 rounded"></div>
                  <span>Trajet normal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-1 bg-red-500 rounded"></div>
                  <span>Hors périmètre</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span>Point d'alerte (!)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline View */}
        {activeTab === 'timeline' && historyData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FiActivity className="text-blue-500" />
                Timeline des positions ({historyData.length} points)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Heure</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Coordonnées</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Précision</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Vitesse</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Batterie</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Zone</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyData.map((point, i) => (
                    <tr
                      key={point.id || i}
                      className={`hover:bg-gray-50 transition-colors ${point.isWithinGeofence === false ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {new Date(point.recordedAt).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">
                        {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {point.accuracy != null ? `±${Math.round(point.accuracy)}m` : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {point.speed != null ? `${(point.speed * 3.6).toFixed(1)} km/h` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {point.batteryLevel != null ? (
                          <span className={`font-medium ${point.batteryLevel < 20 ? 'text-red-600' : point.batteryLevel < 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {point.batteryLevel}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {point.isWithinGeofence === true ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs font-medium">
                            <FiCheckCircle /> Dans zone
                          </span>
                        ) : point.isWithinGeofence === false ? (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-xs font-medium">
                            <FiAlertTriangle /> Hors zone
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {point.distanceFromEvent != null ? `${Math.round(point.distanceFromEvent)}m` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}
