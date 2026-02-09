import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCamera, FiMapPin, FiCheck, FiX, FiAlertCircle, FiAlertTriangle, FiRefreshCw,
  FiLogOut, FiClock, FiCheckCircle, FiLoader, FiUser, FiNavigation,
  FiSmartphone, FiShield, FiSun, FiEye, FiZap, FiPhone, FiMail,
  FiCalendar, FiUsers, FiTarget, FiMap, FiInfo, FiBriefcase,
  FiChevronDown, FiChevronUp, FiMessageCircle, FiGlobe,
  FiCompass, FiLayers, FiActivity, FiAward, FiStar, FiTrendingUp, FiUpload, FiUserPlus
} from 'react-icons/fi';
import { authAPI, attendanceAPI, eventsAPI, usersAPI, assignmentsAPI, zonesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { getDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';
import { computeEventStatus } from '../utils/eventHelpers';
import { getEventTimeStatus, formatTimeRemaining, getHelpMessage, shouldTrackGPS } from '../utils/eventTimeWindows';
import * as faceapi from 'face-api.js';
import SmartMiniMap from '../components/SmartMiniMap';
import AgentCreationModal from '../components/AgentCreationModal';
import IncidentReportModal from '../components/IncidentReportModal';
import NotificationBell from '../components/NotificationBell';
import { useSync, useSyncEvent } from '../hooks/useSync';

// Configuration
const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MATCH_THRESHOLD = 0.50; // Seuil aligné avec 50% de score (1 - 0.50 = 0.50)
const MIN_SCORE = 50;         // Règle métier: Score minimum requis
const MAX_ATTEMPTS = 3;       // Tentatives maximum
const MIN_ACCURACY = 100;
const QUALITY_THRESHOLD = 50;

const QUALITY_THRESHOLDS = {
  minFaceSize: 100,
  maxFaceSize: 400,
  minConfidence: 0.70,
  centerTolerance: 0.35,
};

/**
 * Page de pointage professionnelle
 * Compatible PC, Android, iOS
 * Vue Agent: nom, événements, géolocalisation, zone, superviseur
 * Vue Superviseur: événements, zones gérées, liste agents
 */
const CheckIn = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const lastPositionsRef = useRef([]);
  const autoSubmitRef = useRef(false);  // Track if auto-submit already happened

  // User and data states
  const [user, setUser] = useState(null);
  const [storedDescriptor, setStoredDescriptor] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignedZonesByEvent, setAssignedZonesByEvent] = useState({}); // Map eventId -> zones[]
  const [managedAgents, setManagedAgents] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [currentZone, setCurrentZone] = useState(null);
  const [managedZones, setManagedZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI states
  const [activeTab, setActiveTab] = useState('info');
  const [expandedSections, setExpandedSections] = useState({
    profile: false,
    location: true,
    events: true,
    zone: false,
    supervisor: false,
    agents: false,
    zones: false,
    attendance: false
  });

  // Modal states for supervisors
  const [showAgentCreationModal, setShowAgentCreationModal] = useState(false);
  const [showIncidentReportModal, setShowIncidentReportModal] = useState(false);

  // Validation states
  const [validations, setValidations] = useState({
    facial: { status: 'pending', message: 'En attente' },
    location: { status: 'pending', message: 'En attente' },
    device: { status: 'success', message: 'OK' }
  });

  // Facial recognition states
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('unknown');
  const [faceDetected, setFaceDetected] = useState(false);
  const [quality, setQuality] = useState(null);
  const [matchScore, setMatchScore] = useState(0);
  const [isMatched, setIsMatched] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [facialVerified, setFacialVerified] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0); // Nouveau: compteur de tentatives
  const [isLocked, setIsLocked] = useState(false); // Nouveau: état de blocage

  // Auto check-in states
  const [autoSubmitDone, setAutoSubmitDone] = useState(false);
  const [autoSubmitMessage, setAutoSubmitMessage] = useState('');

  // Location states
  const [location, setLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');

  // Device states
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState(null);

  // Check-in states
  const [submitting, setSubmitting] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [checkInType, setCheckInType] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null); // Événement sélectionné pour check-in

  // Helper functions
  const getRoleBadge = (role) => {
    const badges = {
      supervisor: { bg: 'bg-gradient-to-r from-amber-500 to-orange-500', text: 'Responsable', icon: FiShield },
      admin: { bg: 'bg-gradient-to-r from-red-500 to-pink-500', text: 'Administrateur', icon: FiAward },
      agent: { bg: 'bg-gradient-to-r from-blue-500 to-indigo-500', text: 'Agent', icon: FiUser }
    };
    return badges[role] || badges.agent;
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3;
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

  // Get distance to current event
  const distanceToEvent = useMemo(() => {
    // Utiliser l'événement sélectionné ou le premier par défaut
    const event = todayEvents.find(e => e.id === selectedEventId) || todayEvents[0];
    if (location && event && event?.latitude && event?.longitude) {
      return calculateDistance(
        location.latitude,
        location.longitude,
        parseFloat(event.latitude),
        parseFloat(event.longitude)
      );
    }
    return null;
  }, [location, todayEvents, selectedEventId]);

  // Main UI components
  const roleBadge = useMemo(() => getRoleBadge(user?.role), [user?.role]);

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fonction de vérification faciale simplifiée
  const verifyFace = async (descriptor, storedDescriptor) => {
    if (!descriptor || !storedDescriptor) return 0;
    
    const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);
    const score = Math.max(0, Math.min(100, (1 - distance) * 100));
    
    return score;
  };

  // Gestion des tentatives selon la règle métier
  const handleFaceVerification = async (score) => {
    if (isLocked) {
      toast.error('Trop de tentatives échouées. Retour au login.');
      setTimeout(() => handleLogout(), 3000);
      return false;
    }

    if (score >= MIN_SCORE) {
      // ✅ SUCCÈS : Score ≥ 50%
      setFacialVerified(true);
      setValidations(prev => ({
        ...prev,
        facial: { status: 'success', message: `Identité vérifiée (${Math.round(score)}%)` }
      }));
      toast.success(`✅ Identité vérifiée (${Math.round(score)}%)`);
      setAttemptsCount(0);
      
      // Arrêter la caméra après succès
      setTimeout(() => stopCamera(), 1000);
      return true;
    } else {
      // ❌ ÉCHEC : Score < 50%
      setAttemptsCount(prev => prev + 1);
      
      if (attemptsCount >= MAX_ATTEMPTS - 1) {
        // 🔒 BLOQUÉ : 3 échecs
        setIsLocked(true);
        toast.error(`❌ 3 tentatives échouées. Retour au login...`);
        setTimeout(() => handleLogout(), 3000);
        return false;
      } else {
        // 🔁 RÉESSAYER : Tentatives restantes
        const remaining = MAX_ATTEMPTS - attemptsCount - 1;
        toast.warning(`⚠️ Score: ${Math.round(score)}%. Réessayez (${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''})`);
        
        setValidations(prev => ({
          ...prev,
          facial: { 
            status: 'error', 
            message: `Score: ${Math.round(score)}% - Réessayez (${remaining} restante${remaining > 1 ? 's' : ''})`
          }
        }));
        
        // Réinitialiser pour nouvelle tentative
        setCaptureProgress(0);
        return false;
      }
    }
  };

  // Load user and related data
  useEffect(() => {
    const loadUserData = async () => {
      let checkInToken = localStorage.getItem('checkInToken');
      let checkInUser = localStorage.getItem('checkInUser');

      // Si pas de checkInToken, on en crée un avec checkInLogin
      if (!checkInToken) {
        console.log('🔐 No checkInToken found, creating one via checkInLogin...');
        try {
          const loginResponse = await authAPI.checkInLogin({ 
            // No parameters needed - uses current accessToken
          });
          
          if (loginResponse?.data?.success && loginResponse.data.data) {
            const { checkInToken: newToken, user } = loginResponse.data.data;
            if (newToken) {
              localStorage.setItem('checkInToken', newToken);
              localStorage.setItem('checkInUser', JSON.stringify(user));
              checkInToken = newToken;
              checkInUser = JSON.stringify(user);
              console.log('✅ CheckIn token created successfully');
            }
          } else {
            console.error('❌ CheckIn login failed - invalid response:', loginResponse);
            const errorMsg = loginResponse?.data?.message || 'Impossible de créer une session pointage';
            toast.error(errorMsg);
            navigate('/login');
            return;
          }
        } catch (error) {
          console.error('❌ CheckIn login error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            fullError: error
          });
          const errorMsg = error.response?.data?.message || error.message || 'Erreur d\'authentification';
          toast.error('Erreur: ' + errorMsg);
          navigate('/login');
          return;
        }
      }

      if (!checkInToken || !checkInUser) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        const userData = JSON.parse(checkInUser);
        console.log('🔍 USER DATA LOADED:', {
          id: userData.id,
          firstName: userData.firstName,
          role: userData.role,
          cin: userData.cin
        });
        setUser(userData);

        // Load facial vector
        try {
          const facialResponse = await authAPI.getFacialVectorForCheckIn();
          if (facialResponse.data?.success && facialResponse.data.data?.facialVector) {
            const vector = facialResponse.data.data.facialVector;
            
            console.log('📊 Facial vector loaded:');
            console.log('- Length:', vector.length);
            console.log('- First 5 values:', vector.slice(0, 5));
            
            if (vector.length === 128 || vector.length === 512) {
              setStoredDescriptor(new Float32Array(vector));
              console.log('✅ Facial vector valid, length:', vector.length);
            } else {
              console.warn('⚠️ Unexpected facial vector length:', vector.length);
              toast.warning('Modèle facial incompatible. Utilisez la photo alternative.');
            }
          } else {
            console.warn('No facial vector in response:', facialResponse.data);
          }
        } catch (err) {
          console.warn('Facial vector not available:', err.message);
          toast.info('Aucun modèle facial enregistré. Utilisez la caméra ou la photo alternative.');
        }

        // Load assignments for this user
        try {
          const assignmentsResponse = await assignmentsAPI.getMyAssignments();
          if (assignmentsResponse.data?.success) {
            const assignments = assignmentsResponse.data.data || [];
            console.log('📋 Assignments loaded:', assignments.length);
            console.log('📋 Assignment details:', assignments.map(a => ({
              id: a.id,
              eventId: a.eventId,
              zoneId: a.zoneId,
              zone: a.zone,
              status: a.status
            })));
            setAssignments(assignments);

            // 🔥 Créer un mapping des zones par événement pour l'agent
            const zonesByEvent = {};
            for (const assignment of assignments) {
              if (assignment.eventId && assignment.zone) {
                if (!zonesByEvent[assignment.eventId]) {
                  zonesByEvent[assignment.eventId] = [];
                }
                zonesByEvent[assignment.eventId].push(assignment.zone || assignment.Zone);
              } else if (assignment.eventId && assignment.zoneId) {
                // Si la zone n'est pas incluse, la charger
                try {
                  const zoneResponse = await zonesAPI.getById(assignment.zoneId);
                  if (zoneResponse.data?.success) {
                    if (!zonesByEvent[assignment.eventId]) {
                      zonesByEvent[assignment.eventId] = [];
                    }
                    zonesByEvent[assignment.eventId].push(zoneResponse.data.data);
                  }
                } catch (err) {
                  console.warn('Could not load zone:', err);
                }
              }
            }
            setAssignedZonesByEvent(zonesByEvent);
            console.log('✅ Zones par événement:', zonesByEvent);

            // Get events from assignments
            const eventIds = assignments
              .map(a => a.eventId)
              .filter(Boolean);

            if (eventIds.length > 0) {
              // Fetch all events in parallel
              const eventPromises = eventIds.map(eventId => eventsAPI.getById(eventId));
              const eventResponses = await Promise.all(eventPromises);
              const events = eventResponses
                .map(res => res.data?.data)
                .filter(Boolean);

              // 🔥 FILTRER SEULEMENT ÉVÉNEMENTS ACTIFS (fenêtre check-in ouverte)
              // ❌ Exclure: scheduled (avant 2h), completed, cancelled, terminated
              const filteredEvents = events.filter(event => {
                const status = computeEventStatus(event);
                // Agent peut SEULEMENT accéder pendant la fenêtre de check-in (2h avant → fin)
                return status === 'active';
              }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
              
              setTodayEvents(filteredEvents);
              console.log('✅ Filtered events:', filteredEvents.length);

              // 🔥 Récupérer la zone depuis l'assignment confirmé
              const confirmedAssignment = assignments.find(a => a.status === 'confirmed');
              if (confirmedAssignment) {
                console.log('✅ Confirmed assignment found:', confirmedAssignment);
                // La zone peut être dans assignment.zone ou assignment.Zone
                const zone = confirmedAssignment.zone || confirmedAssignment.Zone;
                if (zone) {
                  console.log('✅ Zone trouvée:', zone.name);
                  setCurrentZone(zone);
                } else if (confirmedAssignment.zoneId) {
                  // Si pas de zone incluse, la charger via API
                  console.log('🔍 Loading zone by ID:', confirmedAssignment.zoneId);
                  try {
                    const zoneResponse = await zonesAPI.getById(confirmedAssignment.zoneId);
                    if (zoneResponse.data?.success) {
                      console.log('✅ Zone chargée:', zoneResponse.data.data.name);
                      setCurrentZone(zoneResponse.data.data);
                    }
                  } catch (zoneErr) {
                    console.warn('Could not load zone:', zoneErr.message);
                  }
                }
              } else {
                console.log('⚠️ No confirmed assignment found');
              }
            }
          }
        } catch (err) {
          console.warn('Could not load assignments:', err.message);
        }

        // Load supervisor info if user has one
        if (userData.supervisorId) {
          try {
            const supervisorResponse = await usersAPI.getById(userData.supervisorId);
            if (supervisorResponse.data?.success) {
              setSupervisor(supervisorResponse.data.data);
            }
          } catch (err) {
            console.warn('Could not load supervisor:', err.message);
          }
        }

        // If user is supervisor, load managed agents and zones
        if (userData.role === 'supervisor' || userData.role === 'responsable') {
          try {
            const agentsResponse = await usersAPI.getSupervisedAgents(userData.id);
            if (agentsResponse.data?.success) {
              setManagedAgents(agentsResponse.data.data || []);
            }
          } catch (err) {
            // Silently ignore 403 errors (insufficient permissions with checkInToken)
            if (err.response?.status !== 403) {
              console.warn('Could not load managed agents:', err.message);
            }
          }

          // Load managed zones for supervisor
          try {
            console.log('🔍 Fetching managed zones for supervisor (userData.id):', userData.id);
            const managedZonesResponse = await zonesAPI.getManagedZones();
            
            console.log('📍 Managed zones response:', managedZonesResponse);
            
            if (managedZonesResponse.data?.success) {
              const zones = managedZonesResponse.data.zones || [];
              console.log('✅ Zones loaded:', zones.length);
              if (zones.length > 0) {
                console.log('Zone names:', zones.map(z => z.name).join(', '));
              }
              setManagedZones(zones);
            } else {
              console.warn('⚠️ Response not successful:', managedZonesResponse.data?.message);
              setManagedZones([]);
            }
          } catch (managedZonesError) {
            console.error('❌ Error loading managed zones:', managedZonesError);
            if (managedZonesError.response) {
              console.error('Error response:', managedZonesError.response.status, managedZonesError.response.data);
            }
            setManagedZones([]);
          }

          // 🔥 Charger les ÉVÉNEMENTS gérés (via zones) au lieu de charger les zones
          try {
            console.log('🔍 Fetching managed events for supervisor (userData.id):', userData.id);
            const managedEventsResponse = await zonesAPI.getManagedEvents();
            
            console.log('📅 Managed events response:', managedEventsResponse);
            
            if (managedEventsResponse.data?.success) {
              const events = managedEventsResponse.data.events || [];
              console.log('✅ Events loaded (raw):', events.length);
              if (events.length > 0) {
                console.log('Event names:', events.map(e => e.name).join(', '));
              }
              
              // 🔥 FILTRER SEULEMENT ÉVÉNEMENTS ACTIFS (fenêtre check-in ouverte)
              // ❌ Exclure: scheduled (avant 2h), completed, cancelled, terminated
              const filteredEvents = events.filter(event => {
                const status = computeEventStatus(event);
                // Agent peut SEULEMENT accéder pendant la fenêtre de check-in (2h avant → fin)
                return status === 'active';
              }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
              
              console.log('✅ Events after filtering:', filteredEvents.length);
              setTodayEvents(filteredEvents);
            } else {
              console.warn('⚠️ Events response not successful:', managedEventsResponse.data?.message);
            }
          } catch (managedEventsError) {
            console.error('❌ Error loading managed events:', managedEventsError);
            if (managedEventsError.response) {
              console.error('Error response:', managedEventsError.response.status, managedEventsError.response.data);
            }
          }
        }

        // Check today's attendance status
        try {
          const todayStatus = await attendanceAPI.getTodayStatus();
          if (todayStatus.data?.success) {
            setTodayAttendance(todayStatus.data.data);
          }
        } catch (err) {
          console.warn('Could not load today status:', err.message);
        }

        // Vérifier le statut de la caméra
        checkCameraStatus();

      } catch (error) {
        console.error('Error loading user:', error);
        if (error.response?.status === 401) {
          toast.error('Session expirée. Veuillez vous reconnecter.');
          localStorage.removeItem('checkInToken');
          localStorage.removeItem('checkInUser');
          navigate('/login');
        } else {
          toast.error('Erreur de chargement des données');
        }
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [navigate]);

  // 🔄 SYNCHRONISATION WEBSOCKET TEMPS RÉEL
  // 🔥 Passer selectedEventId pour authentification Socket.IO avec eventId
  const { isConnected } = useSync(
    user?.id,
    user ? [`event:all`, user.role === 'supervisor' ? 'supervisor' : 'agent'] : [],
    selectedEventId // 🔥 CRITICAL: Envoyer eventId pour que le backend puisse broadcaster dans la bonne room
  );

  // Afficher l'état de connexion
  useEffect(() => {
    if (isConnected && user) {
      console.log('🟢 Connecté au WebSocket de synchronisation');
      toast.success('🔄 Synchronisation temps réel activée', { autoClose: 2000 });
    }
  }, [isConnected, user]);

  // 🔥 BLOQUER L'ACCÈS SI TOUS LES ÉVÉNEMENTS SONT TERMINÉS
  useEffect(() => {
    // Attendre que les données soient chargées
    if (loading || !user) return;

    // Si aucun événement après filtrage, rediriger IMMÉDIATEMENT vers /no-active-events
    if (todayEvents.length === 0 && !loading) {
      console.log('⛔ Aucun événement actif. Redirection immédiate vers /no-active-events');

      // Redirection immédiate sans attendre
      navigate('/no-active-events', { replace: true });
    }
  }, [todayEvents, loading, user, navigate]);

  // Écouter les check-in/check-out en temps réel
  useSyncEvent('checkin', ({ attendance, agent }) => {
    console.log('✅ Check-in détecté:', agent.firstName, agent.lastName);
    
    // Notification visuelle
    toast.info(`✅ ${agent.firstName} ${agent.lastName} a pointé`, {
      position: 'top-right',
      autoClose: 4000
    });
    
    // Recharger les données si c'est notre événement
    if (selectedEventId && attendance.eventId === selectedEventId) {
      loadTodayAttendance();
    }
  });

  useSyncEvent('checkout', ({ attendance, agent }) => {
    console.log('🏁 Check-out détecté:', agent.firstName, agent.lastName);
    
    toast.info(`🏁 ${agent.firstName} ${agent.lastName} a quitté`, {
      position: 'top-right',
      autoClose: 4000
    });
    
    if (selectedEventId && attendance.eventId === selectedEventId) {
      loadTodayAttendance();
    }
  });

  // Écouter les mises à jour d'événements
  useSyncEvent('event:updated', (event) => {
    console.log('📅 Événement mis à jour:', event.name);
    
    setTodayEvents(prev => 
      prev.map(e => e.id === event.id ? event : e)
    );
    
    toast.info(`📅 Événement "${event.name}" mis à jour`, { autoClose: 3000 });
  });

  useSyncEvent('event:status_changed', ({ id, status, oldStatus }) => {
    console.log('📊 Statut événement changé:', id, oldStatus, '→', status);
    
    setTodayEvents(prev => 
      prev.map(e => e.id === id ? { ...e, status } : e)
    );
  });

  // Écouter les nouvelles affectations
  useSyncEvent('assignment:created', (assignment) => {
    if (assignment.agentId === user?.id) {
      console.log('📋 Nouvelle affectation reçue:', assignment);
      
      toast.success(`📋 Nouvelle affectation: ${assignment.event?.name}`, {
        position: 'top-center',
        autoClose: 6000
      });
      
      // Recharger les affectations et événements
      setTimeout(() => {
        window.location.reload(); // Recharger la page pour mettre à jour toutes les données
      }, 2000);
    }
  });

  useSyncEvent('assignment:updated', (assignment) => {
    if (assignment.agentId === user?.id) {
      console.log('📋 Affectation mise à jour:', assignment);
      
      setAssignments(prev =>
        prev.map(a => a.id === assignment.id ? assignment : a)
      );
    }
  });

  useSyncEvent('assignment:deleted', ({ id }) => {
    console.log('❌ Affectation supprimée:', id);
    
    setAssignments(prev => prev.filter(a => a.id !== id));
    
    toast.warning('❌ Une de vos affectations a été supprimée', {
      position: 'top-center',
      autoClose: 5000
    });
  });

  // Écouter les mises à jour de zones (pour superviseurs)
  useSyncEvent('zone:updated', (zone) => {
    if (user?.role === 'supervisor') {
      console.log('📍 Zone mise à jour:', zone.name);
      
      setManagedZones(prev =>
        prev.map(z => z.id === zone.id ? zone : z)
      );
    }
  });

  // Écouter les alertes SOS urgentes
  useSyncEvent('sos:urgent', (alert) => {
    console.log('🚨 ALERTE SOS:', alert);
    
    toast.error(`🚨 ALERTE SOS: ${alert.message}`, {
      position: 'top-center',
      autoClose: false,
      closeButton: true
    });
    
    // Jouer un son d'alerte si possible
    try {
      const audio = new Audio('/sounds/alert.mp3');
      audio.play().catch(e => console.log('Son non disponible'));
    } catch (e) {
      console.log('Son d\'alerte non disponible');
    }
  });

  // Écouter les incidents urgents
  useSyncEvent('incident:urgent', (incident) => {
    console.log('⚠️ INCIDENT URGENT:', incident);
    
    toast.warning(`⚠️ INCIDENT: ${incident.title}`, {
      position: 'top-center',
      autoClose: 8000
    });
  });

  // Écouter les mises à jour de localisation (pour voir les autres agents)
  useSyncEvent('location:updated', ({ userId, latitude, longitude, timestamp }) => {
    if (user?.role === 'supervisor' && userId !== user?.id) {
      console.log('📍 Position agent mise à jour:', userId);
      
      // Mettre à jour la position de l'agent dans managedAgents
      setManagedAgents(prev =>
        prev.map(agent =>
          agent.id === userId
            ? { ...agent, currentLatitude: latitude, currentLongitude: longitude, lastLocationUpdate: timestamp }
            : agent
        )
      );
    }
  });

  // 🔥 TRACKING GPS EN TEMPS RÉEL après le check-in
  useEffect(() => {
    let watchId = null;
    
    // Démarrer le tracking seulement si:
    // 0. L'utilisateur a au moins un événement assigné
    // 1. L'utilisateur a pointé
    // 2. L'utilisateur n'est pas encore sorti
    // 3. On est dans la fenêtre temporelle autorisée (2h avant -> fin événement)
    if (todayEvents.length === 0) {
      console.log('⏸️ GPS Watch désactivé - Aucun événement assigné');
      return;
    }
    
    const selectedEvent = todayEvents.find(e => e.id === selectedEventId) || todayEvents[0];
    const shouldTrack = shouldTrackGPS(selectedEvent, todayAttendance?.checkedIn, todayAttendance?.checkedOut);
    
    if (shouldTrack && user?.id) {
      console.log('📡 Démarrage du tracking GPS en temps réel...');
      
      const sendPosition = (position) => {
        const positionData = {
          userId: user.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          isMoving: (position.coords.speed || 0) > 0.5,
          timestamp: new Date(position.timestamp).toISOString()
        };
        
        // Envoyer via syncService
        const syncService = require('../services/syncService').default;
        const sent = syncService.sendPosition(positionData);
        
        if (sent) {
          console.log('📍 Position GPS envoyée:', positionData.latitude, positionData.longitude);
        }
      };
      
      // Démarrer le watch GPS
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          sendPosition,
          (error) => console.error('❌ Erreur GPS tracking:', error),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
        
        console.log('✅ GPS Watch démarré, ID:', watchId);
      }
    } else if (todayAttendance?.checkedIn && !todayAttendance?.checkedOut) {
      console.log('⏸️ GPS Watch en pause - hors fenêtre temporelle événement');
    }
    
    // Cleanup
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        console.log('🛑 GPS Watch arrêté');
      }
    };
  }, [todayAttendance?.checkedIn, todayAttendance?.checkedOut, user?.id, selectedEventId, todayEvents]);

  // Auto-sélectionner le premier événement quand la liste change (pour agents et responsables)
  useEffect(() => {
    if (todayEvents.length > 0 && !selectedEventId && (user?.role === 'agent' || user?.role === 'supervisor')) {
      setSelectedEventId(todayEvents[0].id);
      console.log('🎯 Auto-sélection du premier événement:', todayEvents[0].name);
    }
  }, [todayEvents, selectedEventId, user]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        console.log('✅ Face API models loaded');
      } catch (error) {
        console.error('Error loading models:', error);
        toast.error('Erreur de chargement des modèles de reconnaissance faciale');
      } finally {
        setModelsLoading(false);
      }
    };
    loadModels();
  }, []);

  // Initialize device
  useEffect(() => {
    const initDevice = async () => {
      try {
        const fingerprint = await getDeviceFingerprint();
        const localInfo = getDeviceInfo();
        setDeviceFingerprint(fingerprint);
        setDeviceInfo(localInfo);
        
        // Get device info from backend API (includes IP, MAC, device name)
        try {
          const deviceResponse = await attendanceAPI.getDeviceInfo();
          if (deviceResponse?.data?.success && deviceResponse.data.data) {
            const backendDeviceInfo = deviceResponse.data.data;
            console.log('📱 Backend device info:', backendDeviceInfo);
            
            // Merge local and backend device info
            setDeviceInfo({
              ...localInfo,
              ipAddress: backendDeviceInfo.ipAddress,
              macAddress: backendDeviceInfo.macAddress || null,
              deviceName: backendDeviceInfo.deviceName
            });
          }
        } catch (apiError) {
          console.warn('Could not get backend device info:', apiError);
        }
      } catch (error) {
        console.warn('Could not get device info:', error);
      }
    };
    initDevice();
  }, []);

  // Géolocalisation
  const requestLocation = useCallback(() => {
    if (locationLoading) return;

    setLocationLoading(true);
    setValidations(prev => ({
      ...prev,
      location: { status: 'loading', message: 'Acquisition position GPS...' }
    }));

    if (!navigator.geolocation) {
      setValidations(prev => ({
        ...prev,
        location: { status: 'error', message: 'GPS non supporté' }
      }));
      setLocationLoading(false);
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    let watchId = null;
    let readings = [];
    const MIN_READINGS = 1;
    const MAX_READINGS = 10;

    const calculateSimpleAverage = (data) => {
      if (data.length === 0) return null;

      const totalLat = data.reduce((sum, r) => sum + r.latitude, 0);
      const totalLng = data.reduce((sum, r) => sum + r.longitude, 0);
      const totalAcc = data.reduce((sum, r) => sum + r.accuracy, 0);

      return {
        latitude: totalLat / data.length,
        longitude: totalLng / data.length,
        accuracy: totalAcc / data.length
      };
    };

    const onSuccess = async (position) => {
      const { latitude, longitude, accuracy } = position.coords;

      if (accuracy > 10000) {
        return;
      }

      readings.push({
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now()
      });

      if (readings.length > MAX_READINGS) {
        readings = readings.slice(-MAX_READINGS);
      }

      if (readings.length >= MIN_READINGS) {
        const avgPosition = calculateSimpleAverage(readings);

        if (avgPosition) {
          setLocation({
            latitude: avgPosition.latitude,
            longitude: avgPosition.longitude
          });
          setLocationAccuracy(avgPosition.accuracy);

          const status = avgPosition.accuracy <= 100 ? 'success' :
                        avgPosition.accuracy <= 300 ? 'warning' : 'error';

          const message = avgPosition.accuracy <= 100 ? `Acceptable (±${Math.round(avgPosition.accuracy)}m)` :
                        avgPosition.accuracy <= 300 ? `Moyen (±${Math.round(avgPosition.accuracy)}m)` :
                        `Précision limitée (±${Math.round(avgPosition.accuracy)}m)`;

          setValidations(prev => ({
            ...prev,
            location: { status, message }
          }));

          // Mise à jour de l'adresse
          updateAddress(avgPosition.latitude, avgPosition.longitude);

          if (readings.length >= 3) {
            navigator.geolocation.clearWatch(watchId);
            setLocationLoading(false);
          }
        }
      } else {
        const currentAccuracy = readings[readings.length - 1]?.accuracy || 0;
        setValidations(prev => ({
          ...prev,
          location: {
            status: 'loading',
            message: `Acquisition (${readings.length}/3) - Précision: ±${Math.round(currentAccuracy)}m`
          }
        }));
      }
    };

    const onError = async (error) => {
      let message = 'Erreur GPS';
      if (error.code === 1) {
        message = 'Accès GPS refusé';
      } else if (error.code === 2) {
        message = 'Position indisponible';
      } else if (error.code === 3) {
        message = 'Délai GPS dépassé';
      }

      setValidations(prev => ({
        ...prev,
        location: { status: 'error', message }
      }));

      setLocationLoading(false);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };

    const updateAddress = async (lat, lng) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();

        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          setLocationAddress(parts.slice(0, 4).join(','));
          setLocationCity(data.address?.city || data.address?.town || data.address?.village || '');
          setLocationCountry(data.address?.country || '');
        }
      } catch (err) {
        console.error('Address lookup failed:', err);
      }
    };

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, geoOptions);

    const timeoutId = setTimeout(() => {
      if (watchId && readings.length >= MIN_READINGS) {
        navigator.geolocation.clearWatch(watchId);
        setLocationLoading(false);
      }
    }, 60000);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (storedDescriptor) {
          try {
            const img = await faceapi.fetchImage(reader.result);
            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ 
                inputSize: 320,
                scoreThreshold: 0.2
              }))
              .withFaceLandmarks()
              .withFaceDescriptor();
              
            if (detection) {
              const score = await verifyFace(detection.descriptor, storedDescriptor);
              setMatchScore(score);
              
              if (score >= MIN_SCORE) {
                setFacialVerified(true);
                toast.success(`✅ Photo acceptée (${Math.round(score)}%)`);
              } else {
                toast.error(`❌ Photo refusée (${Math.round(score)}%) - Score < ${MIN_SCORE}%`);
              }
            }
          } catch (error) {
            // En cas d'erreur, accepte la photo (mode secours)
            setFacialVerified(true);
            setValidations(prev => ({
              ...prev,
              facial: { status: 'success', message: 'Photo importée (mode secours)' }
            }));
            toast.info('✅ Photo validée - Pointage manuel');
          }
        } else {
          // Pas de modèle de référence - accepte
          setFacialVerified(true);
          toast.info('✅ Photo importée');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Fonction pour vérifier le statut de la caméra
  const checkCameraStatus = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        setCameraStatus('notDetected');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setCameraStatus('detected');
      } catch (error) {
        if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setCameraStatus('inUse');
        } else {
          setCameraStatus('notDetected');
        }
      }
    } catch (error) {
      setCameraStatus('unknown');
    }
  };

  // Fonction de diagnostic des caméras
  const diagnoseCamera = async () => {
    toast.info('🔍 Diagnostic des caméras en cours...', { autoClose: 1000 });

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('🚫 Navigateur non compatible. Utilisez Chrome, Firefox ou Edge.');
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        toast.error('📷 Aucune caméra détectée. Vérifiez que votre caméra est branchée.');
        return;
      }

      let workingCameras = 0;
      const cameraNames = [];
      for (let i = 0; i < videoDevices.length; i++) {
        const device = videoDevices[i];
        cameraNames.push(device.label || `Caméra ${i + 1}`);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId } }
          });
          stream.getTracks().forEach(track => track.stop());
          workingCameras++;
        } catch (error) {
          console.log(`Camera ${i + 1} error:`, error.name);
        }
      }

      if (workingCameras > 0) {
        toast.success(`✅ ${workingCameras}/${videoDevices.length} caméra(s) fonctionne(nt) !`, {
          autoClose: 3000
        });
      } else {
        toast.error('⚠️ Les caméras sont détectées mais ne fonctionnent pas.', {
          autoClose: 3000
        });
      }

    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error(`🚫 Erreur de diagnostic: ${error.message}`);
    }
  };

  // Fonction pour donner des conseils spécifiques
  const getCameraTroubleshootingTips = () => {
    const tips = [
      '🔧 Fermez toutes les applications qui utilisent la caméra :',
      '   • WhatsApp Desktop',
      '   • Zoom, Teams, Skype',
      '   • Google Meet, Discord',
      '   • OBS Studio, logiciels de streaming',
      '   • Applications de visioconférence',
      '',
      '🔄 Redémarrez votre navigateur après avoir fermé les applications',
      '',
      '📸 Si ça ne fonctionne pas, utilisez l\'option photo ci-dessous'
    ];

    toast.info(
      <div style={{ textAlign: 'left', fontSize: '14px', lineHeight: '1.4' }}>
        <strong>Conseils pour résoudre le problème caméra :</strong><br />
        {tips.map((tip, index) => (
          <div key={index} style={{ margin: '4px 0' }}>
            {tip}
          </div>
        ))}
      </div>,
      {
        autoClose: 8000,
        position: 'top-center'
      }
    );
  };

  // Conseils pour la reconnaissance faciale
  const showFaceRecognitionTips = () => {
    toast.info(
      <div className="text-left">
        <strong>💡 Conseils pour une meilleure reconnaissance :</strong>
        <ul className="mt-2 space-y-1 text-sm">
          <li>✅ Assurez un bon éclairage (lumière devant vous)</li>
          <li>✅ Enlevez lunettes de soleil/casquette</li>
          <li>✅ Positionnez-vous à 30-50cm de la caméra</li>
          <li>✅ Regardez directement l'objectif</li>
          <li>✅ Assurez-vous que votre visage est bien visible</li>
          <li>✅ Évitez les reflets et contre-jours</li>
        </ul>
      </div>,
      { autoClose: 8000 }
    );
  };

  // Fonction de debug pour voir les scores réels
  const debugFaceRecognition = async () => {
    if (!storedDescriptor) {
      toast.error('Aucun modèle facial stocké');
      return;
    }

    if (!cameraActive) {
      await startCamera();
      setTimeout(debugFaceRecognition, 2000);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      toast.error('Caméra non disponible');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = 224;
    resizedCanvas.height = 224;
    const resizedCtx = resizedCanvas.getContext('2d');
    resizedCtx.drawImage(video, 0, 0, 224, 224);

    try {
      const img = await faceapi.fetchImage(resizedCanvas.toDataURL('image/jpeg', 0.9));
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 320,
          scoreThreshold: 0.2
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const score = await verifyFace(detection.descriptor, storedDescriptor);
        
        const debugInfo = `
          🔍 DEBUG FACE RECOGNITION:
          - Descriptor length: ${detection.descriptor.length}
          - Distance: ${faceapi.euclideanDistance(detection.descriptor, storedDescriptor).toFixed(4)}
          - Score: ${Math.round(score)}%
          - Threshold: ${MATCH_THRESHOLD} (${MIN_SCORE}% min)
          - Match: ${score >= MIN_SCORE ? '✅ YES' : '❌ NO'}
          - Attempts: ${attemptsCount}/${MAX_ATTEMPTS}
        `;
        
        console.log(debugInfo);
        toast.info(
          <div className="text-left">
            <strong>Debug Face Recognition</strong><br/>
            Score: {Math.round(score)}%<br/>
            Minimum: {MIN_SCORE}%<br/>
            Match: {score >= MIN_SCORE ? '✅ OUI' : '❌ NON'}<br/>
            Tentatives: {attemptsCount}/{MAX_ATTEMPTS}
          </div>,
          { autoClose: 5000 }
        );
      } else {
        toast.error('No face detected in debug mode');
      }
    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Debug failed: ' + error.message);
    }
  };

  // Camera functions
  const startCamera = async () => {
    if (cameraActive) {
      toast.info('La caméra est déjà active');
      return;
    }

    if (isLocked) {
      toast.error('Compte temporairement bloqué. Retour au login.');
      setTimeout(() => handleLogout(), 2000);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('🚫 Votre navigateur ne supporte pas l\'accès à la caméra.');
      return;
    }

    try {
      setValidations(prev => ({
        ...prev,
        facial: { status: 'loading', message: 'Recherche de la caméra...' }
      }));

      const constraints = [
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        },
        {
          video: true
        },
        {
          video: {
            facingMode: 'environment'
          }
        }
      ];

      let stream = null;
      let lastError = null;

      for (let i = 0; i < constraints.length; i++) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          break;
        } catch (error) {
          lastError = error;
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            break;
          }
        }
      }

      if (!stream) {
        throw lastError || new Error('Impossible d\'accéder à la caméra');
      }

      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
          };
        }
      }, 100);

      // Progression automatique pour vérification
      setCaptureProgress(0);
      const progressInterval = setInterval(() => {
        setCaptureProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 25;
        });
      }, 1000);

      // Vérification après 4 secondes
      setTimeout(async () => {
        clearInterval(progressInterval);
        setCaptureProgress(100);

        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);

          if (storedDescriptor) {
            try {
              const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ 
                  inputSize: 320,
                  scoreThreshold: 0.2
                }))
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (detection) {
                console.log('✅ Face detected, descriptor length:', detection.descriptor.length);
                
                const score = await verifyFace(detection.descriptor, storedDescriptor);
                setMatchScore(score);
                
                console.log(`📊 Score: ${Math.round(score)}%`);
                console.log(`🎯 Minimum requis: ${MIN_SCORE}%`);
                console.log(`🎯 Tentative: ${attemptsCount + 1}/${MAX_ATTEMPTS}`);

                // Appliquer la règle métier simple
                await handleFaceVerification(score);
              } else {
                console.log('❌ No face detected in the captured frame');
                
                if (attemptsCount >= MAX_ATTEMPTS - 1) {
                  setIsLocked(true);
                  toast.error(`❌ Trop d'échecs. Retour au login...`);
                  setTimeout(() => handleLogout(), 3000);
                } else {
                  toast.warning('Visage non détecté. Positionnez-vous face à la caméra.');
                  setCaptureProgress(0);
                }
              }
            } catch (error) {
              console.error('❌ Face verification error:', error);
              
              if (attemptsCount >= MAX_ATTEMPTS - 1) {
                setIsLocked(true);
                toast.error(`❌ Trop d'erreurs. Retour au login...`);
                setTimeout(() => handleLogout(), 3000);
              } else {
                toast.error('Erreur technique. Réessayez ou utilisez la photo alternative.');
                setCaptureProgress(0);
              }
            }
          } else {
            console.warn('⚠️ No stored facial descriptor');
            toast.warning('Aucun modèle facial enregistré. Utilisez la photo alternative.');
            setFacialVerified(true);
            setValidations(prev => ({
              ...prev,
              facial: { status: 'success', message: 'Vérification alternative' }
            }));
          }
        }
      }, 4000);

    } catch (error) {
      console.error('Camera error:', error);
      
      let errorMessage = 'Impossible d\'accéder à la caméra.';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = '🔐 Accès à la caméra refusé. Autorisez la caméra dans les paramètres du navigateur.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = '📷 Aucune caméra détectée.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = '⚠️ La caméra est déjà utilisée par une autre application.';
      }
      
      toast.error(errorMessage, { autoClose: 5000 });
      
      setValidations(prev => ({
        ...prev,
        facial: { status: 'error', message: 'Caméra indisponible' }
      }));

      setCameraError(error.name);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setCameraActive(false);
    setCaptureProgress(0);
  }, []);

  // Quality analysis
  const analyzeQuality = useCallback((detection, videoWidth, videoHeight) => {
    const { box, score } = detection.detection;
    const factors = {};

    const sizeOk = box.width >= QUALITY_THRESHOLDS.minFaceSize && box.width <= QUALITY_THRESHOLDS.maxFaceSize;
    const sizeScore = sizeOk ? 100 : box.width < QUALITY_THRESHOLDS.minFaceSize
      ? (box.width / QUALITY_THRESHOLDS.minFaceSize) * 100
      : (QUALITY_THRESHOLDS.maxFaceSize / box.width) * 100;
    factors.size = { score: Math.min(100, sizeScore), ok: sizeOk };

    const confidenceScore = score * 100;
    factors.confidence = { score: confidenceScore, ok: confidenceScore >= QUALITY_THRESHOLDS.minConfidence * 100 };

    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    const offsetX = Math.abs(faceCenterX - videoWidth / 2) / videoWidth;
    const offsetY = Math.abs(faceCenterY - videoHeight / 2) / videoHeight;
    const positionScore = Math.max(0, 100 - (offsetX + offsetY) * 200);
    factors.position = { score: positionScore, ok: positionScore > 60 };

    const currentPos = { x: box.x, y: box.y, w: box.width };
    lastPositionsRef.current.push(currentPos);
    if (lastPositionsRef.current.length > 10) lastPositionsRef.current.shift();

    let stabilityScore = 0;
    if (lastPositionsRef.current.length >= 5) {
      const positions = lastPositionsRef.current;
      let totalMovement = 0;
      for (let i = 1; i < positions.length; i++) {
        totalMovement += Math.abs(positions[i].x - positions[i-1].x) +
                         Math.abs(positions[i].y - positions[i-1].y);
      }
      stabilityScore = Math.max(0, Math.min(100, 100 - totalMovement / positions.length * 3));
    }
    factors.stability = { score: stabilityScore, ok: stabilityScore > 70 };

    const overallScore = Math.round(
      (factors.size.score * 0.25 + factors.confidence.score * 0.3 +
       factors.position.score * 0.25 + factors.stability.score * 0.2)
    );

    return {
      score: overallScore,
      isGood: overallScore >= QUALITY_THRESHOLD && factors.stability.ok,
      factors
    };
  }, []);

  // Generate feedback
  const generateFeedback = useCallback((quality, isMatched) => {
    const items = [];

    if (!quality) {
      return [{ type: 'error', message: 'Positionnez votre visage', icon: FiUser }];
    }

    if (!quality.factors.size.ok) {
      items.push({
        type: 'warning',
        message: quality.factors.size.score < 50 ? 'Rapprochez-vous' : 'Eloignez-vous',
        icon: FiUser
      });
    }

    if (!quality.factors.position.ok) {
      items.push({ type: 'warning', message: 'Centrez votre visage', icon: FiEye });
    }

    if (!quality.factors.confidence.ok) {
      items.push({ type: 'warning', message: 'Améliorez l\'éclairage', icon: FiSun });
    }

    if (!quality.factors.stability.ok) {
      items.push({ type: 'warning', message: 'Restez immobile', icon: FiZap });
    }

    if (!isMatched && quality.isGood) {
      items.push({ type: 'error', message: 'Visage non reconnu', icon: FiAlertCircle });
    }

    if (items.length === 0 && quality.isGood && isMatched) {
      items.push({ type: 'success', message: 'Parfait ! Maintenir...', icon: FiCheck });
    }

    return items;
  }, []);

  // Face detection loop
  useEffect(() => {
    if (!cameraActive || !modelsLoaded || facialVerified || isLocked) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    let isRunning = true;

    const detectFace = async () => {
      if (!isRunning) return;

      try {
        // Options plus sensibles
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 320,
            scoreThreshold: 0.2
          }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          setFaceDetected(true);

          if (storedDescriptor) {
            const score = await verifyFace(detection.descriptor, storedDescriptor);
            
            if (score > 0) {
              console.log(`Real-time score: ${Math.round(score)}%`);
            }
            
            setMatchScore(score);
            setIsMatched(score >= MIN_SCORE);
          }

          // Analyse de qualité avec critères assouplis
          const qualityResult = analyzeQuality(detection, video.videoWidth, video.videoHeight);
          setQuality(qualityResult);

          // Feedback simple
          if (storedDescriptor) {
            const score = await verifyFace(detection.descriptor, storedDescriptor);
            const feedbackItems = [{
              type: score >= MIN_SCORE ? 'success' : 'warning',
              message: score >= MIN_SCORE 
                ? `✅ Correspondance: ${Math.round(score)}%` 
                : `⚠️ Score: ${Math.round(score)}% (min: ${MIN_SCORE}%)`,
              icon: score >= MIN_SCORE ? FiCheck : FiAlertCircle
            }];
            setFeedback(feedbackItems);
          }

        } else {
          setFaceDetected(false);
          setFeedback([{ 
            type: 'warning', 
            message: 'Approchez-vous de la caméra', 
            icon: FiUser 
          }]);
        }
      } catch (error) {
        console.error('Face detection error:', error);
      }

      if (isRunning) {
        animationRef.current = requestAnimationFrame(detectFace);
      }
    };

    detectFace();

    return () => {
      isRunning = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [cameraActive, modelsLoaded, storedDescriptor, analyzeQuality, facialVerified, isLocked]);

  // Submit check-in
  // Capture facial photo from canvas
  const captureFacialPhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.warn('⚠️ Video or canvas ref not available');
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64 JPEG with 90% quality
      const photoData = canvas.toDataURL('image/jpeg', 0.9);
      console.log('📸 FACIAL PHOTO CAPTURED:', {
        dataLength: photoData.length,
        timestamp: new Date().toISOString()
      });
      return photoData;
    } catch (error) {
      console.error('❌ ERROR CAPTURING PHOTO:', error);
      return null;
    }
  };

  // Fonction pour recharger les pointages du jour
  const loadTodayAttendance = useCallback(async () => {
    if (!selectedEventId) return;
    
    try {
      const response = await attendanceAPI.getTodayAttendance(selectedEventId);
      if (response.data?.success) {
        setTodayAttendance(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement pointages:', error);
    }
  }, [selectedEventId]);

  const submitCheckIn = useCallback(async (type) => {
    console.log('⏱️ submitCheckIn called with type:', type);
    setSubmitting(true);
    setCheckInType(type);

    try {
      // Utiliser l'événement sélectionné ou le premier par défaut
      const selectedEvent = todayEvents.find(e => e.id === selectedEventId) || todayEvents[0];
      
      if (!selectedEvent) {
        toast.error('Aucun événement sélectionné');
        setSubmitting(false);
        return;
      }

      const tolerance = locationAccuracy ? Math.round(locationAccuracy * 0.5) : 50;
      const eventDistance = calculateDistance(
        location?.latitude,
        location?.longitude,
        selectedEvent.latitude,
        selectedEvent.longitude
      );
      const isWithinZone = eventDistance !== null &&
        eventDistance <= (selectedEvent.geoRadius || 100) + tolerance;

      // Capture facial photo before sending
      const capturedPhoto = captureFacialPhoto();

      const data = {
        latitude: location?.latitude || 33.5731,
        longitude: location?.longitude || -7.5898,
        accuracy: locationAccuracy || 10,
        tolerance: tolerance,
        isWithinTolerance: isWithinZone,
        deviceFingerprint: deviceFingerprint || 'testing-device',
        deviceInfo: {
          ...(deviceInfo || { browser: 'Chrome', os: 'Windows' }),
          deviceName: deviceInfo?.deviceName || null,
          ipAddress: deviceInfo?.ipAddress || null,
          // Use deviceFingerprint as MAC address if not available
          macAddress: deviceInfo?.macAddress || deviceFingerprint?.substring(0, 17) || null
        },
        facialVerified: facialVerified || false,
        facialMatchScore: facialVerified ? matchScore : 0,
        facialVerifiedAt: facialVerified ? new Date().toISOString() : null,
        eventId: selectedEvent.id,
        distanceToEvent: eventDistance,
        geoRadius: selectedEvent.geoRadius || 100,
        checkInPhoto: capturedPhoto,
        checkInMethod: 'facial'
      };

      console.log('📱 Device Info Being Sent:', {
        deviceName: data.deviceInfo.deviceName,
        ipAddress: data.deviceInfo.ipAddress,
        macAddress: data.deviceInfo.macAddress
      });

      // Validation: eventId is required
      if (!data.eventId) {
        console.error('❌ eventId is missing! selectedEvent:', selectedEvent);
        toast.error('Aucun événement sélectionné');
        setSubmitting(false);
        return;
      }

      console.log('📤 SENDING CHECK-IN:', {
        eventId: data.eventId,
        eventName: selectedEvent.name,
        latitude: data.latitude,
        longitude: data.longitude,
        facialVerified: data.facialVerified,
        facialMatchScore: data.facialMatchScore,
        photoLength: data.checkInPhoto ? data.checkInPhoto.length : 0,
        photoPresent: !!data.checkInPhoto,
        token: localStorage.getItem('checkInToken') ? '✓ checkInToken' : (localStorage.getItem('accessToken') ? '✓ accessToken' : '❌ No token')
      });

      let response;
      if (type === 'in') {
        response = await attendanceAPI.checkIn(data);
      } else {
        if (todayAttendance?.attendanceId) {
          response = await attendanceAPI.checkOut(todayAttendance.attendanceId, data);
        } else {
          throw new Error('Aucun pointage d\'entrée trouvé');
        }
      }

      console.log('📥 CHECK-IN RESPONSE:', response);

      // Handle response: success from server
      const isSuccess = response?.data?.success;
      
      if (isSuccess) {
        setCheckInSuccess(true);
        console.log('✅ CHECK-IN SUCCESSFUL:', response.data);
        toast.success(type === 'in' ? 'Entrée enregistrée!' : 'Sortie enregistrée!');
      } else {
        // Server returned error response
        const errorMessage = response?.data?.message || 'Erreur lors de l\'enregistrement';
        console.warn('⚠️ Server returned error:', { response, errorMessage });
        alert(`❌ Erreur du check-in:\n${errorMessage}`);
        toast.error(errorMessage);
      }
    } catch (error) {
      // This is a real network/parsing error, not a handled API error
      const errorMsg = error.response?.data?.message || error.message || 'Erreur inconnue';
      console.error('❌ CHECK-IN NETWORK ERROR:', {
        message: errorMsg,
        status: error.response?.status,
        data: error.response?.data,
        fullError: error
      });
      
      // Always show error as alert for visibility
      alert(`❌ Erreur réseau du check-in:\n${errorMsg}\n\nVérifiez la console (F12) pour plus de détails.`);
      
      if (errorMsg.toLowerCase().includes('distance') || errorMsg.toLowerCase().includes('hors zone')) {
        const tolerance = Math.round((locationAccuracy || 100) * 0.5);
        toast.error(
          `Hors zone (${Math.round(distanceToEvent)}m de la cible). Marge de tolérance: ±${tolerance}m.`,
          { autoClose: 4000 }
        );
      } else {
        toast.error(errorMsg, { autoClose: 5000 });
      }
    } finally {
      setSubmitting(false);
    }
  }, [location, locationAccuracy, distanceToEvent, todayEvents, facialVerified, matchScore, deviceFingerprint, deviceInfo, todayAttendance?.attendanceId]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('checkInToken');
    localStorage.removeItem('checkInUser');
    stopCamera();
    navigate('/login');
  };

  // Reset for new check-in
  const resetForNew = () => {
    setCheckInSuccess(false);
    setCheckInType(null);
    setFacialVerified(false);
    setCaptureProgress(0);
    setAttemptsCount(0);
    setIsLocked(false);
    setValidations(prev => ({
      ...prev,
      facial: { status: 'pending', message: 'En attente' }
    }));
    requestLocation();
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    return timeStr.substring(0, 5);
  };

  // Auto-submit when all validations pass
  useEffect(() => {
    // Log current validation state
    console.log('🔍 AUTO-SUBMIT CHECK:', {
      autoSubmitRef: autoSubmitRef.current,
      checkedIn: todayAttendance?.checkedIn,
      submitting,
      loading,
      facial: validations.facial.status,
      location: validations.location.status,
      device: validations.device.status
    });

    // Don't auto-submit if:
    if (autoSubmitRef.current) {
      console.log('ℹ️ Already auto-submitted, skipping');
      return;
    }
    if (todayAttendance?.checkedIn) {
      console.log('ℹ️ Already checked in, skipping');
      return;
    }
    if (submitting) {
      console.log('ℹ️ Submission in progress, skipping');
      return;
    }
    if (loading) {
      console.log('ℹ️ Still loading, skipping');
      return;
    }

    // Check if all validations are acceptable (success or warning)
    const allValidationsPass =
      validations.facial.status === 'success' &&
      (validations.location.status === 'success' || validations.location.status === 'warning') &&
      validations.device.status === 'success';

    console.log(`📊 All validations pass: ${allValidationsPass}`);
    console.log('   Facial:', validations.facial);
    console.log('   Location:', validations.location);
    console.log('   Device:', validations.device);

    if (allValidationsPass) {
      console.log('✅ All validations passed - Auto-submitting check-in...');
      setAutoSubmitMessage('✓ Validation complète - Check-in automatique en cours...');
      autoSubmitRef.current = true;  // Mark as submitted via ref

      // Submit immediately
      console.log('⏱️ Calling submitCheckIn() now...');
      submitCheckIn('in');
    } else {
      console.warn('❌ Not all validations passed yet');
    }
  }, [validations, todayAttendance?.checkedIn, submitting, loading, submitCheckIn]);

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary-500/30 rounded-full animate-pulse"></div>
            <FiLoader className="absolute inset-0 m-auto text-white animate-spin" size={32} />
          </div>
          <p className="text-white/70 mt-4 font-medium">Chargement de vos données...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (checkInSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
            <FiCheck className="text-white" size={48} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {checkInType === 'in' ? 'Entrée enregistrée!' : 'Sortie enregistrée!'}
          </h1>
          <p className="text-4xl font-bold text-green-600 mb-2">
            {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-gray-500 mb-6">
            {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          <div className="space-y-3">
            <button
              onClick={resetForNew}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Nouveau pointage
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            >
              <FiLogOut size={18} />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
      {/* Input caché pour le mode secours */}
      <input
        type="file"
        id="facial-upload"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Profile Photo */}
            <div className="relative">
              {user?.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  alt=""
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white/30 shadow-lg"
                />
              ) : (
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
            </div>

            {/* User Info */}
            <div>
              <p className="font-bold text-white text-base md:text-lg">
                {user?.firstName} {user?.lastName}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge.bg} text-white flex items-center gap-1`}>
                  <roleBadge.icon size={10} />
                  {roleBadge.text}
                </span>
                <span className="text-xs text-white/50 hidden sm:inline">ID: {user?.employeeId}</span>
              </div>
            </div>
          </div>

          {/* Actions: Notifications & Logout */}
          <div className="flex items-center gap-2">
            {/* Indicateur de synchronisation WebSocket */}
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400 font-medium hidden sm:inline">Temps réel</span>
              </div>
            )}
            
            {/* Notification Bell */}
            <NotificationBell className="text-white" />
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-3 text-white/70 hover:text-red-400 hover:bg-white/10 rounded-xl transition-all"
              title="Déconnexion"
            >
              <FiLogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Clock */}
      <div className="text-center py-4 md:py-6 max-w-6xl mx-auto px-4">
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/10">
          <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-white font-mono tracking-wider">
            {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-white/60 text-sm md:text-base mt-2 capitalize">
            {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 max-w-6xl mx-auto">
        <div className="flex bg-white/10 rounded-2xl p-1.5 mb-4">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'info' ? 'bg-white text-gray-900 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <FiInfo size={18} />
            <span className="hidden sm:inline">Informations</span>
            <span className="sm:hidden">Info</span>
          </button>
          <button
            onClick={() => setActiveTab('pointage')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'pointage' ? 'bg-white text-gray-900 shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <FiCamera size={18} />
            Pointage
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-8 max-w-6xl mx-auto">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* User Profile Card */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => toggleSection('profile')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${roleBadge.bg} flex items-center justify-center shadow-lg`}>
                      <FiUser className="text-white" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Mon Profil</p>
                      <p className="text-white/60 text-sm">{user?.email}</p>
                    </div>
                  </div>
                  {expandedSections.profile ? (
                    <FiChevronUp className="text-white/60" size={20} />
                  ) : (
                    <FiChevronDown className="text-white/60" size={20} />
                  )}
                </button>

                {expandedSections.profile && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="bg-white/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Nom complet</span>
                        <span className="text-white font-medium">{user?.firstName} {user?.lastName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Matricule</span>
                        <span className="text-white font-mono">{user?.employeeId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">CIN</span>
                        <span className="text-white font-mono">{user?.cin || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Téléphone</span>
                        <a href={`tel:${user.phone}`} className="text-blue-400 hover:underline">{user?.phone || 'N/A'}</a>
                      </div>
                      {user?.rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/60 text-sm">Note</span>
                          <div className="flex items-center gap-1">
                            <FiStar className="text-yellow-400" size={14} />
                            <span className="text-white font-medium">{user.rating}/5</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Geolocation Card */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                <div
                  onClick={() => toggleSection('location')}
                  className="w-full p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                      location ? (distanceToEvent <= (todayEvents[0]?.geoRadius || 100) ? 'bg-gradient-to-r from-green-500 to-emerald-500 scale-110' : 'bg-gradient-to-r from-orange-500 to-red-500') : 'bg-gray-500'
                    }`}>
                      <FiMapPin className="text-white" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Ma Position</p>
                      <div className="flex flex-col">
                        <p className="text-white/60 text-xs">
                          {locationLoading ? 'Acquisition haute précision...' :
                           location ? `Précision: ±${Math.round(locationAccuracy)}m` : 'Attente du signal...'}
                        </p>
                        {distanceToEvent !== null && (
                          <p className={`text-sm font-bold mt-0.5 ${distanceToEvent <= (todayEvents[0]?.geoRadius || 100) ? 'text-green-400' : 'text-orange-400'}`}>
                            → {distanceToEvent > 1000 ? `${(distanceToEvent/1000).toFixed(2)} km` : `${Math.round(distanceToEvent)}m`} du site
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {distanceToEvent !== null && distanceToEvent > (todayEvents[0]?.geoRadius || 100) && (
                      <div className="hidden sm:flex bg-red-500/20 text-red-400 px-2 py-1 rounded-lg text-[10px] font-bold border border-red-500/30 animate-pulse">
                        HORS ZONE
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); requestLocation(); }}
                      disabled={locationLoading}
                      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title={location ? "Actualiser ma position" : "Activer le GPS"}
                    >
                      <FiRefreshCw className={locationLoading ? 'animate-spin' : ''} size={18} />
                    </button>
                    {expandedSections.location ? (
                      <FiChevronUp className="text-white/60" size={20} />
                    ) : (
                      <FiChevronDown className="text-white/60" size={20} />
                    )}
                  </div>
                </div>

                {expandedSections.location && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Smart Map with AI */}
                    <div className="h-96 rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 relative group">
                      {todayEvents.length > 0 && location ? (
                        <>
                          <SmartMiniMap
                            latitude={location.latitude}
                            longitude={location.longitude}
                            targetLat={(todayEvents.find(e => e.id === selectedEventId) || todayEvents[0])?.latitude}
                            targetLng={(todayEvents.find(e => e.id === selectedEventId) || todayEvents[0])?.longitude}
                            geoRadius={(todayEvents.find(e => e.id === selectedEventId) || todayEvents[0])?.geoRadius || 100}
                            events={todayEvents.map(event => ({
                              id: event.id,
                              name: event.name,
                              latitude: event.latitude,
                              longitude: event.longitude,
                              priority: event.priority === 'critical' ? 10 : 
                                        event.priority === 'high' ? 8 : 
                                        event.priority === 'normal' ? 5 : 3,
                              type: event.type || 'patrol',
                              geoRadius: event.geoRadius || 100,
                              isSelected: event.id === selectedEventId
                            }))}
                            enableClustering={todayEvents.length > 5}
                            enableSmartRouting={true}
                            enablePredictions={true}
                            height="384px"
                          />
                        </>
                      ) : (
                        <div className="absolute inset-0 z-[1001] bg-blue-500/10 flex items-center justify-center backdrop-blur-sm">
                          <div className="text-center text-blue-400 p-4">
                            <FiLoader className="animate-spin mx-auto mb-2" size={32} />
                            <p className="text-sm font-medium">Chargement de la carte...</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); requestLocation(); }}
                              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all"
                            >
                              <FiMapPin className="mr-2" size={16} />
                              Activer le GPS
                            </button>
                          </div>
                        </div>
                      )}

                      {!location && (
                        <div className="absolute inset-0 z-[1001] bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                          <div className="text-center text-white p-4">
                            <FiLoader className="animate-spin mx-auto mb-2" size={24} />
                            <p className="text-xs font-medium">Recherche satellite...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status check */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                         <div className={`p-3 rounded-xl border flex flex-col items-center justify-center ${distanceToEvent <= ((todayEvents.find(e => e.id === selectedEventId) || todayEvents[0])?.geoRadius || 100) ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                           <span className="text-[10px] text-white/50 uppercase">Distance</span>
                           <span className={`text-lg font-bold ${distanceToEvent <= ((todayEvents.find(e => e.id === selectedEventId) || todayEvents[0])?.geoRadius || 100) ? 'text-green-400' : 'text-red-400'}`}>
                             {distanceToEvent !== null ? (distanceToEvent > 1000 ? `${(distanceToEvent/1000).toFixed(1)}km` : `${Math.round(distanceToEvent)}m`) : '--'}
                           </span>
                         </div>
                         <div className={`p-3 rounded-xl border flex flex-col items-center justify-center ${locationAccuracy <= 30 ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                           <span className="text-[10px] text-white/50 uppercase">Précision</span>
                           <span className={`text-lg font-bold ${locationAccuracy <= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                             ±{locationAccuracy ? Math.round(locationAccuracy) : '--'}m
                           </span>
                         </div>
                      </div>

                      {locationAccuracy > 100 && distanceToEvent !== null && (
                        <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <FiAlertCircle className="text-amber-400 mt-0.5 flex-shrink-0" size={16} />
                            <div className="text-left">
                              <p className="text-amber-300 text-xs font-semibold mb-1">Marge de sécurité appliquée</p>
                              <p className="text-white/70 text-[10px] leading-tight">
                                Précision GPS limitée (±{Math.round(locationAccuracy)}m). Le système applique automatiquement
                                une tolérance de ±{Math.round(locationAccuracy * 0.5)}m.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {locationAccuracy > 300 && (
                        <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <FiAlertCircle className="text-orange-400 mt-0.5 flex-shrink-0" size={16} />
                            <div className="text-left">
                              <p className="text-orange-300 text-xs font-semibold mb-1">Signal GPS faible</p>
                              <p className="text-white/70 text-[10px] leading-tight">
                                Pour améliorer la précision: rapprochez-vous d'une fenêtre.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Coordinates */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <FiGlobe className="text-blue-400" size={18} />
                        <span className="text-blue-300 font-medium">Coordonnées GPS</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                          <p className="text-white/50 text-xs">Latitude</p>
                          <p className="text-white font-mono">{location?.latitude?.toFixed(6) || '--'}</p>
                        </div>
                        <div>
                          <p className="text-white/50 text-xs">Longitude</p>
                          <p className="text-white font-mono">{location?.longitude?.toFixed(6) || '--'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    {locationAddress && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <FiCompass className="text-white/60 mt-0.5" size={16} />
                          <div>
                            <p className="text-white text-sm">{locationAddress}</p>
                            {(locationCity || locationCountry) && (
                              <p className="text-white/50 text-xs mt-1">
                                {[locationCity, locationCountry].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Accuracy indicator */}
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <div className={`w-3 h-3 rounded-full ${
                        locationAccuracy <= 50 ? 'bg-green-500' :
                        locationAccuracy <= 100 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-white/70 text-sm">
                        Précision: {Math.round(locationAccuracy)}m
                        {locationAccuracy <= 50 ? ' (Excellente)' :
                         locationAccuracy <= 100 ? ' (Bonne)' : ' (Faible)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Events */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => toggleSection('events')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                      <FiCalendar className="text-white" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">
                        {user?.role === 'supervisor' ? 'Événements Gérés' : 'Événements Actifs'}
                      </p>
                      <p className="text-white/60 text-sm">
                        {todayEvents.length} événement(s) {user?.role === 'supervisor' ? 'sous ma responsabilité' : 'en cours/à venir'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full text-xs font-bold">
                      {todayEvents.length}
                    </span>
                    {expandedSections.events ? (
                      <FiChevronUp className="text-white/60" size={20} />
                    ) : (
                      <FiChevronDown className="text-white/60" size={20} />
                    )}
                  </div>
                </button>

                {expandedSections.events && (
                  <div className="px-4 pb-4 space-y-3">
                    {todayEvents.length === 0 ? (
                      <div className="text-center py-8 bg-white/5 rounded-xl">
                        <FiCalendar className="mx-auto mb-3 text-white/30" size={40} />
                        <p className="text-white/50">Aucun événement aujourd'hui</p>
                      </div>
                    ) : (
                      todayEvents.map((event, idx) => {
                        // Filtrer les zones gérées qui appartiennent à cet événement (pour supervisors)
                        const eventZones = managedZones.filter(zone => zone.eventId === event.id);
                        
                        // Pour les agents: récupérer TOUTES les zones assignées pour cet événement
                        const agentAssignedZones = user?.role === 'agent' ? (assignedZonesByEvent[event.id] || []) : [];
                        
                        // Vérifier si c'est l'événement sélectionné
                        const isSelected = selectedEventId === event.id || (!selectedEventId && idx === 0);
                        
                        return (
                          <div 
                            key={idx} 
                            className={`bg-white/5 rounded-xl p-4 border-l-4 transition-all cursor-pointer ${
                              isSelected 
                                ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' 
                                : 'border-blue-500 hover:bg-white/10'
                            }`}
                            onClick={() => {
                              if (user?.role === 'agent' || user?.role === 'supervisor') {
                                setSelectedEventId(event.id);
                                toast.success(`Événement "${event.name}" sélectionné`);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-2 flex-1">
                                {(user?.role === 'agent' || user?.role === 'supervisor') && (
                                  <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isSelected 
                                      ? 'border-green-500 bg-green-500' 
                                      : 'border-white/30 bg-transparent'
                                  }`}>
                                    {isSelected && <FiCheck size={14} className="text-white" />}
                                  </div>
                                )}
                                <h4 className="text-white font-semibold text-base flex-1">{event.name}</h4>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                event.status === 'active' ? 'bg-green-500/20 text-green-300' :
                                event.status === 'scheduled' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-gray-500/20 text-gray-300'
                              }`}>
                                {event.status === 'active' ? 'En cours' :
                                 event.status === 'scheduled' ? 'Planifié' : event.status}
                              </span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-white/70">
                                <FiMapPin size={14} className="text-white/50" />
                                <span>{event.location}</span>
                              </div>
                              <div className="flex items-center gap-2 text-white/70">
                                <FiClock size={14} className="text-white/50" />
                                <span>{formatTime(event.checkInTime)} - {formatTime(event.checkOutTime)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-white/70">
                                <FiUsers size={14} className="text-white/50" />
                                <span>{event.requiredAgents || 1} agent(s) requis</span>
                              </div>
                              
                              {/* Zones assignées pour agent */}
                              {user?.role === 'agent' && agentAssignedZones.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <p className="text-white/60 text-xs font-semibold mb-2 flex items-center gap-1">
                                    <FiTarget size={12} />
                                    {agentAssignedZones.length === 1 ? 'Ma zone affectée' : `Mes ${agentAssignedZones.length} zones affectées`}
                                  </p>
                                  <div className="space-y-2">
                                    {agentAssignedZones.map((zone, zoneIdx) => (
                                      <div key={zoneIdx} className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: zone.color || '#A855F7' }}
                                          />
                                          <span className="text-white font-semibold">{zone.name}</span>
                                          {zone.priority && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                              zone.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                                              zone.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                                              zone.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                              'bg-gray-500/20 text-gray-300'
                                            }`}>
                                              {zone.priority}
                                            </span>
                                          )}
                                        </div>
                                        {zone.description && (
                                          <p className="text-white/70 text-xs mb-2">{zone.description}</p>
                                        )}
                                        {zone.instructions && (
                                          <div className="bg-white/5 rounded p-2 mt-2">
                                            <p className="text-white/60 text-xs mb-1 font-medium">Instructions:</p>
                                            <p className="text-white/80 text-xs">{zone.instructions}</p>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Zones gérées pour superviseur */}
                              {user?.role === 'supervisor' && eventZones.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <p className="text-white/60 text-xs font-semibold mb-2 flex items-center gap-1">
                                    <FiLayers size={12} />
                                    {eventZones.length === 1 ? 'Zone gérée' : `Mes ${eventZones.length} zones gérées`}
                                  </p>
                                  <div className="space-y-2">
                                    {eventZones.map((zone, zoneIdx) => (
                                      <div key={zoneIdx} className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: zone.color || '#3B82F6' }}
                                          />
                                          <span className="text-white font-semibold">{zone.name}</span>
                                          {zone.priority && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                              zone.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                                              zone.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                                              zone.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                              'bg-gray-500/20 text-gray-300'
                                            }`}>
                                              {zone.priority}
                                            </span>
                                          )}
                                        </div>
                                        {zone.description && (
                                          <p className="text-white/70 text-xs mb-2">{zone.description}</p>
                                        )}
                                        {zone.instructions && (
                                          <div className="bg-white/5 rounded p-2 mt-2">
                                            <p className="text-white/60 text-xs mb-1 font-medium">Instructions:</p>
                                            <p className="text-white/80 text-xs">{zone.instructions}</p>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {event.description && (
                                <p className="text-white/50 text-xs mt-2 pt-2 border-t border-white/10">
                                  {event.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Supervisor Info (for agents) */}
              {supervisor && user?.role === 'agent' && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSection('supervisor')}
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <FiShield className="text-white" size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">Mon Responsable</p>
                        <p className="text-white/60 text-sm">{supervisor.firstName} {supervisor.lastName}</p>
                      </div>
                    </div>
                    {expandedSections.supervisor ? (
                      <FiChevronUp className="text-white/60" size={20} />
                    ) : (
                      <FiChevronDown className="text-white/60" size={20} />
                    )}
                  </button>

                  {expandedSections.supervisor && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-4 mb-4">
                          {supervisor.profilePhoto ? (
                            <img src={supervisor.profilePhoto} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-500/50" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                              {supervisor.firstName?.[0]}{supervisor.lastName?.[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-semibold text-lg">{supervisor.firstName} {supervisor.lastName}</p>
                            <p className="text-white/50 text-sm">{supervisor.email}</p>
                            {supervisor.phone && (
                              <p className="text-white/50 text-sm">
                                <FiPhone size={12} className="mr-1" />
                                <a href={`tel:${supervisor.phone}`} className="text-blue-400 hover:underline ml-1">{supervisor.phone}</a>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Contact buttons */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          {supervisor.phone && (
                            <a
                              href={`tel:${supervisor.phone}`}
                              className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl text-green-300 hover:bg-green-500/30 transition-all"
                            >
                              <FiPhone size={18} />
                              <span className="font-medium">Appeler</span>
                            </a>
                          )}
                          {supervisor.email && (
                            <a
                              href={`mailto:${supervisor.email}`}
                              className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-xl text-blue-300 hover:bg-blue-500/30 transition-all"
                            >
                              <FiMail size={18} />
                              <span className="font-medium">Email</span>
                            </a>
                          )}
                          {supervisor.whatsappNumber && (
                            <a
                              href={`https://wa.me/${supervisor.whatsappNumber.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-600/20 to-green-500/20 border border-green-600/30 rounded-xl text-green-300 hover:bg-green-600/30 transition-all col-span-2"
                            >
                              <FiMessageCircle size={18} />
                              <span className="font-medium">WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Managed Agents (for supervisors) */}
              {user?.role === 'supervisor' && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSection('agents')}
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <FiUsers className="text-white" size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold">Mes Agents</p>
                        <p className="text-white/60 text-sm">{managedAgents.length} agent(s) sous ma responsabilité</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full text-xs font-bold">
                        {managedAgents.length}
                      </span>
                      {expandedSections.agents ? (
                        <FiChevronUp className="text-white/60" size={20} />
                      ) : (
                        <FiChevronDown className="text-white/60" size={20} />
                      )}
                    </div>
                  </button>

                  {expandedSections.agents && (
                    <div className="px-4 pb-4 space-y-3 max-h-96 overflow-y-auto">
                      {managedAgents.length === 0 ? (
                        <div className="text-center py-8 bg-white/5 rounded-xl">
                          <FiUsers className="mx-auto mb-3 text-white/30" size={40} />
                          <p className="text-white/50">Aucun agent assigné</p>
                        </div>
                      ) : (
                        managedAgents.map((agent, idx) => (
                          <div key={idx} className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                              {agent.profilePhoto ? (
                                <img src={agent.profilePhoto} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/30" />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                                  {agent.firstName?.[0]}{agent.lastName?.[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-white font-medium truncate">{agent.firstName} {agent.lastName}</p>
                                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                    agent.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
                                  }`} />
                                </div>
                                <p className="text-white/50 text-xs">{agent.employeeId}</p>
                              </div>
                              {agent.rating && (
                                <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                                  <FiStar className="text-yellow-400" size={12} />
                                  <span className="text-yellow-300 text-xs font-medium">{agent.rating}</span>
                                </div>
                              )}
                            </div>

                            {/* Contact buttons */}
                            <div className="grid grid-cols-3 sm:gap-2 gap-1.5">
                              {agent.phone && (
                                <a
                                  href={`tel:${agent.phone}`}
                                  className="flex items-center justify-center gap-1.5 py-2 bg-green-500/20 rounded-lg text-green-300 hover:bg-green-500/30 transition-all text-sm"
                                >
                                  <FiPhone size={14} />
                                  <span className="hidden sm:inline">Appeler</span>
                                </a>
                              )}
                              {agent.email && (
                                <a
                                  href={`mailto:${agent.email}`}
                                  className="flex items-center justify-center gap-1.5 py-2 bg-blue-500/20 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-all text-sm"
                                >
                                  <FiMail size={14} />
                                  <span className="hidden sm:inline">Email</span>
                                </a>
                              )}
                              {agent.whatsappNumber && (
                                <a
                                  href={`https://wa.me/${agent.whatsappNumber.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-1.5 py-2 bg-green-600/20 rounded-lg text-green-300 hover:bg-green-600/30 transition-all text-sm"
                                >
                                  <FiMessageCircle size={14} />
                                  <span className="hidden sm:inline">WA</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Today's Attendance Status */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => toggleSection('attendance')}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg ${
                      todayAttendance?.checkedIn ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-500'
                    }`}>
                      <FiCheckCircle className="text-white" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Pointage du jour</p>
                      <p className="text-white/60 text-sm">
                        {todayAttendance?.checkedIn ?
                          `Entré à ${new Date(todayAttendance.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` :
                          'Non pointé'
                        }
                      </p>
                    </div>
                  </div>
                  {expandedSections.attendance ? (
                    <FiChevronUp className="text-white/60" size={20} />
                  ) : (
                    <FiChevronDown className="text-white/60" size={20} />
                  )}
                </button>

                {expandedSections.attendance && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className={`text-center p-4 rounded-xl ${
                          todayAttendance?.checkedIn ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5'
                        }`}>
                          <FiNavigation className={`mx-auto mb-2 ${todayAttendance?.checkedIn ? 'text-green-400' : 'text-white/30'}`} size={24} />
                          <p className="text-xs text-white/50 mb-1">Entrée</p>
                          <p className={`font-bold ${todayAttendance?.checkedIn ? 'text-green-300' : 'text-white/30'}`}>
                            {todayAttendance?.checkInTime ?
                              new Date(todayAttendance.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) :
                              '--:--'
                            }
                          </p>
                        </div>
                        <div className={`text-center p-4 rounded-xl ${
                          todayAttendance?.checkedOut ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-white/5'
                        }`}>
                          <FiLogOut className={`mx-auto mb-2 ${todayAttendance?.checkedOut ? 'text-orange-400' : 'text-white/30'}`} size={24} />
                          <p className="text-xs text-white/50 mb-1">Sortie</p>
                          <p className={`font-bold ${todayAttendance?.checkedOut ? 'text-orange-300' : 'text-white/30'}`}>
                            {todayAttendance?.checkOutTime ?
                              new Date(todayAttendance.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) :
                              '--:--'
                            }
                          </p>
                        </div>
                      </div>

                      {todayAttendance?.totalHours && (
                        <div className="mt-4 pt-4 border-t border-white/10 text-center">
                          <p className="text-white/50 text-xs mb-1">Heures travaillées</p>
                          <p className="text-white font-bold text-xl">
                            {todayAttendance.totalHours}h
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Supervisor/User Actions - Always visible in Info tab */}
              {(user?.role === 'supervisor' || user?.role === 'responsable' || user?.role === 'user' || user?.role === 'agent') && (
                <div className="bg-gradient-to-br from-primary-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-5 border border-primary-500/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
                      <FiShield className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Actions Terrain</h3>
                      <p className="text-white/70 text-xs">
                        {(validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success') 
                          ? 'Validation complète ✓' 
                          : 'Fonctionnalités disponibles'}
                      </p>
                    </div>
                  </div>

                  <div className={`grid ${user?.role === 'agent' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                    {/* Create Agent Button - Only for supervisors/responsables/users */}
                    {(user?.role === 'supervisor' || user?.role === 'responsable' || user?.role === 'user') && (
                      <button
                        type="button"
                        onClick={() => setShowAgentCreationModal(true)}
                        disabled={!(validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success')}
                        className={`group relative overflow-hidden ${
                          (validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success')
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30 hover:shadow-xl hover:scale-105'
                            : 'bg-gray-600 opacity-50 cursor-not-allowed'
                        } text-white font-semibold py-4 px-4 rounded-xl transition-all duration-300`}
                      >
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <FiUserPlus size={24} />
                          <span className="text-sm">Créer un Agent</span>
                        </div>
                        {(validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success') && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        )}
                      </button>
                    )}

                    {/* Report Incident Button - For all roles */}
                    <button
                      type="button"
                      onClick={() => setShowIncidentReportModal(true)}
                      className="group relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-4 px-4 rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-xl hover:scale-105"
                    >
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <FiAlertTriangle size={24} />
                        <span className="text-sm">Signaler Incident</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                  </div>

                  <div className="mt-3 bg-white/10 rounded-lg p-3 flex items-start gap-2">
                    <FiInfo className="text-primary-300 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-white/80 text-xs">
                      {(validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success')
                        ? 'Toutes les validations sont OK ✓ Vous pouvez maintenant recruter des agents et signaler des incidents.'
                        : 'Complétez les validations (Visage ✓, Position ✓, Appareil ✓) pour activer le bouton "Créer un Agent". Les incidents peuvent être signalés à tout moment.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Device Info */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-3">
                  <FiSmartphone className="text-white/40" size={18} />
                  <div>
                    <p className="text-white/40 text-sm">
                      {deviceInfo?.browser} sur {deviceInfo?.os}
                    </p>
                    <p className="text-white/30 text-xs">{deviceInfo?.device || 'Appareil inconnu'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pointage Tab */}
        {activeTab === 'pointage' && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Afficher le message de blocage */}
            {isLocked && (
              <div className="bg-red-900/50 backdrop-blur-sm rounded-2xl p-6 text-center border border-red-500/30">
                <FiAlertTriangle className="text-red-400 mx-auto mb-4" size={48} />
                <h3 className="text-xl font-bold text-white mb-2">Trop de tentatives</h3>
                <p className="text-red-300 mb-4">Vous avez échoué 3 fois à la vérification faciale.</p>
                <p className="text-white/70 text-sm mb-4">Retour au login dans quelques secondes...</p>
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
                >
                  Déconnexion immédiate
                </button>
              </div>
            )}

            {/* Camera / Facial Recognition */}
            {!isLocked && (
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl overflow-hidden border border-white/10">
                {cameraActive ? (
                  <div className="relative aspect-[4/3] md:aspect-video bg-black">
                    {/* Indicateur de tentatives */}
                    {!facialVerified && (
                      <div className="absolute top-4 left-4 z-20 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                        Tentative {attemptsCount + 1}/{MAX_ATTEMPTS}
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                      style={{ zIndex: 1 }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full"
                      style={{ zIndex: 2, pointerEvents: 'none' }}
                    />

                    <div className="absolute top-4 right-4 z-10">
                      <button
                        onClick={stopCamera}
                        className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                      >
                        <FiX size={20} />
                      </button>
                    </div>

                    {/* Guide overlay */}
                    <div className="absolute inset-0 z-10 pointer-events-none">
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className={`relative transition-all duration-300 ${
                          faceDetected && quality?.factors?.size?.ok && quality?.factors?.position?.ok
                            ? 'scale-105'
                            : 'scale-100'
                        }`}>
                          <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full border-4 flex items-center justify-center transition-colors duration-300 ${
                            !faceDetected
                              ? 'border-white/30 bg-white/5'
                              : quality?.factors?.size?.ok && quality?.factors?.position?.ok
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-yellow-500 bg-yellow-500/10'
                          }`}>
                            <div className={`w-40 h-40 md:w-52 md:h-52 rounded-full border-2 transition-colors duration-300 ${
                              !faceDetected
                                ? 'border-white/20'
                                : quality?.factors?.size?.ok && quality?.factors?.position?.ok
                                ? 'border-green-400'
                                : 'border-yellow-400'
                            }`}></div>
                          </div>

                          {faceDetected && storedDescriptor && matchScore > 0 && (
                            <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center">
                              <div className={`px-4 py-2 rounded-lg font-bold text-lg transition-colors duration-300 ${
                                matchScore >= MIN_SCORE
                                  ? 'bg-green-500 text-white'
                                  : matchScore < 30
                                  ? 'bg-red-500 text-white'
                                  : 'bg-yellow-500 text-black'
                              }`}>
                                {Math.round(matchScore)}%
                              </div>
                              <p className={`text-xs font-semibold mt-1 ${
                                matchScore >= MIN_SCORE ? 'text-green-400' : matchScore < 30 ? 'text-red-400' : 'text-yellow-400'
                              }`}>
                                {matchScore >= MIN_SCORE ? '✅ Correspondance' : matchScore < 30 ? '❌ Pas de correspondance' : 'Vérification...'}
                              </p>
                            </div>
                          )}
                        </div>

                        {!faceDetected && (
                          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center max-w-xs">
                            <p className="text-white font-semibold text-base mb-1">
                              Positionnez votre visage
                            </p>
                            <p className="text-white/70 text-sm">
                              Regardez directement la caméra
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Barre de progression */}
                      {!facialVerified && (
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="flex items-center gap-3 bg-black/60 rounded-xl px-4 py-3 backdrop-blur-lg">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-white text-sm font-semibold">
                                  {faceDetected
                                    ? matchScore >= MIN_SCORE
                                      ? 'Maintenez la position...'
                                      : 'Analyse en cours...'
                                    : 'Recherche du visage...'}
                                </p>
                                <p className={`text-sm font-bold ${
                                  captureProgress >= 100
                                    ? 'text-green-400'
                                    : captureProgress > 50
                                    ? 'text-yellow-400'
                                    : 'text-white'
                                }`}>
                                  {captureProgress}%
                                </p>
                              </div>
                              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full transition-all duration-300 rounded-full"
                                  style={{
                                    width: `${captureProgress}%`,
                                    backgroundColor:
                                      captureProgress >= 100
                                        ? '#10B981'
                                        : captureProgress > 50
                                        ? '#F59E0B'
                                        : '#60A5FA'
                                  }}
                                ></div>
                              </div>
                            </div>
                            {captureProgress >= 100 ? (
                              <FiCheck className="text-green-400" size={24} />
                            ) : (
                              <FiLoader
                                className={`text-white ${
                                  faceDetected ? 'animate-spin' : ''
                                }`}
                                size={24}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Message de succès */}
                      {facialVerified && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center max-w-sm mx-4">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                              <FiCheck size={40} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">
                              Identité vérifiée!
                            </h3>
                            <p className="text-gray-600 mb-4">
                              Votre visage a été reconnu avec succès
                            </p>
                            <div className="bg-green-50 rounded-lg p-3">
                              <p className="text-green-700 font-semibold">
                                Score: {Math.round(matchScore)}% de correspondance
                              </p>
                              <p className="text-green-600 text-sm mt-1">
                                Minimum requis: {MIN_SCORE}%
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[4/3] md:aspect-video flex flex-col items-center justify-center p-6">
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white/10 flex items-center justify-center mb-6">
                      {cameraStatus === 'inUse' ? (
                        <FiAlertTriangle className="text-yellow-400" size={48} />
                      ) : cameraStatus === 'notDetected' ? (
                        <FiX className="text-red-400" size={48} />
                      ) : (
                        <FiCamera className="text-white/50" size={48} />
                      )}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                      Photo de vérification
                    </h3>

                    {cameraStatus === 'inUse' && (
                      <p className="text-yellow-400 text-center text-sm mb-2">
                        ⚠️ Caméra détectée mais utilisée par une autre application
                      </p>
                    )}

                    {cameraStatus === 'notDetected' && (
                      <p className="text-red-400 text-center text-sm mb-2">
                        🚫 Aucune caméra détectée sur votre système
                      </p>
                    )}

                    {cameraStatus === 'detected' && (
                      <p className="text-green-400 text-center text-sm mb-2">
                        ✅ Caméra disponible
                      </p>
                    )}

                    <p className="text-white/60 text-center text-sm md:text-base mb-4 max-w-sm">
                      Activez la caméra pour vérifier votre identité
                    </p>
                    
                    <div className="text-xs text-white/40 text-center mb-4 max-w-sm">
                      <p>🔧 Assurez-vous que votre caméra est bien connectée et autorisée</p>
                      <p className="mt-1">📸 Positionnez-vous dans un endroit bien éclairé</p>
                      <p className="mt-1">🎯 Score minimum requis: {MIN_SCORE}% de correspondance</p>
                      <p className="mt-1">🔁 Tentatives maximum: {MAX_ATTEMPTS}</p>
                    </div>

                    <div className="flex gap-2 justify-center mb-4">
                      <button
                        onClick={startCamera}
                        disabled={cameraActive || modelsLoading}
                        className={`px-6 py-3 rounded-2xl font-semibold shadow-lg transition-all flex items-center gap-2 ${
                          cameraActive || modelsLoading
                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-xl hover:scale-105'
                        }`}
                      >
                        {modelsLoading ? (
                          <>
                            <FiLoader className="animate-spin" size={18} />
                            Chargement...
                          </>
                        ) : cameraActive ? (
                          <>
                            <FiCamera size={18} />
                            Active
                          </>
                        ) : (
                          <>
                            <FiCamera size={18} />
                            Activer
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          checkCameraStatus();
                          diagnoseCamera();
                        }}
                        className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-medium transition-all flex items-center gap-2"
                        title="Vérifier et diagnostiquer les caméras"
                      >
                        <FiActivity size={18} />
                        <span className="hidden sm:inline">Vérifier</span>
                        <span className="sm:hidden">🔍</span>
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={getCameraTroubleshootingTips}
                        className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
                      >
                        🔧 Aide pour résoudre le problème caméra
                      </button>
                      
                      <button
                        onClick={showFaceRecognitionTips}
                        className="text-sm text-yellow-400 hover:text-yellow-300 underline transition-colors"
                      >
                        💡 Conseils pour la reconnaissance faciale
                      </button>
                      
                      <button
                        onClick={() => {
                          setCaptureProgress(0);
                          setFacialVerified(false);
                          setIsMatched(false);
                          setMatchScore(0);
                          toast.info('Réinitialisation de la vérification faciale');
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
                      >
                        ↺ Réessayer la vérification
                      </button>
                      
                      <button
                        onClick={debugFaceRecognition}
                        className="text-sm text-purple-400 hover:text-purple-300 underline transition-colors"
                      >
                        🐛 Mode Debug (pour développeurs)
                      </button>
                      
                      <div className="text-center">
                        <button
                          onClick={() => document.getElementById('facial-upload').click()}
                          className="text-sm text-green-400 hover:text-green-300 underline transition-colors font-medium"
                        >
                          📸 Alternative : Utiliser une photo
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Validation Status */}
            {!isLocked && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
                <div className="grid grid-cols-3 sm:gap-3 gap-2">
                  <div className={`text-center p-3 md:p-4 rounded-xl ${
                    validations.facial.status === 'success' ? 'bg-green-500/20' :
                    validations.facial.status === 'loading' ? 'bg-blue-500/20' : 'bg-white/5'
                  }`}>
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      validations.facial.status === 'success' ? 'bg-green-500' :
                      validations.facial.status === 'loading' ? 'bg-blue-500' : 'bg-white/20'
                    }`}>
                      {validations.facial.status === 'success' ? <FiCheck className="text-white" size={20} /> :
                       validations.facial.status === 'loading' ? <FiLoader className="text-white animate-spin" size={20} /> :
                       <FiUser className="text-white/50" size={20} />}
                    </div>
                    <p className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">Visage</p>
                    {validations.facial.message !== 'En attente' && (
                      <p className="text-white/60 text-[10px] mt-1">{validations.facial.message}</p>
                    )}
                  </div>

                  <div className={`text-center p-3 md:p-4 rounded-xl ${
                    validations.location.status === 'success' || validations.location.status === 'warning' ? 'bg-green-500/20' :
                    validations.location.status === 'loading' ? 'bg-blue-500/20' : 'bg-white/5'
                  }`}>
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      validations.location.status === 'success' || validations.location.status === 'warning' ? 'bg-green-500' :
                      validations.location.status === 'loading' ? 'bg-blue-500' : 'bg-white/20'
                    }`}>
                      {validations.location.status === 'success' || validations.location.status === 'warning' ?
                       <FiCheck className="text-white" size={20} /> :
                       validations.location.status === 'loading' ? <FiLoader className="text-white animate-spin" size={20} /> :
                       <FiMapPin className="text-white/50" size={20} />}
                    </div>
                    <p className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">Position</p>
                  </div>

                  <div className="text-center p-3 md:p-4 rounded-xl bg-green-500/20">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full mx-auto mb-2 flex items-center justify-center bg-green-500">
                      <FiCheck className="text-white" size={20} />
                    </div>
                    <p className="text-white/80 text-[10px] sm:text-xs md:text-sm font-medium">Appareil</p>
                  </div>
                </div>
              </div>
            )}

            {/* Supervisor Actions - Show when all validations pass */}
            {!isLocked && (user?.role === 'responsable' || user?.role === 'supervisor' || user?.role === 'user') && 
             validations.facial.status === 'success' &&
             (validations.location.status === 'success' || validations.location.status === 'warning') &&
             validations.device.status === 'success' && (
              <div className="bg-gradient-to-br from-primary-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-5 border border-primary-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
                    <FiShield className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Actions {user?.role === 'user' ? 'Utilisateur' : 'Responsable'}</h3>
                    <p className="text-white/70 text-xs">Gestion terrain</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Create Agent Button */}
                  <button
                    type="button"
                    onClick={() => setShowAgentCreationModal(true)}
                    disabled={!(validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success')}
                    className={`group relative overflow-hidden ${
                      (validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success')
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30 hover:shadow-xl hover:scale-105'
                        : 'bg-gray-600 opacity-50 cursor-not-allowed'
                    } text-white font-semibold py-4 px-4 rounded-xl transition-all duration-300`}
                  >
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <FiUserPlus size={24} />
                      <span className="text-sm">Créer un Agent</span>
                    </div>
                    {(validations.facial.status === 'success' && (validations.location.status === 'success' || validations.location.status === 'warning') && validations.device.status === 'success') && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    )}
                  </button>

                  {/* Report Incident Button */}
                  <button
                    type="button"
                    onClick={() => setShowIncidentReportModal(true)}
                    className="group relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-4 px-4 rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-xl hover:scale-105"
                  >
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <FiAlertTriangle size={24} />
                      <span className="text-sm">Signaler Incident</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </button>
                </div>

                <div className="mt-3 bg-white/10 rounded-lg p-3 flex items-start gap-2">
                  <FiInfo className="text-primary-300 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-white/80 text-xs">
                    Validation complète ✓ Vous pouvez recruter des agents sur le terrain et signaler des incidents
                  </p>
                </div>
              </div>
            )}

            {/* Auto-submit Message */}
            {autoSubmitMessage && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-3 md:p-4 text-center">
                <p className="text-green-300 font-semibold text-sm md:text-base">{autoSubmitMessage}</p>
              </div>
            )}

            {/* Check-in Buttons */}
            {!isLocked && !autoSubmitDone && (() => {
              // Vérifier si l'utilisateur a des événements assignés
              if (todayEvents.length === 0) {
                return (
                  <div className="rounded-xl p-6 border bg-gray-500/20 border-gray-500/30 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FiAlertCircle size={40} className="text-gray-400" />
                      <p className="text-gray-300 font-semibold text-lg">Aucun événement assigné aujourd'hui</p>
                      <p className="text-gray-400 text-sm">Le check-in et le tracking GPS ne sont pas disponibles</p>
                      <p className="text-gray-500 text-xs mt-2">Contactez votre superviseur pour une assignation</p>
                    </div>
                  </div>
                );
              }

              // Calculer le statut temporel de l'événement sélectionné
              const selectedEvent = todayEvents.find(e => e.id === selectedEventId) || todayEvents[0];
              const timeStatus = getEventTimeStatus(selectedEvent);
              const helpMessage = getHelpMessage(timeStatus);

              return (
                <>
                  {/* Message d'aide temporel */}
                  {helpMessage && (
                    <div className={`rounded-xl p-4 border mb-4 ${
                      timeStatus.isAfterEvent 
                        ? 'bg-gray-500/20 border-gray-500/30 text-gray-300'
                        : timeStatus.isBeforeWindow
                        ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                        : timeStatus.canCheckIn
                        ? 'bg-green-500/20 border-green-500/30 text-green-300'
                        : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                    }`}>
                      <div className="flex items-center gap-2 justify-center">
                        <FiClock size={18} />
                        <p className="font-medium">{helpMessage}</p>
                      </div>
                      {timeStatus.minutesUntilStart !== null && timeStatus.isBeforeWindow && (
                        <p className="text-center text-sm mt-2 opacity-80">
                          Le pointage sera disponible {formatTimeRemaining(timeStatus.minutesUntilStart - 120)} avant le début
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => submitCheckIn('in')}
                      disabled={
                        submitting || 
                        (todayAttendance?.checkedIn && !todayAttendance?.checkedOut) || 
                        !facialVerified ||
                        !timeStatus.canCheckIn
                      }
                      className={`py-5 md:py-6 rounded-2xl font-bold text-lg shadow-lg transition-all flex flex-col items-center justify-center gap-2 ${
                        submitting && checkInType === 'in'
                          ? 'bg-gray-500 text-white cursor-not-allowed'
                          : (todayAttendance?.checkedIn && !todayAttendance?.checkedOut) || !facialVerified || !timeStatus.canCheckIn
                          ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/30 hover:shadow-xl'
                      }`}
                      title={
                        !timeStatus.canCheckIn 
                          ? timeStatus.isBeforeWindow 
                            ? `Disponible dans ${formatTimeRemaining(timeStatus.minutesUntilStart - 120)}`
                            : 'Événement terminé'
                          : !facialVerified 
                          ? 'Vérification faciale requise'
                          : ''
                      }
                    >
                      {submitting && checkInType === 'in' ? (
                        <FiLoader className="animate-spin" size={22} />
                      ) : (
                        <FiNavigation size={22} />
                      )}
                      <span>Entrée</span>
                      {!timeStatus.canCheckIn && timeStatus.isBeforeWindow && (
                        <span className="text-xs opacity-75">
                          ({formatTimeRemaining(timeStatus.minutesUntilStart - 120)})
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => submitCheckIn('out')}
                      disabled={
                        submitting || 
                        !todayAttendance?.checkedIn || 
                        todayAttendance?.checkedOut || 
                        !facialVerified ||
                        !timeStatus.canCheckOut
                      }
                      className={`py-5 md:py-6 rounded-2xl font-bold text-lg shadow-lg transition-all flex flex-col items-center justify-center gap-2 ${
                        submitting && checkInType === 'out'
                          ? 'bg-gray-500 text-white cursor-not-allowed'
                          : !todayAttendance?.checkedIn || todayAttendance?.checkedOut || !facialVerified || !timeStatus.canCheckOut
                          ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-orange-500/30 hover:shadow-xl'
                      }`}
                      title={
                        !timeStatus.canCheckOut && timeStatus.isDuringEvent && !timeStatus.isNearEnd
                          ? `Disponible dans ${formatTimeRemaining(timeStatus.minutesUntilEnd - 5)}`
                          : !todayAttendance?.checkedIn
                          ? 'Veuillez d\'abord pointer l\'entrée'
                          : !facialVerified
                          ? 'Vérification faciale requise'
                          : ''
                      }
                    >
                      {submitting && checkInType === 'out' ? (
                        <FiLoader className="animate-spin" size={22} />
                      ) : (
                        <FiLogOut size={22} />
                      )}
                      <span>Sortie</span>
                      {!timeStatus.canCheckOut && timeStatus.isDuringEvent && !timeStatus.isNearEnd && (
                        <span className="text-xs opacity-75">
                          ({formatTimeRemaining(timeStatus.minutesUntilEnd - 5)})
                        </span>
                      )}
                    </button>
                  </div>
                </>
              );
            })()}

            {/* Status Messages */}
            {!isLocked && todayAttendance?.checkedIn && !todayAttendance?.checkedOut && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                <FiCheckCircle className="text-green-400 mx-auto mb-2" size={24} />
                <p className="text-green-300 font-medium">
                  Vous êtes pointé depuis {new Date(todayAttendance.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}

            {!isLocked && todayAttendance?.checkedOut && (
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                <FiCheckCircle className="text-blue-400 mx-auto mb-2" size={24} />
                <p className="text-blue-300 font-medium">
                  Journée terminée - Sortie à {new Date(todayAttendance.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} SGM – Security Guard | Système de gestion
        </p>
      </div>

      {/* Supervisor Modals - Agent Creation (only for responsables/supervisors) */}
      {(user?.role === 'supervisor' || user?.role === 'user') && (
        <AgentCreationModal
          isOpen={showAgentCreationModal}
          onClose={() => setShowAgentCreationModal(false)}
          supervisorId={user?.id}
          currentEvent={todayEvents.find(e => e.id === selectedEventId) || todayEvents[0]}
          managedZones={managedZones.filter(zone => zone.eventId === (selectedEventId || (todayEvents[0]?.id)))}
          onSuccess={(newAgent) => {
            console.log('New agent created:', newAgent);
            toast.success(`Agent ${newAgent.prenom} ${newAgent.nom} créé avec succès!`);
            // Optionally refresh agents list
            // La liste des agents sera rechargée au prochain rafraîchissement de la page
          }}
        />
      )}

      {/* Incident Report Modal - Available for all roles */}
      <IncidentReportModal
        isOpen={showIncidentReportModal}
        onClose={() => setShowIncidentReportModal(false)}
        userId={user?.id}
        eventId={todayEvents[0]?.id}
        eventName={todayEvents[0]?.name}
        zoneName={currentZone?.name}
        userLocation={location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          address: locationAddress
        } : null}
        onSuccess={(incident) => {
          console.log('Incident reported:', incident);
          toast.success('Incident signalé! L\'admin et les utilisateurs ont été notifiés.');
        }}
      />
    </div>
  );
};

export default CheckIn;