import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  FiUsers, FiActivity, FiBattery, FiMapPin, FiClock, FiZap,
  FiAlertTriangle, FiCheckCircle, FiFilter, FiRefreshCw,
  FiNavigation, FiX, FiEye, FiEyeOff, FiMaximize2
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import api from '../services/api';
import { trackingAPI } from '../services/api';
import useAuthStore from '../hooks/useAuth';

// Socket.IO URL
const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 
                   'https://security-guard-backend.onrender.com';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Recentrer la carte
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

// Icônes agents personnalisées
const createAgentIcon = (agent) => {
  const { status, batteryLevel, isMoving } = agent;
  
  // Couleur selon statut
  let color = '#10B981'; // Vert = actif
  if (status === 'outside_geofence') color = '#EF4444'; // Rouge = hors périmètre
  else if (status === 'completed') color = '#6B7280'; // Gris = terminé
  else if (batteryLevel < 20) color = '#F59E0B'; // Orange = batterie faible
  
  const size = 48;
  const iconHTML = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: linear-gradient(135deg, ${color}, ${color}dd);
      border: 4px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 0 4px ${color}22;
      position: relative;
      animation: ${isMoving ? 'pulse 2s infinite' : 'none'};
    ">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
      ${batteryLevel < 20 ? `
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 20px;
          height: 20px;
          background: #EF4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          font-size: 12px;
        ">⚡</div>
      ` : ''}
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
    </style>
  `;
  
  return L.divIcon({
    html: iconHTML,
    className: 'custom-agent-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const RealTimeTracking = () => {
  const { user } = useAuthStore();
  const [agents, setAgents] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentHistory, setAgentHistory] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // NOUVEAU: Tous les utilisateurs (agents + responsables)
  const [filters, setFilters] = useState({
    showActive: true,
    showOutside: true,
    showCompleted: false,
    showLowBattery: true,
    showAgents: true, // NOUVEAU
    showSupervisors: true // NOUVEAU
  });
  const [mapCenter, setMapCenter] = useState([33.5731, -7.5898]); // Casablanca par défaut
  const [mapZoom, setMapZoom] = useState(13);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const socketRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // Connexion Socket.IO
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('token')
      }
    });

    socket.on('connect', () => {
      console.log('✅ Socket.IO connecté pour tracking');
      
      // S'abonner aux mises à jour de tracking
      if (selectedEvent) {
        socket.emit('tracking:subscribe', { eventId: selectedEvent.id });
      }
    });

    socket.on('tracking:position_update', (data) => {
      console.log('📍 Position mise à jour:', data);
      
      setAgents(prevAgents => {
        const existingIndex = prevAgents.findIndex(a => a.userId === data.userId);
        if (existingIndex >= 0) {
          // Mettre à jour agent existant
          const updated = [...prevAgents];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...data,
            lastUpdate: new Date()
          };
          return updated;
        } else {
          // Nouvel agent
          return [...prevAgents, { ...data, lastUpdate: new Date() }];
        }
      });
    });

    socket.on('tracking:agent_stopped', (data) => {
      console.log('⏹️ Agent arrêté:', data);
      setAgents(prevAgents => prevAgents.filter(a => a.userId !== data.userId));
    });

    socket.on('tracking:geofence_alert', (data) => {
      console.log('🚨 Alerte géofencing:', data);
      setAlerts(prev => [data, ...prev].slice(0, 50)); // Garder 50 dernières alertes
      
      if (data.type === 'geofence_exit') {
        toast.error(data.message, {
          autoClose: 10000,
          position: 'top-right'
        });
      } else if (data.type === 'geofence_return') {
        toast.success(data.message, {
          autoClose: 5000
        });
      }
    });

    socket.on('tracking:battery_alert', (data) => {
      console.log('🔋 Alerte batterie:', data);
      setAlerts(prev => [data, ...prev].slice(0, 50));
      
      toast.warning(data.message, {
        autoClose: 8000
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [selectedEvent]);

  // Charger les agents via REST API quand un événement est sélectionné + auto-refresh 30s
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    if (selectedEvent) {
      loadAgentsForEvent(selectedEvent.id);
      refreshIntervalRef.current = setInterval(() => {
        loadAgentsForEvent(selectedEvent.id);
      }, 30000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [selectedEvent]);

  // Charger les événements
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
      if (relevantEvents.length > 0) {
        setSelectedEvent(relevantEvents[0]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement événements:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error message:', error.message);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Non autorisé: Vous devez être connecté');
      } else {
        toast.error(`Erreur: ${error.response?.data?.message || error.message || 'Erreur lors du chargement des événements'}`);
      }
      setEvents([]); // S'assurer que events est toujours un tableau
    }
  };

  // Charger les agents depuis l'API REST pour un événement
  const loadAgentsForEvent = async (eventId) => {
    setLoadingAgents(true);
    try {
      // Charger positions GPS + données d'attendance (check-in/check-out) en parallèle
      const [trackingResponse, attendanceResponse, assignmentsResponse] = await Promise.allSettled([
        trackingAPI.getEventLivePositions(eventId),
        api.get('/attendance', { params: { eventId, limit: 100 } }),
        api.get('/assignments', { params: { eventId, limit: 100 } })
      ]);

      const data = trackingResponse.value?.data?.data || trackingResponse.value?.data || {};
      const agentsList = data.agents || [];

      // Indexer les données d'attendance par userId
      const attendanceList = attendanceResponse.value?.data?.data?.attendances
        || attendanceResponse.value?.data?.attendances || [];
      const attendanceMap = {};
      attendanceList.forEach(att => {
        const uid = att.userId || att.agentId;
        if (uid) attendanceMap[uid] = att;
      });

      // Indexer les assignments par userId pour la zone
      const assignmentsList = assignmentsResponse.value?.data?.data?.assignments
        || assignmentsResponse.value?.data?.assignments || [];
      const assignmentMap = {};
      assignmentsList.forEach(asgn => {
        const uid = asgn.userId || asgn.agentId;
        if (uid) assignmentMap[uid] = asgn;
      });

      // Convertir le format API → format attendu par le composant
      const mappedAgents = agentsList.map(agent => {
        const att = attendanceMap[agent.id] || {};
        const asgn = assignmentMap[agent.id] || {};
        return {
          userId: agent.id,
          latitude: agent.position?.latitude || null,
          longitude: agent.position?.longitude || null,
          batteryLevel: agent.batteryLevel || 100,
          isMoving: false,
          isOnline: agent.isOnline ?? true,
          isWithinGeofence: agent.isWithinGeofence,
          distance: agent.distance,
          status: agent.isOnline === false ? 'completed'
                 : agent.isWithinGeofence === false ? 'outside_geofence'
                 : 'active',
          lastUpdate: agent.position?.updatedAt ? new Date(agent.position.updatedAt) : null,
          checkInTime: att.checkInTime || att.check_in_time || null,
          checkOutTime: att.checkOutTime || att.check_out_time || null,
          zone: asgn.zone || asgn.position || selectedEvent?.location || '-',
          assignmentStatus: asgn.status || '-',
          user: {
            id: agent.id,
            firstName: agent.name?.split(' ')[0] || '',
            lastName: agent.name?.split(' ').slice(1).join(' ') || '',
            employeeId: agent.employeeId,
            cin: agent.cin,
            profilePhoto: agent.photo,
            role: agent.role || 'agent'
          }
        };
      });

      // Agents sans GPS → inclure quand même dans le tableau (mais pas sur la carte)
      const allMapped = mappedAgents;
      const withGPS = mappedAgents.filter(a => a.latitude && a.longitude);

      // Mettre à jour les agents (Socket.IO peut aussi les mettre à jour)
      setAgents(prev => {
        // Fusionner avec les positions temps-réel reçues via Socket.IO
        const socketAgents = prev.filter(p => !allMapped.find(m => m.userId === p.userId));
        return [...allMapped, ...socketAgents];
      });

      console.log(`✅ Tracking: ${withGPS.length} agent(s) avec GPS, ${allMapped.length} total pour l'événement`);
    } catch (error) {
      console.warn('⚠️ Impossible de charger les positions agents:', error?.message);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Charger l'historique d'un agent
  const loadAgentHistory = async (userId, eventId) => {
    try {
      const response = await api.get(`/tracking/history/${userId}/${eventId}`);
      setAgentHistory(response.data.data || []);
      setShowHistory(true);
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    }
  };

  // Filtrer les agents (inclure agents ET superviseurs)
  const filteredAgents = Array.isArray(agents) ? agents.filter(agent => {
    // Filtre par rôle
    if (!filters.showAgents && agent.user?.role === 'agent') return false;
    if (!filters.showSupervisors && agent.user?.role === 'supervisor') return false;
    
    // Filtre par statut
    if (!filters.showActive && agent.status === 'active') return false;
    if (!filters.showOutside && agent.status === 'outside_geofence') return false;
    if (!filters.showCompleted && agent.status === 'completed') return false;
    if (!filters.showLowBattery && agent.batteryLevel < 20) return false;
    return true;
  }) : [];

  // Statistiques (agents + superviseurs)
  const stats = {
    total: Array.isArray(agents) ? agents.length : 0,
    active: Array.isArray(agents) ? agents.filter(a => a.status === 'active').length : 0,
    outside: Array.isArray(agents) ? agents.filter(a => a.status === 'outside_geofence').length : 0,
    lowBattery: Array.isArray(agents) ? agents.filter(a => a.batteryLevel < 20).length : 0,
    agentsCount: Array.isArray(agents) ? agents.filter(a => a.user?.role === 'agent').length : 0,
    supervisorsCount: Array.isArray(agents) ? agents.filter(a => a.user?.role === 'supervisor').length : 0
  };

  return (
    <div className={`${isFullScreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiMapPin className="text-blue-600" />
              Suivi GPS en Temps Réel
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {loadingAgents ? '🔄 Chargement des positions...' : `${stats.total} agent${stats.total > 1 ? 's' : ''} en tracking`}
            </p>
          </div>

          {/* Sélection événement */}
          <div className="flex items-center gap-3">
            <select
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const event = events.find(ev => ev.id === e.target.value);
                setSelectedEvent(event);
                
                // Recentrer sur l'événement
                if (event?.latitude && event?.longitude) {
                  setMapCenter([event.latitude, event.longitude]);
                  setMapZoom(15);
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Sélectionner un événement --</option>
              {Array.isArray(events) && events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} ({event.location})
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                loadEvents();
                if (selectedEvent) loadAgentsForEvent(selectedEvent.id);
              }}
              className={`p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ${loadingAgents ? 'animate-spin' : ''}`}
              title="Rafraîchir agents"
              disabled={loadingAgents}
            >
              <FiRefreshCw />
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Plein écran"
            >
              <FiMaximize2 />
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 font-medium">Total</p>
                <p className="text-xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <FiUsers className="text-2xl text-blue-600" />
            </div>
          </div>

          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-700 font-medium">Agents</p>
                <p className="text-xl font-bold text-purple-900">{stats.agentsCount}</p>
              </div>
              <FiUsers className="text-2xl text-purple-600" />
            </div>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-700 font-medium">Responsables</p>
                <p className="text-xl font-bold text-indigo-900">{stats.supervisorsCount}</p>
              </div>
              <FiZap className="text-2xl text-indigo-600" />
            </div>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium">Actifs</p>
                <p className="text-xl font-bold text-green-900">{stats.active}</p>
              </div>
              <FiCheckCircle className="text-2xl text-green-600" />
            </div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700 font-medium">Hors périmètre</p>
                <p className="text-xl font-bold text-red-900">{stats.outside}</p>
              </div>
              <FiAlertTriangle className="text-2xl text-red-600" />
            </div>
          </div>

          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-700 font-medium">Batterie faible</p>
                <p className="text-xl font-bold text-orange-900">{stats.lowBattery}</p>
              </div>
              <FiBattery className="text-2xl text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setFilters(f => ({ ...f, showAgents: !f.showAgents }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.showAgents
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            <FiUsers className="inline mr-1" />
            Agents
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, showSupervisors: !f.showSupervisors }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.showSupervisors
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            <FiZap className="inline mr-1" />
            Responsables
          </button>
          
          <button
            onClick={() => setFilters(f => ({ ...f, showActive: !f.showActive }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.showActive
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            <FiCheckCircle className="inline mr-1" />
            Actifs
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, showOutside: !f.showOutside }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.showOutside
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            <FiAlertTriangle className="inline mr-1" />
            Hors périmètre
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, showCompleted: !f.showCompleted }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.showCompleted
                ? 'bg-gray-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            Terminés
          </button>

          <button
            onClick={() => setFilters(f => ({ ...f, showLowBattery: !f.showLowBattery }))}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.showLowBattery
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            <FiBattery className="inline mr-1" />
            Batterie faible
          </button>
        </div>
      </div>

      {/* Carte */}
      <div className={`${isFullScreen ? 'h-screen' : 'h-[600px]'} relative`}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <RecenterMap center={mapCenter} />

          {/* Périmètre de l'événement */}
          {selectedEvent?.latitude && selectedEvent?.longitude && (
            <Circle
              center={[selectedEvent.latitude, selectedEvent.longitude]}
              radius={selectedEvent.geoRadius || 100}
              pathOptions={{
                color: '#3B82F6',
                fillColor: '#3B82F6',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 10'
              }}
            />
          )}

          {/* Marker centre événement */}
          {selectedEvent?.latitude && selectedEvent?.longitude && (
            <Marker position={[selectedEvent.latitude, selectedEvent.longitude]}>
              <Popup>
                <div className="font-semibold">{selectedEvent.name}</div>
                <div className="text-sm text-gray-600">{selectedEvent.location}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Périmètre: {selectedEvent.geoRadius || 100}m
                </div>
              </Popup>
            </Marker>
          )}

          {/* Agents */}
          {filteredAgents.map((agent) => (
            <Marker
              key={agent.userId}
              position={[agent.latitude, agent.longitude]}
              icon={createAgentIcon(agent)}
            >
              <Popup>
                <div className="min-w-[250px]">
                  <div className="font-bold text-lg mb-2">
                    {agent.user.firstName} {agent.user.lastName}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">CIN:</span>
                      <span className="font-medium">{agent.user.cin}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matricule:</span>
                      <span className="font-medium">{agent.user.employeeId}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Statut:</span>
                      <span className={`font-medium ${
                        agent.status === 'active' ? 'text-green-600' :
                        agent.status === 'outside_geofence' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {agent.status === 'active' ? 'Actif' :
                         agent.status === 'outside_geofence' ? 'Hors périmètre' :
                         'Terminé'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Batterie:</span>
                      <span className={`font-medium ${
                        agent.batteryLevel < 20 ? 'text-red-600' :
                        agent.batteryLevel < 50 ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {agent.batteryLevel}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mouvement:</span>
                      <span className="font-medium">
                        {agent.isMoving ? '🚶 En déplacement' : '🛑 Arrêté'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dernière mise à jour:</span>
                      <span className="font-medium text-xs">
                        {new Date(agent.timestamp).toLocaleTimeString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAgent(agent);
                      loadAgentHistory(agent.userId, agent.eventId);
                    }}
                    className="w-full mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Voir l'historique
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Trajet de l'agent sélectionné */}
          {showHistory && agentHistory.length > 1 && (
            <Polyline
              positions={agentHistory.map(p => [p.latitude, p.longitude])}
              pathOptions={{
                color: '#3B82F6',
                weight: 3,
                opacity: 0.7
              }}
            />
          )}
        </MapContainer>

        {/* Liste des alertes */}
        {alerts.length > 0 && (
          <div className="absolute top-4 right-4 w-96 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-200 z-[1000]">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FiAlertTriangle className="text-red-600" />
                Alertes récentes
              </h3>
              <button
                onClick={() => setAlerts([])}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 ${
                    alert.type === 'geofence_exit' ? 'bg-red-50' :
                    alert.type === 'geofence_return' ? 'bg-green-50' :
                    alert.type === 'low_battery' ? 'bg-orange-50' :
                    'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {alert.type === 'geofence_exit' && <FiAlertTriangle className="text-red-600 mt-1" />}
                    {alert.type === 'geofence_return' && <FiCheckCircle className="text-green-600 mt-1" />}
                    {alert.type === 'low_battery' && <FiBattery className="text-orange-600 mt-1" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(alert.timestamp).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tableau des agents */}
      {selectedEvent && agents.length > 0 && (
        <div className="bg-white border-t mt-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiUsers className="text-blue-600" />
              Agents & Responsables — {selectedEvent.name}
            </h2>
            <span className="text-sm text-gray-500">{filteredAgents.length} affiché(s) / {agents.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rôle</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Zone</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">En ligne</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Latitude</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Longitude</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Batterie</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Périmètre</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Check-in</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Check-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAgents.map(agent => (
                  <tr key={agent.userId} className="hover:bg-gray-50 transition-colors">
                    {/* Nom */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {agent.user?.profilePhoto ? (
                          <img src={agent.user.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {(agent.user?.firstName?.[0] || '') + (agent.user?.lastName?.[0] || '')}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{agent.user?.firstName} {agent.user?.lastName}</div>
                          <div className="text-xs text-gray-400">{agent.user?.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    {/* Rôle */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agent.user?.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {agent.user?.role === 'supervisor' ? 'Responsable' : 'Agent'}
                      </span>
                    </td>
                    {/* Zone */}
                    <td className="px-4 py-3 text-gray-600">{agent.zone || '-'}</td>
                    {/* En ligne */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        agent.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          agent.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`}></span>
                        {agent.isOnline ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    {/* Latitude */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {agent.latitude ? agent.latitude.toFixed(6) : '—'}
                    </td>
                    {/* Longitude */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {agent.longitude ? agent.longitude.toFixed(6) : '—'}
                    </td>
                    {/* Batterie */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FiBattery className={`${
                          agent.batteryLevel < 20 ? 'text-red-500' :
                          agent.batteryLevel < 50 ? 'text-orange-500' : 'text-green-500'
                        }`} />
                        <span className={`font-medium ${
                          agent.batteryLevel < 20 ? 'text-red-600' :
                          agent.batteryLevel < 50 ? 'text-orange-600' : 'text-green-600'
                        }`}>{agent.batteryLevel}%</span>
                      </div>
                    </td>
                    {/* Périmètre */}
                    <td className="px-4 py-3 text-center">
                      {agent.latitude ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          agent.isWithinGeofence === false ? 'bg-red-100 text-red-700' :
                          agent.isWithinGeofence === true ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {agent.isWithinGeofence === false ? '⚠ Dehors' :
                           agent.isWithinGeofence === true ? '✓ Dedans' : '—'}
                        </span>
                      ) : '—'}
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agent.status === 'active' ? 'bg-green-100 text-green-700' :
                        agent.status === 'outside_geofence' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {agent.status === 'active' ? 'Actif' :
                         agent.status === 'outside_geofence' ? 'Hors périmètre' : 'Terminé'}
                      </span>
                    </td>
                    {/* Check-in */}
                    <td className="px-4 py-3 text-gray-700">
                      {agent.checkInTime
                        ? new Date(agent.checkInTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                        : <span className="text-gray-400">—</span>}
                    </td>
                    {/* Check-out */}
                    <td className="px-4 py-3 text-gray-700">
                      {agent.checkOutTime
                        ? new Date(agent.checkOutTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default RealTimeTracking;
