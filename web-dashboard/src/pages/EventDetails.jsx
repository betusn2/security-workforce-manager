import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiMapPin, FiClock, FiUsers, FiCalendar, FiEdit2,
  FiTrash2, FiAlertTriangle, FiCheckCircle, FiUserCheck, FiUserX,
  FiActivity, FiShield, FiLayers, FiFlag, FiAlertCircle, FiInfo,
  FiTrendingUp, FiCopy, FiRepeat, FiBatteryCharging, FiWifi, FiWifiOff, FiNavigation,
  FiRefreshCw, FiMessageSquare, FiRadio, FiZap
} from 'react-icons/fi';
import io from 'socket.io-client';
import { eventsAPI, zonesAPI, assignmentsAPI, attendanceAPI, trackingAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format, isPast, isFuture, isToday, isTomorrow, differenceInDays, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import EventMap from '../components/EventMap';
import AgentInfoPanel from '../components/AgentInfoPanel';
import PresenceTimeline from '../components/PresenceTimeline';
import ComplianceScore from '../components/ComplianceScore';
import AlertsPanel from '../components/AlertsPanel';
import AgentAvatar from '../components/AgentAvatar';
import SendMessageModal from '../components/SendMessageModal';
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
  const [screenshotData, setScreenshotData] = useState(null);   // { agentId, imageBase64, timestamp }
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // 🆕 Modal d'envoi de message
  const [msgModal, setMsgModal] = useState(null); // null | { type:'agent'|'event', ... }

  // Ref pour déduplication position updates (même agent, même pos <5s)
  const lastPositionRef = useRef({});

  useEffect(() => {
    if (id) {
      fetchEventDetails();
      initializeSocketIO();
      // 🔄 Periodic API refresh every 30s to catch background/sleep mode positions
      const refreshInterval = setInterval(() => {
        fetchLivePositions();
      }, 30000);
      return () => {
        clearInterval(refreshInterval);
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
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
      // ✅ Déduplication : ignorer si même position pour ce userId dans les 8 dernières secondes
      const lastPos = lastPositionRef.current[data.userId];
      const lat = data.latitude;
      const lng = data.longitude;
      const now = Date.now();
      if (lastPos && Math.abs(lastPos.lat - lat) < 0.000005 && Math.abs(lastPos.lng - lng) < 0.000005 && (now - lastPos.ts) < 8000) {
        return; // Skip doublon
      }
      lastPositionRef.current[data.userId] = { lat, lng, ts: now };

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

    // 📸 Réception capture d'écran/caméra depuis l'app mobile
    socketRef.current.on('agent:screenshot_response', (data) => {
      console.log('📸 Screenshot reçu:', data);
      setScreenshotLoading(false);
      if (data.imageBase64) {
        setScreenshotData({ agentId: data.agentId, imageBase64: data.imageBase64, timestamp: new Date() });
      } else {
        toast.error('📵 L\'agent n\'a pas pu envoyer la capture');
      }
    });

    socketRef.current.on('agent:screenshot_error', (data) => {
      setScreenshotLoading(false);
      toast.error(`📵 Capture impossible: ${data.message || 'l\'agent a refusé'}`);
    });
  };

  // 📡 Charger les dernières positions connues via API (inclut tracking en arrière-plan/veille)
  const fetchLivePositions = async () => {
    try {
      const res = await trackingAPI.getEventLivePositions(id);
      const positions = res?.data?.data || res?.data || [];
      if (Array.isArray(positions) && positions.length > 0) {
        setAgentLocations(prev => {
          const updated = { ...prev };
          positions.forEach(pos => {
            const userId = pos.userId || pos.agentId;
            if (!userId) return;
            // Only update if this API data is newer than socket data
            const existing = prev[userId];
            const newTs = new Date(pos.createdAt || pos.recordedAt || pos.timestamp);
            if (!existing || newTs > existing.timestamp) {
              updated[userId] = {
                lat: parseFloat(pos.latitude),
                lng: parseFloat(pos.longitude),
                latitude: parseFloat(pos.latitude),
                longitude: parseFloat(pos.longitude),
                accuracy: pos.accuracy,
                altitude: pos.altitude,
                speed: pos.speed,
                battery: pos.batteryLevel || 100,
                batteryLevel: pos.batteryLevel || 100,
                batteryCharging: pos.batteryCharging,
                networkType: pos.networkType,
                networkOnline: pos.networkOnline,
                isMoving: pos.isMoving,
                timestamp: newTs,
                isOnline: existing?.isOnline || false, // HTTP = background, may not be in real-time socket
                fromBackground: true,
                user: pos.user
              };
            }
          });
          return updated;
        });
      }
    } catch (err) {
      // Silent fail - live positions are optional enrichment
    }
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

  // Formater "il y a X secondes/minutes" pour la dernière position GPS
  const getLastSeenLabel = (timestamp) => {
    if (!timestamp) return null;
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `il y a ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `il y a ${diffMin}min`;
    const diffHour = Math.floor(diffMin / 60);
    return `il y a ${diffHour}h`;
  };

  // Agents avec position GPS récente (< 5 min), qu'ils soient en ligne ou en fond
  const getRecentGPSCount = () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return assignments.filter(a => {
      const loc = agentLocations[a.agentId];
      return loc && loc.timestamp && new Date(loc.timestamp).getTime() > fiveMinAgo;
    }).length;
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

      // Fetch assignments (limit 100 to get all)
      try {
        const assignRes = await assignmentsAPI.getAll({ eventId: id, limit: 100 });
        const assignmentData = assignRes?.data?.data?.assignments || assignRes?.data?.data || [];
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      } catch (err) {
        console.log('No assignments for this event');
        setAssignments([]);
      }

      // Fetch attendance (limit 100 to get all)
      try {
        const attRes = await attendanceAPI.getAll({ eventId: id, limit: 100 });
        const attendanceData = attRes?.data?.data?.attendances || attRes?.data?.data || [];
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      } catch (err) {
        console.log('No attendance for this event');
        setAttendance([]);
      }

      // 📡 Charger les dernières positions GPS (inclut données envoyées en arrière-plan/veille)
      await fetchLivePositions().catch(() => {});

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
      {/* Indicateur Socket.IO en haut — barre de statut temps réel enrichie */}
      <div className={`card ${socketConnected ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'} transition-all duration-300`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {socketConnected ? (
              <>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                    <FiWifi className="text-white" size={20} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-green-900 text-base">Suivi Temps Réel Actif</p>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">LIVE</span>
                  </div>
                  <p className="text-sm text-green-700 mt-0.5">
                    {lastSync && `Dernière position: ${format(lastSync, 'HH:mm:ss')}`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                  <FiWifiOff className="text-white" size={20} />
                </div>
                <div>
                  <p className="font-black text-red-900 text-base">Suivi Temps Réel Désactivé</p>
                  <p className="text-sm text-red-700">
                    {socketError ? `Erreur: ${socketError}` : 'Connexion perdue • Reconnexion en cours...'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Compteurs en temps réel */}
          {socketConnected && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Agents en ligne */}
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-green-200 shadow-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-gray-700">{onlineAgents.size} en ligne</span>
              </div>
              {/* Agents avec GPS actif */}
              {Object.values(agentLocations).filter(l => l.lat).length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-blue-200 shadow-sm">
                  <FiNavigation className="text-blue-500" size={12} />
                  <span className="text-xs font-bold text-gray-700">{Object.values(agentLocations).filter(l => l.lat).length} GPS actifs</span>
                </div>
              )}
              {/* Agents hors périmètre */}
              {(() => {
                const outCount = assignments.filter(a => {
                  const loc = agentLocations[a.agentId];
                  if (!loc?.lat || !event?.latitude) return false;
                  const d = Math.sqrt(
                    Math.pow((loc.lat - parseFloat(event.latitude)) * 111320, 2) +
                    Math.pow((loc.lng - parseFloat(event.longitude)) * 111320 * Math.cos(parseFloat(event.latitude) * Math.PI / 180), 2)
                  );
                  return d > (parseFloat(event.radius) || 1000);
                }).length;
                return outCount > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-200 shadow-sm animate-pulse">
                    <FiAlertTriangle className="text-red-500" size={12} />
                    <span className="text-xs font-bold text-red-700">{outCount} hors zone</span>
                  </div>
                ) : null;
              })()}
              {/* Batterie la plus faible */}
              {(() => {
                const batteries = Object.values(agentLocations).map(l => l.battery).filter(b => b != null);
                const minBatt = batteries.length > 0 ? Math.min(...batteries) : null;
                if (minBatt == null) return null;
                const color = minBatt <= 20 ? 'text-red-600 border-red-200 bg-red-50' : minBatt <= 50 ? 'text-yellow-600 border-yellow-200 bg-yellow-50' : 'text-green-600 border-green-200 bg-white';
                return (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm ${color}`}>
                    <FiBatteryCharging size={12} />
                    <span className="text-xs font-bold">Min: {minBatt}%</span>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex items-center gap-2">
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
            onClick={fetchEventDetails}
            className="btn-secondary flex items-center"
            title="Rafraîchir les données"
          >
            <FiRefreshCw className="mr-2" size={16} />
            Rafraîchir
          </button>
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

      {/* Carte professionnelle */}
      {event.latitude && event.longitude && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FiMapPin className="text-indigo-600" />
              Carte de localisation en temps réel
            </h2>
            <div className="flex items-center gap-3 text-sm">
              {zones.length > 0 && (
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium border border-indigo-100">
                  {zones.length} zone{zones.length > 1 ? 's' : ''}
                </span>
              )}
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium border border-green-100">
                {onlineAgents.size} en ligne
              </span>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-100">
                {Object.values(agentLocations).filter(l => l.lat).length} GPS actifs
              </span>
            </div>
          </div>
          <EventMap
            event={event}
            zones={zones}
            agentLocations={agentLocations}
            assignments={assignments}
            onlineAgents={onlineAgents}
            flyToAgentId={selectedAgent?.userId}
            height="650px"
            onAgentClick={(agentId) => {
              const assignment = assignments.find(a => a.agentId === agentId);
              const location = agentLocations[agentId];
              setSelectedAgent({
                userId: agentId,
                ...(location || {}),
                user: {
                  ...(assignment?.agent || {}),
                  ...(location?.user || {}),
                  id: agentId,
                  firstName: assignment?.agent?.firstName || location?.user?.firstName || '',
                  lastName: assignment?.agent?.lastName || location?.user?.lastName || '',
                  employeeId: assignment?.agent?.employeeId || '',
                  cin: assignment?.agent?.cin || '',
                  role: assignment?.agent?.role || 'agent',
                  phone: assignment?.agent?.phone || assignment?.agent?.phoneNumber || location?.user?.phone || '',
                  profilePhoto: assignment?.agent?.profilePhoto || null,
                }
              });
            }}
          />
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FiUsers className="mr-2 text-purple-600" />
              Agents affectés ({assignments.length})
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <FiWifi className="text-green-600" size={13} />
                <span className="text-green-700 font-medium text-sm">{onlineAgents.size} en ligne</span>
              </div>
              {getRecentGPSCount() > onlineAgents.size && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
                  <FiNavigation className="text-blue-600" size={13} />
                  <span className="text-blue-700 font-medium text-sm">{getRecentGPSCount()} GPS récent</span>
                </div>
              )}
              {/* 📢 Diffusion à tous les agents */}
              <button
                onClick={() => setMsgModal({
                  type: 'event',
                  eventId: event?.id,
                  eventName: event?.name || 'Événement',
                })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all shadow-sm"
                title="Diffuser un message à tous les agents"
              >
                <FiRadio size={15} />
                Diffuser
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">GPS</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Batterie</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Périmètre</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Présence</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {assignments.map((assignment) => {
                  const agentAttendance = attendance.find(a => a.agentId === assignment.agentId);
                  const isOnline = onlineAgents.has(assignment.agentId);
                  const location = agentLocations[assignment.agentId];
                  const inPerimeter = isAgentInPerimeter(assignment.agentId);
                  const lastSeen = getLastSeenLabel(location?.timestamp);
                  const hasRecentGPS = location?.timestamp && (Date.now() - new Date(location.timestamp).getTime()) < 5 * 60 * 1000;

                  return (
                    <React.Fragment key={assignment.id}>
                    <tr
                      className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${
                        isOnline ? 'bg-green-50/20' : ''
                      }`}
                      onClick={() => {
                        setSelectedAgent({
                          userId: assignment.agentId,
                          ...(location || {}),
                          user: {
                            ...(assignment.agent || {}),
                            ...(location?.user || {}),
                            id: assignment.agentId,
                            firstName: assignment.agent?.firstName || location?.user?.firstName || '',
                            lastName: assignment.agent?.lastName || location?.user?.lastName || '',
                            employeeId: assignment.agent?.employeeId || '',
                            cin: assignment.agent?.cin || '',
                            role: assignment.agent?.role || 'agent',
                            phone: assignment.agent?.phone || assignment.agent?.phoneNumber || location?.user?.phone || '',
                            profilePhoto: assignment.agent?.profilePhoto || null,
                          }
                        });
                      }}
                      title="Cliquer pour voir les informations détaillées"
                    >
                      {/* Agent */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <AgentAvatar
                            photo={assignment.agent?.profilePhoto}
                            firstName={assignment.agent?.firstName}
                            lastName={assignment.agent?.lastName}
                            size="md"
                            online={isOnline}
                          />
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {assignment.agent?.firstName} {assignment.agent?.lastName}
                            </p>
                            <p className="text-xs text-gray-400">{assignment.agent?.employeeId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Zone */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        {assignment.zone?.name ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                            <FiMapPin size={10} className="text-gray-400" />
                            {assignment.zone.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* GPS (status + coords combinés) */}
                      <td className="px-5 py-3 whitespace-nowrap text-center">
                        {isOnline ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-green-600">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                              <FiWifi size={12} />
                              <span className="text-xs font-bold">En ligne</span>
                            </div>
                            {location?.lat && (
                              <span className="text-xs font-mono text-blue-500">
                                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                              </span>
                            )}
                            {lastSeen && <span className="text-xs text-gray-400">{lastSeen}</span>}
                          </div>
                        ) : hasRecentGPS ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-blue-500">
                              <FiNavigation size={12} />
                              <span className="text-xs font-medium">Fond/Veille</span>
                            </div>
                            {location?.lat && (
                              <span className="text-xs font-mono text-blue-400">
                                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                              </span>
                            )}
                            {lastSeen && <span className="text-xs text-gray-400">{lastSeen}</span>}
                          </div>
                        ) : location?.timestamp ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-gray-400">
                              <FiWifiOff size={12} />
                              <span className="text-xs">Hors ligne</span>
                            </div>
                            {lastSeen && <span className="text-xs text-gray-400">{lastSeen}</span>}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <FiWifiOff size={14} className="text-gray-300" />
                            <span className="text-xs text-gray-300">Aucune donnée</span>
                          </div>
                        )}
                      </td>

                      {/* Batterie */}
                      <td className="px-5 py-3 whitespace-nowrap text-center">
                        {location?.battery !== undefined ? (
                          <div className="flex items-center justify-center gap-1">
                            <FiBatteryCharging className={getBatteryColor(location.battery)} size={15} />
                            <span className={`text-xs font-bold ${getBatteryColor(location.battery)}`}>
                              {location.battery}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Périmètre */}
                      <td className="px-5 py-3 whitespace-nowrap text-center">
                        {inPerimeter === null ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : inPerimeter ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <FiCheckCircle size={11} />
                            Dans zone
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">
                            <FiAlertTriangle size={11} />
                            Hors zone
                          </span>
                        )}
                      </td>

                      {/* Présence */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {agentAttendance ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                agentAttendance.status === 'present' ? 'bg-green-100 text-green-700' :
                                agentAttendance.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {agentAttendance.status === 'present' ? 'Présent' :
                                 agentAttendance.status === 'late' ? 'En retard' : 'Absent'}
                              </span>
                              <span className="text-xs text-gray-400">
                                {agentAttendance.checkInTime && format(new Date(agentAttendance.checkInTime), 'HH:mm', { locale: fr })}
                                {agentAttendance.checkOutTime && ` → ${format(new Date(agentAttendance.checkOutTime), 'HH:mm', { locale: fr })}`}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              Non pointé
                            </span>
                          )}
                          {agentAttendance?.id && (
                            <ComplianceScore attendanceId={agentAttendance.id} size="sm" />
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMsgModal({
                            type: 'agent',
                            agentId: assignment.agentId,
                            agentName: `${assignment.agent?.firstName || ''} ${assignment.agent?.lastName || ''}`.trim(),
                          })}
                          title="Envoyer un message à cet agent"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium text-xs transition-all hover:shadow-sm"
                        >
                          <FiMessageSquare size={13} />
                          Msg
                        </button>
                      </td>
                    </tr>

                    {/* Ligne PresenceTimeline */}
                    <tr key={`timeline-${assignment.id}`}>
                      <td colSpan={7} className="px-5 py-2 bg-white border-b border-gray-50">
                        <PresenceTimeline
                          eventId={event?.id}
                          agentId={assignment.agentId}
                          agentName={`${assignment.agent?.firstName || ''} ${assignment.agent?.lastName || ''}`.trim()}
                          eventStart={event?.startDate}
                          eventEnd={event?.endDate}
                        />
                      </td>
                    </tr>
                    </React.Fragment>
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

      {/* 🆕 Modal d'envoi de message */}
      {msgModal && (
        <SendMessageModal
          target={msgModal}
          socketRef={socketRef}
          senderName={authUser ? `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() : 'Responsable'}
          onClose={() => setMsgModal(null)}
        />
      )}

      {/* 🆕 PANNEAU D'INFORMATIONS ENRICHIES */}
      {selectedAgent && (
        <AgentInfoPanel
          agent={selectedAgent}
          stats={selectedAgent.stats}
          onClose={() => { setSelectedAgent(null); setScreenshotData(null); }}
          onScreenshot={(agentId) => {
            setScreenshotLoading(true);
            setScreenshotData(null);
            socketRef.current?.emit('agent:screenshot_request', { agentId, eventId: id });
            toast.info('📸 Demande de capture envoyée à l\'agent...', { autoClose: 3000 });
            // Timeout si pas de réponse
            setTimeout(() => setScreenshotLoading(false), 15000);
          }}
          screenshotData={screenshotData}
          screenshotLoading={screenshotLoading}
        />
      )}
      <AlertsPanel eventId={event?.id} token={localStorage.getItem('token')} />
    </div>
  );
};

export default EventDetails;
