import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiMapPin, FiClock, FiUsers, FiCalendar, FiEdit2,
  FiTrash2, FiAlertTriangle, FiCheckCircle, FiUserCheck, FiUserX,
  FiActivity, FiShield, FiLayers, FiFlag, FiAlertCircle, FiInfo,
  FiTrendingUp, FiCopy, FiRepeat, FiBatteryCharging, FiWifi, FiWifiOff, FiNavigation
} from 'react-icons/fi';
import io from 'socket.io-client';
import { eventsAPI, zonesAPI, assignmentsAPI, attendanceAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format, isPast, isFuture, isToday, isTomorrow, differenceInDays, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import MiniMap from '../components/MiniMap';
import AgentInfoPanel from '../components/AgentInfoPanel';
import trackingStatsService from '../services/trackingStatsService';
import useAuthStore from '../hooks/useAuth';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse', color: 'text-gray-500', bg: 'bg-gray-100' },
  { value: 'medium', label: 'Moyenne', color: 'text-blue-500', bg: 'bg-blue-100' },
  { value: 'high', label: 'Haute', color: 'text-orange-500', bg: 'bg-orange-100' },
  { value: 'critical', label: 'Critique', color: 'text-red-500', bg: 'bg-red-100' }
];

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const { user: authUser } = useAuthStore();

  const [event, setEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // États pour le suivi en temps réel
  const [agentLocations, setAgentLocations] = useState({}); // { agentId: { lat, lng, battery, timestamp, isOnline, ...(toutes infos enrichies) } }
  const [onlineAgents, setOnlineAgents] = useState(new Set()); // IDs des agents connectés
  
  // État Socket.IO
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  
  // 🆕 État pour le panneau d'informations enrichies
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
      initializeSocketIO();
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  // Initialiser Socket.IO pour le suivi en temps réel
  const initializeSocketIO = () => {
    const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://security-guard-backend.onrender.com';
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('checkInToken');
    
    socketRef.current = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Socket.IO connecté pour suivi temps réel, eventId:', id);
      setSocketConnected(true);
      setSocketError(null);
      setLastSync(new Date());
      
      // 🔐 Authentifier d'abord via Socket.IO
      console.log('👤 User from authStore:', authUser);
      console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      
      if (!authUser || !authUser.id) {
        console.error('❌ Utilisateur non authentifié dans authStore');
        toast.error('Session expirée. Reconnectez-vous.');
        return;
      }
      
      const authData = {
        userId: authUser.id,
        role: authUser.role,
        eventId: id,
        token: token
      };
      
      console.log('🔐 Authentification Socket.IO EventDetails:', authData);
      socketRef.current.emit('auth', authData);
      
      toast.success('🟢 Suivi temps réel activé', { autoClose: 2000 });
    });

    // Écouter la confirmation d'authentification
    socketRef.current.on('auth:success', (data) => {
      console.log('✅ Authentification Socket.IO réussie:', data);
      
      // Maintenant rejoindre la room de l'événement
      console.log('🚪 Joining rooms pour eventId:', id);
      socketRef.current.emit('event:join', id);
      socketRef.current.emit('tracking:subscribe', id);
    });

    socketRef.current.on('auth:error', (error) => {
      console.error('❌ Erreur authentification Socket.IO:', error);
      console.error('❌ Détails erreur:', JSON.stringify(error, null, 2));
      setSocketError(error.message || 'Erreur d\'authentification');
      toast.error(`❌ Auth Socket.IO: ${error.message || 'Erreur'}`, { autoClose: 5000 });
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Erreur connexion Socket.IO:', error);
      setSocketConnected(false);
      setSocketError(error.message);
    });

    // Écouter les mises à jour de localisation depuis le backend
    socketRef.current.on('tracking:position_update', (data) => {
      console.log('📍 Position GPS reçue (tracking:position_update):', {
        userId: data.userId,
        lat: data.latitude,
        lng: data.longitude,
        battery: data.batteryLevel,
        timestamp: data.timestamp,
        fullData: data
      });
      
      setAgentLocations(prev => {
        const updated = {
          ...prev,
          [data.userId]: {
            // Position GPS
            lat: data.latitude,
            lng: data.longitude,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            altitude: data.altitude,
            speed: data.speed,
            speedKmh: data.speedKmh,
            heading: data.heading,
            isMoving: data.isMoving,
            
            // 🔋 Batterie complète
            battery: data.batteryLevel || 100,
            batteryLevel: data.batteryLevel || 100,
            batteryCharging: data.batteryCharging,
            batteryChargingTime: data.batteryChargingTime,
            batteryDischargingTime: data.batteryDischargingTime,
            batteryStatus: data.batteryStatus,
            batteryEstimatedTime: data.batteryEstimatedTime,
            
            // 📶 Réseau
            networkType: data.networkType,
            networkDownlink: data.networkDownlink,
            networkRtt: data.networkRtt,
            networkSaveData: data.networkSaveData,
            networkOnline: data.networkOnline,
            networkStatus: data.networkStatus,
            
            // 📱 Appareil
            deviceOS: data.deviceOS,
            deviceBrowser: data.deviceBrowser,
            deviceType: data.deviceType,
            devicePlatform: data.devicePlatform,
            deviceLanguage: data.deviceLanguage,
            deviceCPUCores: data.deviceCPUCores,
            deviceMemory: data.deviceMemory,
            deviceScreenResolution: data.deviceScreenResolution,
            deviceScreenOn: data.deviceScreenOn,
            
            // 📊 Statistiques
            stats: data.stats,
            
            // 🗺️ Trajet
            path: data.path,
            
            // Utilisateur
            user: data.user,
            
            // Méta
            timestamp: new Date(data.timestamp),
            isOnline: true,
            status: data.status
          }
        };
        console.log('🗺️ AgentLocations MAJ avec infos enrichies:', updated[data.userId]);
        return updated;
      });
      
      setOnlineAgents(prev => {
        const updated = new Set([...prev, data.userId]);
        console.log('👥 OnlineAgents MAJ:', Array.from(updated));
        return updated;
      });
      
      // 🆕 Mettre à jour l'agent sélectionné si c'est celui-ci
      setSelectedAgent(prev => {
        if (prev && prev.userId === data.userId) {
          return {
            ...prev,
            ...data,
            lat: data.latitude,
            lng: data.longitude
          };
        }
        return prev;
      });
      
      setLastSync(new Date());
    });
    
    // Supporter aussi l'ancien format location-update
    socketRef.current.on('location-update', (data) => {
      console.log('📍 Position GPS reçue (location-update):', data);
      setAgentLocations(prev => ({
        ...prev,
        [data.userId]: {
          lat: data.latitude,
          lng: data.longitude,
          battery: data.batteryLevel || 100,
          accuracy: data.accuracy,
          timestamp: new Date(),
          isOnline: true
        }
      }));
      setOnlineAgents(prev => new Set([...prev, data.userId]));
      setLastSync(new Date());
    });

    // Écouter les connexions/déconnexions
    socketRef.current.on('agent-online', (agentId) => {
      console.log('✅ Agent connecté:', agentId);
      setOnlineAgents(prev => new Set([...prev, agentId]));
    });

    socketRef.current.on('agent-offline', (agentId) => {
      console.log('❌ Agent déconnecté:', agentId);
      setOnlineAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
      setAgentLocations(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], isOnline: false }
      }));
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO déconnecté:', reason);
      setSocketConnected(false);
      toast.warning('🔴 Suivi temps réel désactivé', { autoClose: 3000 });
    });
  };

  // Calculer la distance entre deux points GPS (formule Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  };

  // Vérifier si l'agent est dans le périmètre
  const isAgentInPerimeter = (agentId) => {
    if (!event || !agentLocations[agentId]) return null;
    
    const agentLoc = agentLocations[agentId];
    const distance = calculateDistance(
      parseFloat(event.latitude),
      parseFloat(event.longitude),
      agentLoc.lat,
      agentLoc.lng
    );
    
    const perimeterRadius = parseFloat(event.radius) || 1000;
    return distance <= perimeterRadius;
  };

  // Obtenir la couleur de la batterie
  const getBatteryColor = (level) => {
    if (level >= 50) return 'text-green-500';
    if (level >= 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const fetchEventDetails = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch event
      const eventRes = await eventsAPI.getById(id);
      if (eventRes.data.success) {
        setEvent(eventRes.data.data);
      }

      // Fetch zones
      try {
        const zonesRes = await zonesAPI.getByEvent(id);
        setZones(zonesRes.data.data || []);
      } catch (err) {
        console.log('No zones for this event');
        setZones([]);
      }

      // Fetch assignments
      try {
        const assignRes = await assignmentsAPI.getAll({ eventId: id });
        const assignmentData = assignRes?.data?.data?.assignments || assignRes?.data?.data || [];
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      } catch (err) {
        console.log('No assignments for this event');
        setAssignments([]);
      }

      // Fetch attendance
      try {
        const attRes = await attendanceAPI.getAll({ eventId: id });
        const attendanceData = attRes?.data?.data?.attendances || attRes?.data?.data || [];
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      } catch (err) {
        console.log('No attendance for this event');
        setAttendance([]);
      }

    } catch (err) {
      console.error('Error fetching event details:', err);
      setError('Impossible de charger les détails de l\'événement');
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityInfo = (priority) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
  };

  const getTimeStatus = () => {
    if (!event) return { label: '', class: '' };
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const now = new Date();

    if (isPast(endDate)) {
      return { label: 'Terminé', class: 'bg-gray-100 text-gray-700' };
    }
    if (now >= startDate && now <= endDate) {
      return { label: 'LIVE', class: 'bg-green-100 text-green-700' };
    }
    if (isToday(startDate)) {
      return { label: "Aujourd'hui", class: 'bg-blue-100 text-blue-700' };
    }
    if (isTomorrow(startDate)) {
      return { label: 'Demain', class: 'bg-purple-100 text-purple-700' };
    }
    if (isFuture(startDate)) {
      const days = differenceInDays(startDate, now);
      return { label: `Dans ${days} jours`, class: 'bg-orange-100 text-orange-700' };
    }
    return { label: 'À venir', class: 'bg-gray-100 text-gray-700' };
  };

  const getAttendanceStats = () => {
    const total = assignments.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const absent = assignments.length - attendance.length;

    return { total, present, late, absent };
  };

  const handleEdit = () => {
    navigate(`/events?edit=${id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return;

    try {
      await eventsAPI.delete(id);
      toast.success('Événement supprimé avec succès');
      navigate('/events');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Événement introuvable</h2>
          <p className="text-gray-600 mb-6">{error || 'Cet événement n\'existe pas ou a été supprimé'}</p>
          <button
            onClick={() => navigate('/events')}
            className="btn-primary inline-flex items-center"
          >
            <FiArrowLeft className="mr-2" />
            Retour aux événements
          </button>
        </div>
      </div>
    );
  }

  const timeStatus = getTimeStatus();
  const priorityInfo = getPriorityInfo(event.priority);
  const stats = getAttendanceStats();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Indicateur Socket.IO en haut */}
      <div className={`card ${socketConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} transition-all duration-300`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {socketConnected ? (
              <>
                <div className="relative">
                  <FiWifi className="text-green-600 animate-pulse" size={24} />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                </div>
                <div>
                  <p className="font-bold text-green-900">🟢 Suivi Temps Réel Actif</p>
                  <p className="text-sm text-green-700">
                    Connexion établie • {onlineAgents.size} agent(s) en ligne
                    {lastSync && ` • Dernière sync: ${format(lastSync, 'HH:mm:ss')}`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <FiWifiOff className="text-red-600" size={24} />
                <div>
                  <p className="font-bold text-red-900">🔴 Suivi Temps Réel Désactivé</p>
                  <p className="text-sm text-red-700">
                    {socketError ? `Erreur: ${socketError}` : 'Connexion perdue • Reconnexion en cours...'}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {socketConnected && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-800">LIVE</span>
              </div>
            )}
            <button
              onClick={() => {
                if (socketRef.current) {
                  socketRef.current.disconnect();
                  socketRef.current.connect();
                  toast.info('🔄 Reconnexion Socket.IO...', { autoClose: 2000 });
                }
              }}
              className="btn-secondary text-sm py-1 px-3"
              title="Reconnecter"
            >
              <FiRepeat className="mr-1" size={14} />
              Reconnecter
            </button>
          </div>
        </div>
      </div>

      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <FiArrowLeft className="mr-2" size={20} />
          <span className="font-medium">Retour aux événements</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleEdit}
            className="btn-secondary flex items-center"
          >
            <FiEdit2 className="mr-2" size={18} />
            Modifier
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger flex items-center"
          >
            <FiTrash2 className="mr-2" size={18} />
            Supprimer
          </button>
        </div>
      </div>

      {/* Titre et status */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-black text-gray-900">{event.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${timeStatus.class}`}>
                {timeStatus.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${priorityInfo.bg} ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
            </div>
            {event.description && (
              <p className="text-gray-600 leading-relaxed">{event.description}</p>
            )}
          </div>
        </div>

        {/* Informations principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
          {/* Localisation */}
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-3 rounded-xl">
              <FiMapPin className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Localisation</p>
              <p className="font-semibold text-gray-900">{event.location}</p>
              {event.latitude && event.longitude && (
                <p className="text-xs text-gray-500 mt-1">
                  {parseFloat(event.latitude).toFixed(6)}, {parseFloat(event.longitude).toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* Date et heure */}
          <div className="flex items-start gap-3">
            <div className="bg-purple-100 p-3 rounded-xl">
              <FiCalendar className="text-purple-600" size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Date et heure</p>
              <p className="font-semibold text-gray-900">
                {format(new Date(event.startDate), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              <p className="text-sm text-gray-600">
                <FiClock className="inline mr-1" size={14} />
                {event.checkInTime?.substring(0, 5) || '00:00'} - {event.checkOutTime?.substring(0, 5) || '00:00'}
              </p>
            </div>
          </div>

          {/* Rayon de zone */}
          {event.radius && (
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-3 rounded-xl">
                <FiLayers className="text-green-600" size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Rayon de la zone</p>
                <p className="font-semibold text-gray-900">{event.radius} mètres</p>
              </div>
            </div>
          )}

          {/* Nombre d'agents */}
          <div className="flex items-start gap-3">
            <div className="bg-orange-100 p-3 rounded-xl">
              <FiUsers className="text-orange-600" size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Agents affectés</p>
              <p className="font-semibold text-gray-900">{stats.total} agents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques de présence */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">Total Agents</p>
                <p className="text-3xl font-black text-blue-900">{stats.total}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-xl">
                <FiUsers className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium mb-1">Présents</p>
                <p className="text-3xl font-black text-green-900">{stats.present}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-xl">
                <FiUserCheck className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium mb-1">En retard</p>
                <p className="text-3xl font-black text-yellow-900">{stats.late}</p>
              </div>
              <div className="bg-yellow-500 p-3 rounded-xl">
                <FiClock className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium mb-1">Absents</p>
                <p className="text-3xl font-black text-red-900">{stats.absent}</p>
              </div>
              <div className="bg-red-500 p-3 rounded-xl">
                <FiUserX className="text-white" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carte */}
      {event.latitude && event.longitude && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <FiMapPin className="mr-2 text-blue-600" />
            Carte de localisation en temps réel
          </h2>
          <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Événement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span>Agents en ligne ({onlineAgents.size})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Hors périmètre</span>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ height: '500px' }}>
            <MiniMap
              latitude={event.latitude}
              longitude={event.longitude}
              radius={event.radius}
              zones={zones}
              agentLocations={agentLocations}
              assignments={assignments}
            />
          </div>
        </div>
      )}

      {/* Zones */}
      {zones.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <FiLayers className="mr-2 text-green-600" />
            Zones de patrouille ({zones.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone) => (
              <div key={zone.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
                <h3 className="font-bold text-gray-900 mb-2">{zone.name}</h3>
                {zone.description && (
                  <p className="text-sm text-gray-600 mb-3">{zone.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <FiMapPin className="mr-1" size={12} />
                    {zone.radius}m rayon
                  </span>
                  {zone.assignedAgents && (
                    <span className="flex items-center">
                      <FiUsers className="mr-1" size={12} />
                      {zone.assignedAgents.length} agents
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agents affectés */}
      {assignments.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FiUsers className="mr-2 text-purple-600" />
              Agents affectés ({assignments.length})
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FiWifi className="text-green-500" />
                <span className="text-gray-600">{onlineAgents.size} en ligne</span>
              </div>
              <div className="flex items-center gap-2">
                <FiNavigation className="text-blue-500" />
                <span className="text-gray-600">Tracking temps réel</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zone
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    En ligne
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Latitude
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Longitude
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batterie
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Périmètre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-out
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.map((assignment) => {
                  const agentAttendance = attendance.find(a => a.agentId === assignment.agentId);
                  const isOnline = onlineAgents.has(assignment.agentId);
                  const location = agentLocations[assignment.agentId];
                  const inPerimeter = isAgentInPerimeter(assignment.agentId);
                  
                  return (
                    <tr 
                      key={assignment.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (location && isOnline) {
                          setSelectedAgent({
                            userId: assignment.agentId,
                            ...location,
                            user: assignment.agent || location.user
                          });
                          toast.info(`📊 Infos détaillées: ${assignment.agent?.firstName} ${assignment.agent?.lastName}`, { autoClose: 2000 });
                        } else {
                          toast.warning('❌ Agent non connecté ou pas de données GPS', { autoClose: 2000 });
                        }
                      }}
                      title="Cliquer pour voir les informations détaillées"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="relative">
                            {assignment.agent?.profilePhoto && (
                              <img
                                src={assignment.agent.profilePhoto}
                                alt={`${assignment.agent?.firstName} ${assignment.agent?.lastName}`}
                                className="w-10 h-10 rounded-full mr-3 object-cover"
                              />
                            )}
                            {/* Indicateur en ligne/hors ligne */}
                            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                              isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {assignment.agent?.firstName} {assignment.agent?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{assignment.agent?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {assignment.zone?.name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isOnline ? (
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <FiWifi size={16} />
                            <span className="text-xs font-medium">En ligne</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-gray-400">
                            <FiWifiOff size={16} />
                            <span className="text-xs">Hors ligne</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {location?.lat ? (
                          <span className="text-xs font-mono text-blue-600">
                            {location.lat.toFixed(6)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {location?.lng ? (
                          <span className="text-xs font-mono text-blue-600">
                            {location.lng.toFixed(6)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {location?.battery !== undefined ? (
                          <div className="flex items-center justify-center gap-1">
                            <FiBatteryCharging className={getBatteryColor(location.battery)} size={16} />
                            <span className={`text-xs font-medium ${getBatteryColor(location.battery)}`}>
                              {location.battery}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {inPerimeter === null ? (
                          <span className="text-xs text-gray-400">-</span>
                        ) : inPerimeter ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center justify-center gap-1">
                            <FiCheckCircle size={12} />
                            Dans zone
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center justify-center gap-1 animate-pulse">
                            <FiAlertTriangle size={12} />
                            Hors zone
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {agentAttendance ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            agentAttendance.status === 'present' ? 'bg-green-100 text-green-700' :
                            agentAttendance.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {agentAttendance.status === 'present' ? 'Présent' :
                             agentAttendance.status === 'late' ? 'En retard' : 'Absent'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Non pointé
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {agentAttendance?.checkInTime ? 
                          format(new Date(agentAttendance.checkInTime), 'HH:mm', { locale: fr }) : 
                          '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {agentAttendance?.checkOutTime ? 
                          format(new Date(agentAttendance.checkOutTime), 'HH:mm', { locale: fr }) : 
                          '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message si pas d'agents */}
      {assignments.length === 0 && (
        <div className="card text-center py-12">
          <FiUsers className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun agent affecté</h3>
          <p className="text-gray-600 mb-6">Commencez par affecter des agents à cet événement</p>
          <button
            onClick={() => navigate('/assignments')}
            className="btn-primary inline-flex items-center"
          >
            Gérer les affectations
          </button>
        </div>
      )}

      {/* 🆕 PANNEAU D'INFORMATIONS ENRICHIES */}
      {selectedAgent && (
        <AgentInfoPanel
          agent={selectedAgent}
          stats={selectedAgent.stats}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
};

export default EventDetails;
