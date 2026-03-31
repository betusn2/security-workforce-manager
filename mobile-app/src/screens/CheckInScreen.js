import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
  StatusBar,
  Dimensions,
  RefreshControl,
  Linking,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as ImageManipulator from 'expo-image-manipulator';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { attendanceAPI, assignmentsAPI, eventsAPI, usersAPI, incidentsAPI } from '../services/api';
import socketService from '../services/socketService';
import deviceInfoService from '../services/deviceInfoService';
import soundEffects from '../utils/soundEffects';
import { getDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundTracking, stopBackgroundTracking } from '../services/backgroundLocationTask';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Haversine (identique au web CheckIn.jsx) ──────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Fenêtre de check-in : 2h avant le début (même règle que web)
const isEventActive = (event) => {
  if (!event) return false;
  const now   = new Date();
  const start = event.startDate ? new Date(event.startDate) : null;
  const end   = event.endDate   ? new Date(event.endDate)   : null;
  if (!start) return true;
  const openAt = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  return now >= openAt && (!end || now <= end);
};

// ─────────────────────────────────────────────────────────────
const CheckInScreen = ({ route, navigation }) => {
  const { event: passedEvent, assignment: passedAssignment } = route.params || {};

  // ── States ────────────────────────────────────────────────
  const [initLoading,     setInitLoading]     = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [activeEvents,    setActiveEvents]    = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [selectedEvent,   setSelectedEvent]   = useState(passedEvent  || null);
  const [selectedAssign,  setSelectedAssign]  = useState(passedAssignment || null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [zone,            setZone]            = useState(null);

  // UI Tabs
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'pointage'

  // Profile
  const [userProfile, setUserProfile]   = useState(null);
  const [supervisor,  setSupervisor]    = useState(null);
  const [agents,      setAgents]        = useState([]);

  // Camera
  const [cameraPermission, setCameraPermission] = useState(null);
  const [cameraActive,     setCameraActive]     = useState(false);
  const [cameraReady,      setCameraReady]      = useState(false);
  const [faceDetected,     setFaceDetected]     = useState(false);
  const [capturedPhoto,    setCapturedPhoto]    = useState(null);
  const [verifyMode,       setVerifyMode]       = useState(false);

  // Location (même que web)
  const [location,         setLocation]         = useState(null);
  const [locationLoading,  setLocationLoading]  = useState(false);
  const [distance,         setDistance]         = useState(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(null);
  const [gpsAddress,       setGpsAddress]       = useState(null);
  const [gpsAccuracy,      setGpsAccuracy]      = useState(null);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Flow states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInDone,  setCheckInDone]  = useState(false);
  const [checkInTime,  setCheckInTime]  = useState(null);

  // 🆕 Web-like Features
  const [batteryLevel,           setBatteryLevel]           = useState(null);
  const [batteryCharging,        setBatteryCharging]        = useState(false);
  const [deviceFingerprint,      setDeviceFingerprint]      = useState(null);
  const [enrichedDeviceInfo,     setEnrichedDeviceInfo]     = useState(null);
  const [isSocketAuthenticated,  setIsSocketAuthenticated]  = useState(false);
  const [isSocketConnected,      setIsSocketConnected]      = useState(false);
  const [userId,                 setUserId]                 = useState(null);

  const cameraRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const batterySubscription = useRef(null);
  const clockIntervalRef = useRef(null);

  // ── 1. INIT : mêmes appels API que web ─────────────────────
  useEffect(() => { initData(); }, []);

  // ── Live clock (comme le web) ─────────────────────────────
  useEffect(() => {
    clockIntervalRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockIntervalRef.current);
  }, []);

  // ── 🆕 INIT WEB-LIKE: Socket.IO + Battery + GPS Tracking ───
  useEffect(() => {
    console.log('🚀 CheckInScreen: Initialisation des fonctionnalités web');
    
    // Initialiser les services
    const initServices = async () => {
      // 1. Sound effects
      await soundEffects.initialize();
      
      // 2. Device fingerprint
      const fingerprint = await getDeviceFingerprint();
      setDeviceFingerprint(fingerprint);
      console.log('🔑 Device Fingerprint:', fingerprint);
      
      // 3. Device info enrichis
      const deviceInfo = await getDeviceInfo();
      setEnrichedDeviceInfo(deviceInfo);
      console.log('📱 Device Info:', deviceInfo);
      
      // 4. Charger userId depuis AsyncStorage
      try {
        const userDataStr = await AsyncStorage.getItem('checkInUser');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setUserId(userData.id);
          console.log('👤 User ID chargé:', userData.id);
          
          // 5. Initialiser Socket.IO
          await initializeSocket(userData.id);
        }
      } catch (error) {
        console.error('Erreur chargement userId:', error);
      }
      
      // 6. Démarrer Battery monitoring
      startBatteryMonitoring();
      
      // 7. Démarrer GPS tracking automatique
      startLocationTracking();
      
      // 🆕 8. Reprendre le monitoring de fin d'événement si en cours
      try {
        const trackingEndDate = await AsyncStorage.getItem('trackingEventEndDate');
        const trackingEventId = await AsyncStorage.getItem('trackingEventId');
        
        if (trackingEndDate && trackingEventId) {
          const endDate = new Date(trackingEndDate);
          const now = new Date();
          
          // Si l'événement n'est pas encore terminé
          if (now < endDate) {
            console.log('🔄 Reprise du monitoring événement en cours:', trackingEventId);
            startEventEndMonitoring(trackingEndDate, trackingEventId);
          } else {
            // Événement déjà terminé, nettoyer
            console.log('🏁 Événement déjà terminé - Nettoyage');
            await stopBackgroundTracking();
            await AsyncStorage.removeItem('trackingEventEndDate');
            await AsyncStorage.removeItem('trackingEventId');
          }
        }
      } catch (error) {
        console.error('Erreur reprise monitoring:', error);
      }
    };
    
    initServices();
    
    // Cleanup
    return () => {
      console.log('🧹 CheckInScreen: Cleanup');
      stopLocationTracking();
      stopBatteryMonitoring();
      // Socket.IO reste actif (géré globalement par socketService)
      // Background tracking continue (ne pas arrêter ici)
    };
  }, []);

  // ── Socket.IO Initialization (même que web) ──────────────
  const initializeSocket = async (uid) => {
    try {
      const token = await AsyncStorage.getItem('checkInToken') || 
                    await AsyncStorage.getItem('accessToken') ||
                    await AsyncStorage.getItem('token');
      
      const validEventsStr = await AsyncStorage.getItem('validEvents');
      const validEvents = validEventsStr ? JSON.parse(validEventsStr) : [];
      const eventId = validEvents[0]?.id || selectedEvent?.id || null;
      
      console.log('🔌 Initialisation Socket.IO:', { userId: uid, eventId, hasToken: !!token });
      
      // Connecter avec les mêmes paramètres que le web
      socketService.connect(uid, 'agent', eventId, token);
      
      // Écouter les événements Socket.IO
      socketService.on('connect', () => {
        console.log('✅ Socket.IO connecté');
        setIsSocketConnected(true);
      });
      
      socketService.on('auth:success', (data) => {
        console.log('✅ Authentification Socket.IO réussie:', data);
        setIsSocketAuthenticated(true);
      });
      
      socketService.on('auth:error', (error) => {
        console.error('❌ Erreur auth Socket.IO:', error);
        setIsSocketAuthenticated(false);
        Alert.alert('Erreur Socket.IO', error.message);
      });
      
      socketService.on('tracking:position_ack', (data) => {
        console.log('✅ Position confirmée:', data);
      });
      
      socketService.on('tracking:error', (error) => {
        console.error('❌ Erreur tracking:', error);
      });
      
      socketService.on('disconnect', () => {
        console.log('🔌 Socket.IO déconnecté');
        setIsSocketConnected(false);
        setIsSocketAuthenticated(false);
      });
      
    } catch (error) {
      console.error('Erreur initialisation Socket.IO:', error);
    }
  };

  // ── Battery Monitoring (même que web getBatteryLevel) ─────
  const startBatteryMonitoring = async () => {
    try {
      // Niveau initial
      const level = await Battery.getBatteryLevelAsync();
      const charging = await Battery.getBatteryStateAsync();
      setBatteryLevel(Math.round(level * 100));
      setBatteryCharging(charging === Battery.BatteryState.CHARGING);
      
      console.log('🔋 Batterie:', Math.round(level * 100) + '%', charging === Battery.BatteryState.CHARGING ? '(en charge)' : '');
      
      // Écouter les changements
      batterySubscription.current = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        setBatteryLevel(Math.round(batteryLevel * 100));
      });
      
      Battery.addBatteryStateListener(({ batteryState }) => {
        setBatteryCharging(batteryState === Battery.BatteryState.CHARGING);
      });
    } catch (error) {
      console.log('Battery API non disponible:', error);
    }
  };
  
  const stopBatteryMonitoring = () => {
    if (batterySubscription.current) {
      batterySubscription.current.remove();
      batterySubscription.current = null;
    }
  };

  // ── GPS Tracking Automatique (même que web: toutes les 5s) ───
  const startLocationTracking = async () => {
    try {
      // Vérifier permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('⚠️ Permission GPS refusée');
        return;
      }
      
      // Position immédiate
      const initialLoc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High 
      });
      setLocation(initialLoc.coords);
      await sendLocationUpdate(initialLoc.coords);
      
      // Puis toutes les 5 secondes (comme le web)
      locationIntervalRef.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.High 
          });
          setLocation(loc.coords);
          await sendLocationUpdate(loc.coords);
        } catch (error) {
          console.error('Erreur GPS:', error);
        }
      }, 5000); // 5 secondes
      
      console.log('📍 GPS tracking démarré (intervalle: 5s)');
    } catch (error) {
      console.error('Erreur démarrage GPS tracking:', error);
    }
  };
  
  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      console.log('📍 GPS tracking arrêté');
    }
  };

  // ── Envoyer position via Socket.IO (même que web sendLocationUpdate) ───
  const sendLocationUpdate = async (coords) => {
    if (!userId) {
      console.log('⚠️ UserId non disponible, position non envoyée');
      return;
    }
    
    if (!socketService.isConnected()) {
      console.log('⚠️ Socket.IO non connecté');
      return;
    }
    
    // CRITIQUE: Vérifier authentification (même que web)
    if (!isSocketAuthenticated) {
      console.log('⏳ En attente authentification Socket.IO...');
      return;
    }
    
    try {
      // 🆕 Collecter TOUTES les infos enrichies (40+ champs comme le web)
      const enrichedInfo = await deviceInfoService.getAllInfo();
      
      const data = {
        userId: userId,
        // GPS
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude || null,
        speed: coords.speed || 0,
        heading: coords.heading || null,
        
        // 🔋 Batterie complète
        batteryLevel: enrichedInfo.battery?.level || batteryLevel || 100,
        batteryCharging: enrichedInfo.battery?.charging || batteryCharging,
        batteryChargingTime: enrichedInfo.battery?.chargingTime,
        batteryDischargingTime: enrichedInfo.battery?.dischargingTime,
        batteryStatus: enrichedInfo.battery?.status,
        batteryEstimatedTime: enrichedInfo.battery?.estimatedTimeRemaining,
        batteryLowPowerMode: enrichedInfo.battery?.lowPowerMode,
        
        // 📶 Réseau
        networkType: enrichedInfo.network?.type,
        networkConnected: enrichedInfo.network?.isConnected,
        networkStatus: enrichedInfo.network?.status,
        networkIpAddress: enrichedInfo.network?.ipAddress,
        
        // 📱 Appareil
        deviceOS: enrichedInfo.device?.platform || Platform.OS,
        deviceOSVersion: enrichedInfo.device?.osVersion,
        deviceBrand: enrichedInfo.device?.brand,
        deviceModel: enrichedInfo.device?.model,
        deviceName: enrichedInfo.device?.deviceName,
        deviceType: enrichedInfo.device?.isDevice ? 'physical' : 'emulator',
        deviceMemory: enrichedInfo.device?.totalMemory,
        deviceCPUArchitectures: enrichedInfo.device?.supportedCpuArchitectures?.join(','),
        deviceScreenResolution: enrichedInfo.device?.screenResolution,
        deviceAppVersion: enrichedInfo.device?.appVersion,
        deviceFingerprint: deviceFingerprint,
        
        timestamp: new Date().toISOString()
      };
      
      console.log('📡 Envoi position enrichie:', {
        battery: data.batteryLevel + '%',
        network: data.networkType,
        device: `${data.deviceBrand} ${data.deviceModel}`
      });
      
      socketService.emit('location-update', data);
      
      console.log('📍 Position envoyée via Socket.IO:', {
        userId: userId,
        lat: coords.latitude.toFixed(5),
        lng: coords.longitude.toFixed(5),
        battery: data.batteryLevel,
        authenticated: isSocketAuthenticated
      });
    } catch (error) {
      console.error('Erreur envoi position:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initData();
    setRefreshing(false);
  }, []);

  // ── Reverse geocoding via Nominatim ─────────────────────────
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'SecurityGuardApp/1.0' } }
      );
      const data = await res.json();
      if (data?.display_name) setGpsAddress(data.display_name);
    } catch (_) {}
  };

  const initData = async () => {
    try {
      setInitLoading(true);

      // ── Charger le profil utilisateur depuis AsyncStorage ──
      try {
        const userDataStr = await AsyncStorage.getItem('checkInUser');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          setUserProfile(userData);
          // Charger le superviseur si disponible
          if (userData.supervisorId) {
            const supRes = await usersAPI.getById(userData.supervisorId);
            setSupervisor(supRes.data?.data || null);
          }
        }
      } catch (_) {}

      // Charger mes affectations confirmées (identique web assignmentsAPI.getMyAssignments)
      const assignRes  = await assignmentsAPI.getMyAssignments({ status: 'confirmed' });
      const myAssign   = assignRes.data.data || [];
      setAssignments(myAssign);

      // Charger les événements liés (identique web: Promise.all sur eventIds)
      const eventIds = [...new Set(myAssign.map(a => a.eventId).filter(Boolean))];
      let events = [];
      if (eventIds.length > 0) {
        const responses = await Promise.all(eventIds.map(id => eventsAPI.getById(id)));
        events = responses.map(r => r.data?.data).filter(Boolean);
      }

      // Filtrer uniquement les actifs (fenêtre 2h, même que web computeEventStatus)
      const filtered = events.filter(isEventActive);
      setActiveEvents(filtered);

      // Auto-sélection (même que web: si 1 seul événement ou passé en params)
      let autoEvent  = passedEvent;
      let autoAssign = passedAssignment;
      if (!autoEvent && filtered.length === 1) {
        autoEvent  = filtered[0];
        autoAssign = myAssign.find(a => a.eventId === filtered[0].id) || null;
      }

      if (autoEvent) {
        await selectEvent(autoEvent, autoAssign || myAssign.find(a => a.eventId === autoEvent.id));
      }
    } catch (err) {
      console.error('CheckIn init error:', err);
      Alert.alert('Erreur', 'Impossible de charger les événements');
    } finally {
      setInitLoading(false);
    }
  };

  // ── 2. Sélectionner un événement ──────────────────────────
  const selectEvent = async (event, assignment) => {
    setSelectedEvent(event);
    setSelectedAssign(assignment);
    setZone(assignment?.zone || assignment?.Zone || null);

    // Vérifier déjà pointé (même comportement que web: auto-redirect checkout)
    try {
      const statusRes = await attendanceAPI.getTodayStatus();
      const todayData = statusRes.data?.data?.events || [];
      const existing  = todayData.find(e =>
        (e.eventId === event.id || e.id === event.id) &&
        e.attendance?.checkInTime && !e.attendance?.checkOutTime
      );
      if (existing?.attendance) {
        setTodayAttendance(existing.attendance);
        setCheckInDone(true);
        setCheckInTime(existing.attendance.checkInTime);
        return;
      }
    } catch (_) {}

    // Demander permissions caméra + GPS en parallèle
    await Promise.all([requestCamera(), getGPS(event)]);
  };

  const requestCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === 'granted');
  };

  // ── GPS (même formule + même géofence que web) ─────────────
  const getGPS = async (event) => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
      setGpsAccuracy(loc.coords.accuracy);
      // Reverse geocode
      reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      if (event?.latitude && event?.longitude) {
        const dist = calculateDistance(
          loc.coords.latitude, loc.coords.longitude,
          parseFloat(event.latitude), parseFloat(event.longitude)
        );
        setDistance(Math.round(dist));
        setIsWithinGeofence(dist <= (event.geoRadius || 200));
      }
    } catch (err) {
      console.error('GPS error:', err);
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Activer/Désactiver caméra ─────────────────────────────
  const activateCamera = async () => {
    if (cameraPermission === null) {
      await requestCamera();
    }
    if (cameraPermission === false) {
      Alert.alert('Caméra requise', 'Autorisez la caméra dans les paramètres.');
      return;
    }
    setCameraActive(true);
    setCapturedPhoto(null);
    setVerifyMode(false);
  };

  // ── Capture photo ─────────────────────────────────────────
  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      soundEffects.playCameraShutter();
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: false });
      const compressed = await ImageManipulator.manipulateAsync(
        raw.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setCapturedPhoto({ ...compressed, base64: compressed.base64 });
      setCameraActive(false);
      setFaceDetected(true);
    } catch (err) {
      Alert.alert('Erreur', 'Capture impossible');
    }
  };

  // ── Submit check-in (mêmes champs que web attendanceAPI.checkIn) ──
  const submitCheckIn = async (type = 'in') => {
    if (!location) {
      Alert.alert('GPS requis', 'Position GPS non disponible. Réessayez.');
      return;
    }
    if (!capturedPhoto) {
      Alert.alert('Photo requise', 'Prenez une photo de vérification avant de pointer.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (type === 'in') {
        await attendanceAPI.checkIn({
          eventId:              selectedEvent?.id,
          assignmentId:         selectedAssign?.id,
          latitude:             location.latitude,
          longitude:            location.longitude,
          checkInPhoto:         `data:image/jpeg;base64,${capturedPhoto.base64}`,
          checkInMethod:        'facial',
          isWithinGeofence,
          distanceFromLocation: distance,
          deviceInfo: {
            platform: Platform.OS,
            version: String(Platform.Version),
            fingerprint: deviceFingerprint,
            ...enrichedDeviceInfo,
          },
        });
        soundEffects.playValidation();
        if (userId && selectedEvent?.id) {
          const bgStarted = await startBackgroundTracking(userId, selectedEvent.id);
          if (bgStarted && selectedEvent.endDate) {
            await AsyncStorage.setItem('trackingEventEndDate', selectedEvent.endDate);
            await AsyncStorage.setItem('trackingEventId', String(selectedEvent.id));
            startEventEndMonitoring(selectedEvent.endDate, selectedEvent.id);
          }
        }
        setCheckInDone(true);
        setCheckInTime(new Date().toISOString());
        setTodayAttendance({ checkInTime: new Date().toISOString() });
        Alert.alert('✅ Pointage réussi', 'Votre arrivée a été enregistrée.', [{ text: 'OK' }]);
      } else {
        // Check-out
        if (todayAttendance?.id) {
          await attendanceAPI.checkOut(todayAttendance.id, {
            latitude: location.latitude,
            longitude: location.longitude,
            checkOutPhoto: `data:image/jpeg;base64,${capturedPhoto.base64}`,
            checkOutMethod: 'facial',
          });
          soundEffects.playValidation();
          Alert.alert('✅ Départ enregistré', 'Votre sortie a été enregistrée.', [
            { text: 'OK', onPress: () => navigation.navigate('Home') },
          ]);
        }
      }
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || 'Erreur lors du pointage');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🆕 Surveillance de la fin d'événement (arrête le tracking automatiquement)
  const startEventEndMonitoring = (endDate, eventId) => {
    const checkInterval = setInterval(async () => {
      const now = new Date();
      if (now >= new Date(endDate)) {
        await stopBackgroundTracking();
        await AsyncStorage.removeItem('trackingEventEndDate');
        await AsyncStorage.removeItem('trackingEventId');
        clearInterval(checkInterval);
        Alert.alert('🏁 Événement terminé', 'Le suivi de position a été arrêté. N\'oubliez pas de pointer votre sortie.', [{ text: 'OK' }]);
      }
    }, 60000);
    return () => clearInterval(checkInterval);
  };

  // ── Signaler un incident ─────────────────────────────────
  const reportIncident = () => {
    navigation.navigate('IncidentReport', { event: selectedEvent });
  };

  // ── Fenêtre d'autorisation ───────────────────────────────
  const getAuthMessage = () => {
    if (!selectedEvent) return null;
    const now   = new Date();
    const start = selectedEvent.startDate ? new Date(selectedEvent.startDate) : null;
    const end   = selectedEvent.endDate   ? new Date(selectedEvent.endDate)   : null;
    if (!start) return { ok: true, msg: 'Pointage autorisé' };
    const openAt = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    if (now < openAt) {
      const diff = Math.round((openAt - now) / 60000);
      return { ok: false, msg: `Pointage ouvert dans ${diff}min` };
    }
    if (end && now > end) return { ok: false, msg: 'Événement terminé' };
    if (!checkInDone) {
      const diff = start > now ? Math.round((start - now) / 60000) : null;
      return { ok: true, msg: diff ? `Pointage d'entrée autorisé — Événement dans ${diff}min` : 'Pointage d\'entrée autorisé' };
    }
    const closeAt = end ? new Date(end.getTime() - 5 * 60 * 1000) : null;
    if (closeAt && now < closeAt) {
      const diff = Math.round((closeAt - now) / 60000);
      return { ok: false, msg: `Sortie disponible dans ${diff}min` };
    }
    return { ok: true, msg: 'Pointage de sortie autorisé' };
  };

  // ── Précision GPS ────────────────────────────────────────
  const getGpsQuality = () => {
    if (!gpsAccuracy) return { label: '—', color: '#6b7280' };
    if (gpsAccuracy <= 10) return { label: 'Excellente', color: '#10b981' };
    if (gpsAccuracy <= 30) return { label: 'Bonne', color: '#10b981' };
    if (gpsAccuracy <= 100) return { label: 'Moyenne', color: '#f59e0b' };
    return { label: 'Faible', color: '#ef4444' };
  };

  // ────────────────────────────────────────────────────────────
  //  RENDER HELPERS
  // ────────────────────────────────────────────────────────────

  const renderClock = () => (
    <View style={styles.clockBox}>
      <Text style={styles.clockTime}>
        {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </Text>
      <Text style={styles.clockDate}>
        {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>
    </View>
  );

  const renderTopBadges = () => (
    <View style={styles.topBadgesRow}>
      {batteryLevel !== null && (
        <View style={[styles.badge, { backgroundColor: batteryLevel < 20 ? '#ef4444' : '#10b981' }]}>
          <Ionicons name={batteryCharging ? 'battery-charging' : 'battery-full'} size={11} color="#fff" />
          <Text style={styles.badgeText}>{batteryLevel}%</Text>
        </View>
      )}
      <View style={[styles.badge, { backgroundColor: isSocketAuthenticated ? '#10b981' : isSocketConnected ? '#f59e0b' : '#64748b' }]}>
        <Ionicons name="wifi" size={11} color="#fff" />
        <Text style={styles.badgeText}>{isSocketAuthenticated ? 'Temps réel' : isSocketConnected ? 'Connexion...' : 'Hors ligne'}</Text>
      </View>
      {location && (
        <View style={[styles.badge, { backgroundColor: isWithinGeofence === false ? '#ef4444' : '#10b981' }]}>
          <Ionicons name="location" size={11} color="#fff" />
          <Text style={styles.badgeText}>GPS {isWithinGeofence === false ? 'Hors zone' : 'OK'}</Text>
        </View>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'info' && styles.tabBtnActive]}
        onPress={() => setActiveTab('info')}
      >
        <Ionicons name="information-circle-outline" size={16} color={activeTab === 'info' ? '#1e3a5f' : '#94a3b8'} />
        <Text style={[styles.tabBtnText, activeTab === 'info' && styles.tabBtnTextActive]}>Informations</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, activeTab === 'pointage' && styles.tabBtnActive]}
        onPress={() => setActiveTab('pointage')}
      >
        <Ionicons name="scan-outline" size={16} color={activeTab === 'pointage' ? '#1e3a5f' : '#94a3b8'} />
        <Text style={[styles.tabBtnText, activeTab === 'pointage' && styles.tabBtnTextActive]}>Pointage</Text>
      </TouchableOpacity>
    </View>
  );

  // ── INFORMATIONS TAB ─────────────────────────────────────
  const renderInfoTab = () => {
    const gpsQuality = getGpsQuality();
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#94a3b8" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Mon Profil ────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(userProfile?.firstName?.[0] || userProfile?.name?.[0] || 'A').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Mon Profil</Text>
              <Text style={styles.cardSubVal}>{userProfile?.email || '—'}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </View>
          <View style={styles.divider} />
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>Nom</Text>
              <Text style={styles.infoCellValue}>{userProfile?.firstName} {userProfile?.lastName}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>Matricule</Text>
              <Text style={styles.infoCellValue}>{userProfile?.matricule || userProfile?.employeeId || '—'}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>Rôle</Text>
              <Text style={styles.infoCellValue}>{userProfile?.role || '—'}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>Téléphone</Text>
              <Text style={styles.infoCellValue}>{userProfile?.phone || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Ma Position ───────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#1e40af22' }]}>
              <Ionicons name="location" size={18} color="#2563eb" />
            </View>
            <Text style={[styles.cardTitle, { marginLeft: 10, flex: 1 }]}>Ma Position</Text>
            {locationLoading
              ? <ActivityIndicator size="small" color="#2563eb" />
              : <TouchableOpacity onPress={() => selectedEvent && getGPS(selectedEvent)}>
                  <Ionicons name="refresh" size={18} color="#64748b" />
                </TouchableOpacity>
            }
          </View>

          {location ? (
            <>
              {/* Mini Map */}
              <MapView
                style={styles.miniMap}
                region={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                  title="Ma position"
                  pinColor="#2563eb"
                />
                {selectedEvent?.latitude && selectedEvent?.longitude && (
                  <>
                    <Marker
                      coordinate={{ latitude: parseFloat(selectedEvent.latitude), longitude: parseFloat(selectedEvent.longitude) }}
                      title={selectedEvent.name}
                      pinColor="#10b981"
                    />
                    <Circle
                      center={{ latitude: parseFloat(selectedEvent.latitude), longitude: parseFloat(selectedEvent.longitude) }}
                      radius={selectedEvent.geoRadius || 200}
                      fillColor="rgba(16,185,129,0.12)"
                      strokeColor="#10b981"
                      strokeWidth={1.5}
                    />
                  </>
                )}
              </MapView>

              {/* Distance + précision badges */}
              <View style={styles.mapStatsRow}>
                {distance !== null && (
                  <View style={[styles.mapStat, { backgroundColor: isWithinGeofence ? '#d1fae5' : '#fee2e2' }]}>
                    <Ionicons name={isWithinGeofence ? 'checkmark-circle' : 'alert-circle'} size={14} color={isWithinGeofence ? '#10b981' : '#ef4444'} />
                    <Text style={[styles.mapStatText, { color: isWithinGeofence ? '#065f46' : '#991b1b' }]}>
                      {distance}m du site
                    </Text>
                  </View>
                )}
                <View style={styles.mapStat}>
                  <Ionicons name="speedometer-outline" size={14} color={gpsQuality.color} />
                  <Text style={[styles.mapStatText, { color: gpsQuality.color }]}>±{Math.round(gpsAccuracy || 0)}m ({gpsQuality.label})</Text>
                </View>
              </View>

              {/* Coordinates */}
              <View style={styles.coordRow}>
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>Latitude</Text>
                  <Text style={styles.coordValue}>{location.latitude.toFixed(6)}</Text>
                </View>
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>Longitude</Text>
                  <Text style={styles.coordValue}>{location.longitude.toFixed(6)}</Text>
                </View>
              </View>

              {/* Address */}
              {gpsAddress && (
                <View style={styles.addressRow}>
                  <Ionicons name="home-outline" size={13} color="#94a3b8" />
                  <Text style={styles.addressText} numberOfLines={2}>{gpsAddress}</Text>
                </View>
              )}

              {isWithinGeofence === false && (
                <View style={styles.warnRow}>
                  <Ionicons name="warning" size={14} color="#f59e0b" />
                  <Text style={styles.warnText}>Vous êtes hors de la zone de pointage.</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.gpsPlaceholder}>
              <Ionicons name="location-outline" size={32} color="#64748b" />
              <Text style={styles.gpsPlaceholderText}>
                {locationLoading ? 'Acquisition en cours...' : 'GPS indisponible'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Événements Gérés ──────────────────────────── */}
        {activeEvents.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#1e3a5f33' }]}>
                <Ionicons name="calendar" size={18} color="#3b82f6" />
              </View>
              <Text style={[styles.cardTitle, { marginLeft: 10 }]}>Événements Gérés</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{activeEvents.length}</Text></View>
            </View>
            {activeEvents.map((ev) => {
              const asg = assignments.find(a => a.eventId === ev.id);
              const isSelected = selectedEvent?.id === ev.id;
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.eventRow, isSelected && styles.eventRowSelected]}
                  onPress={() => selectEvent(ev, asg)}
                >
                  <View style={[styles.eventDot, { backgroundColor: ev.status === 'active' ? '#10b981' : '#f59e0b' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventRowName}>{ev.name}</Text>
                    {ev.location && <Text style={styles.eventRowLoc}>{ev.location}</Text>}
                    {ev.startDate && (
                      <Text style={styles.eventRowTime}>
                        {new Date(ev.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {ev.endDate ? ` – ${new Date(ev.endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </Text>
                    )}
                    {asg?.zone?.name && <Text style={styles.eventRowZone}>Zone : {asg.zone.name}</Text>}
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color="#10b981" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Pointage du Jour ──────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#0f766e22' }]}>
              <Ionicons name="time" size={18} color="#0d9488" />
            </View>
            <Text style={[styles.cardTitle, { marginLeft: 10 }]}>Pointage du jour</Text>
          </View>
          {checkInDone || todayAttendance?.checkInTime ? (
            <View>
              <View style={styles.attendRow}>
                <Ionicons name="log-in-outline" size={15} color="#10b981" />
                <Text style={styles.attendLabel}>Arrivée</Text>
                <Text style={styles.attendValue}>
                  {new Date(todayAttendance?.checkInTime || checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {todayAttendance?.checkOutTime && (
                <View style={styles.attendRow}>
                  <Ionicons name="log-out-outline" size={15} color="#f59e0b" />
                  <Text style={styles.attendLabel}>Départ</Text>
                  <Text style={styles.attendValue}>
                    {new Date(todayAttendance.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.notYetText}>Non pointé</Text>
          )}
        </View>

        {/* ── Superviseur / Agents ──────────────────────── */}
        {supervisor && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#4f46e522' }]}>
                <Ionicons name="person" size={18} color="#6366f1" />
              </View>
              <Text style={[styles.cardTitle, { marginLeft: 10 }]}>Mon Superviseur</Text>
            </View>
            <View style={styles.supervisorRow}>
              <View style={[styles.avatarCircle, { backgroundColor: '#6366f1' }]}>
                <Text style={styles.avatarText}>{(supervisor.firstName?.[0] || 'S').toUpperCase()}</Text>
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.supervisorName}>{supervisor.firstName} {supervisor.lastName}</Text>
                {supervisor.phone && <Text style={styles.supervisorContact}>{supervisor.phone}</Text>}
              </View>
              {supervisor.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${supervisor.phone}`)}>
                  <Ionicons name="call" size={20} color="#10b981" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Actions Terrain ───────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#f97316'+'22' }]}>
              <Ionicons name="flash" size={18} color="#f97316" />
            </View>
            <Text style={[styles.cardTitle, { marginLeft: 10 }]}>Actions Terrain</Text>
            <Text style={styles.subLabel}>Fonctionnalités disponibles</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={reportIncident}>
              <Ionicons name="warning" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Signaler Incident</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.actionHint}>
            Complétez Visage / Position / Appareil pour activer Entrée/Sortie. Les incidents peuvent être signalés à tout moment.
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ── POINTAGE TAB ─────────────────────────────────────────
  const renderPointageTab = () => {
    const authInfo = getAuthMessage();
    const canCheckIn  = !!location && !!capturedPhoto && !checkInDone && authInfo?.ok;
    const canCheckOut = !!location && !!capturedPhoto &&  checkInDone && authInfo?.ok;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section Photo de vérification ──────────────── */}
        <View style={styles.card}>
          <View style={styles.cameraCardHeader}>
            <Ionicons name="camera" size={32} color="#64748b" />
            <Text style={styles.cameraCardTitle}>Photo de vérification</Text>
            {cameraActive || capturedPhoto ? (
              <View style={styles.camAvailBadge}>
                <Ionicons name="ellipse" size={8} color="#10b981" />
                <Text style={styles.camAvailText}>Caméra disponible</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cameraCardSub}>Activez la caméra pour vérifier votre identité</Text>

          {/* Camera view or preview */}
          {cameraActive ? (
            <View style={styles.cameraInlineWrap}>
              <Camera
                ref={cameraRef}
                style={styles.cameraInline}
                type={Camera.Constants?.Type?.front ?? 1}
                onCameraReady={() => { setCameraReady(true); setFaceDetected(true); }}
              >
                {/* Oval guide overlay */}
                <View style={styles.camOverlay}>
                  <View style={styles.camTop}><Text style={styles.camInstruct}>Placez votre visage dans le cadre</Text></View>
                  <View style={styles.camMiddle}>
                    <View style={styles.camSide} />
                    <View style={[styles.camOval, { borderColor: faceDetected ? '#10b981' : '#fff' }]}>
                      {faceDetected && (
                        <View style={styles.camOvalCheck}><Ionicons name="checkmark" size={14} color="#fff" /></View>
                      )}
                    </View>
                    <View style={styles.camSide} />
                  </View>
                  <View style={styles.camBottom}>
                    <TouchableOpacity
                      style={[styles.captureBtn, (!cameraReady) && { backgroundColor: '#374151' }]}
                      onPress={capturePhoto}
                      disabled={!cameraReady}
                    >
                      <Ionicons name="camera" size={28} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Camera>
            </View>
          ) : capturedPhoto ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: capturedPhoto.uri }} style={styles.photoPreview} />
              <View style={[styles.photoBadge, { backgroundColor: '#10b981' }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
                <Text style={styles.photoBadgeText}>Visage vérifié</Text>
              </View>
            </View>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="camera-outline" size={48} color="#475569" />
            </View>
          )}

          {/* Activer / Vérifier buttons */}
          {!capturedPhoto && (
            <View style={styles.camBtnRow}>
              <TouchableOpacity
                style={[styles.camBtnPrimary, cameraActive && { backgroundColor: '#475569' }]}
                onPress={cameraActive ? () => setCameraActive(false) : activateCamera}
              >
                <Ionicons name={cameraActive ? 'close' : 'videocam'} size={16} color="#fff" />
                <Text style={styles.camBtnText}>{cameraActive ? 'Annuler' : 'Activer'}</Text>
              </TouchableOpacity>
              {cameraActive && (
                <TouchableOpacity
                  style={[styles.camBtnSecondary, (!cameraReady) && { opacity: 0.5 }]}
                  onPress={capturePhoto}
                  disabled={!cameraReady}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#2563eb" />
                  <Text style={styles.camBtnSecText}>Vérifier</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {capturedPhoto && (
            <TouchableOpacity style={styles.retakeLink} onPress={() => { setCapturedPhoto(null); setFaceDetected(false); }}>
              <Ionicons name="refresh-outline" size={14} color="#64748b" />
              <Text style={styles.retakeLinkText}>Réessayer la vérification</Text>
            </TouchableOpacity>
          )}

          {/* Tips */}
          <View style={styles.tipsList}>
            <Text style={styles.tipsItem}>• Assurez-vous que votre caméra est bien connectée et autorisée</Text>
            <Text style={styles.tipsItem}>• Positionnez-vous dans un endroit bien éclairé</Text>
            <Text style={styles.tipsItem}>• Score minimum requis : correspondance visage</Text>
          </View>
        </View>

        {/* ── Indicateurs de validation ───────────────────── */}
        <View style={styles.validationRow}>
          <View style={styles.validationItem}>
            <View style={[styles.validIcon, faceDetected ? styles.validOk : styles.validPending]}>
              <Ionicons name="person" size={18} color={faceDetected ? '#fff' : '#64748b'} />
            </View>
            <Text style={styles.validLabel}>Visage</Text>
          </View>
          <View style={styles.validationItem}>
            <View style={[styles.validIcon, location ? styles.validOk : styles.validPending]}>
              <Ionicons name="location" size={18} color={location ? '#fff' : '#64748b'} />
            </View>
            <Text style={styles.validLabel}>Position</Text>
          </View>
          <View style={styles.validationItem}>
            <View style={[styles.validIcon, styles.validOk]}>
              <Ionicons name="phone-portrait" size={18} color="#fff" />
            </View>
            <Text style={styles.validLabel}>Appareil</Text>
          </View>
        </View>

        {/* ── Message d'autorisation ─────────────────────── */}
        {authInfo && (
          <View style={[styles.authMessage, { backgroundColor: authInfo.ok ? '#052e1633' : '#1e293b' }]}>
            <Ionicons
              name={authInfo.ok ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={authInfo.ok ? '#10b981' : '#f59e0b'}
            />
            <Text style={[styles.authMessageText, { color: authInfo.ok ? '#10b981' : '#f59e0b' }]}>
              {authInfo.msg}
            </Text>
          </View>
        )}

        {/* ── Boutons Entrée / Sortie ────────────────────── */}
        <View style={styles.entryExitRow}>
          <TouchableOpacity
            style={[styles.entryBtn, (!canCheckIn || isSubmitting) && styles.entryBtnDisabled]}
            onPress={() => submitCheckIn('in')}
            disabled={!canCheckIn || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="log-in-outline" size={20} color="#fff" /><Text style={styles.entryBtnText}>Entrée</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exitBtn, (!canCheckOut || isSubmitting) && styles.exitBtnDisabled]}
            onPress={() => submitCheckIn('out')}
            disabled={!canCheckOut || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="log-out-outline" size={20} color="#fff" /><Text style={styles.exitBtnText}>Sortie</Text></>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ────────────────────────────────────────────────────────────
  //  RENDER MAIN
  // ────────────────────────────────────────────────────────────

  if (initLoading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Chargement des affectations...</Text>
      </View>
    );
  }

  // ── Sélection événement si plusieurs actifs ──────────────
  if (!selectedEvent && activeEvents.length > 1) {
    return (
      <View style={[styles.screen, { backgroundColor: '#0f172a' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        {renderClock()}
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.selectTitle}>Choisir un événement</Text>
          <Text style={styles.selectSub}>Plusieurs événements actifs. Sélectionnez celui à pointer.</Text>
          {activeEvents.map((ev) => (
            <TouchableOpacity
              key={ev.id}
              style={styles.eventSelectCard}
              onPress={() => selectEvent(ev, assignments.find(a => a.eventId === ev.id))}
            >
              <Ionicons name="calendar" size={22} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.eventSelectName}>{ev.name}</Text>
                {ev.location && <Text style={styles.eventSelectLoc}>{ev.location}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Aucun événement actif ────────────────────────────────
  if (!selectedEvent && activeEvents.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Ionicons name="calendar-outline" size={64} color="#475569" />
        <Text style={styles.emptyTitle}>Aucun événement actif</Text>
        <Text style={styles.emptyText}>Pas d'événement ouvert au pointage pour le moment.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Interface principale (tab-based, comme le web) ───────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Clock */}
      {renderClock()}

      {/* Status badges */}
      {renderTopBadges()}

      {/* Tab bar */}
      {renderTabBar()}

      {/* Tab content */}
      {activeTab === 'info' ? renderInfoTab() : renderPointageTab()}
    </View>
  );
};

// ──────────────────── STYLES ────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  loadingScreen: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  emptyScreen: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 },

  // ── Clock ──────────────────────────────────────────────────
  clockBox: {
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginTop: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clockTime: { fontSize: 36, fontWeight: '700', color: '#f1f5f9', letterSpacing: 2 },
  clockDate: { fontSize: 12, color: '#94a3b8', marginTop: 4, textTransform: 'capitalize' },

  // ── Top Badges ─────────────────────────────────────────────
  topBadgesRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 8, gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // ── Tab Bar ────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 8, gap: 5,
  },
  tabBtnActive: { backgroundColor: '#fff' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabBtnTextActive: { color: '#1e3a5f' },

  // ── Tab Content ────────────────────────────────────────────
  tabContent: { padding: 12 },

  // ── Cards ──────────────────────────────────────────────────
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  cardSubVal: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#334155', marginBottom: 10 },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subLabel: { fontSize: 11, color: '#64748b', marginLeft: 'auto' },

  // ── Profile grid ───────────────────────────────────────────
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: { width: '48%', backgroundColor: '#0f172a', borderRadius: 8, padding: 8 },
  infoCellLabel: { fontSize: 10, color: '#64748b', marginBottom: 3, textTransform: 'uppercase' },
  infoCellValue: { fontSize: 13, color: '#e2e8f0', fontWeight: '500' },

  // ── Mini Map ───────────────────────────────────────────────
  miniMap: { height: 160, borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  mapStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  mapStat: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
  },
  mapStatText: { fontSize: 11, fontWeight: '500' },
  coordRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  coordItem: { flex: 1, backgroundColor: '#0f172a', borderRadius: 8, padding: 8 },
  coordLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase' },
  coordValue: { fontSize: 12, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  addressRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start', marginBottom: 6 },
  addressText: { flex: 1, fontSize: 11, color: '#64748b', lineHeight: 16 },
  warnRow: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#451a0322', padding: 8, borderRadius: 8 },
  warnText: { flex: 1, fontSize: 12, color: '#f59e0b' },
  gpsPlaceholder: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  gpsPlaceholderText: { color: '#64748b', fontSize: 13 },

  // ── Events ─────────────────────────────────────────────────
  countBadge: {
    backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 'auto',
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  eventRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#334155',
  },
  eventRowSelected: { backgroundColor: '#1e3a5f33', borderRadius: 8, paddingHorizontal: 8 },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  eventRowName: { fontSize: 13, fontWeight: '600', color: '#f1f5f9' },
  eventRowLoc: { fontSize: 11, color: '#64748b', marginTop: 1 },
  eventRowTime: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  eventRowZone: { fontSize: 11, color: '#6366f1', marginTop: 2 },

  // ── Attendance ─────────────────────────────────────────────
  attendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  attendLabel: { flex: 1, fontSize: 13, color: '#94a3b8' },
  attendValue: { fontSize: 13, fontWeight: '600', color: '#f1f5f9' },
  notYetText: { fontSize: 13, color: '#64748b', paddingVertical: 4 },

  // ── Supervisor ─────────────────────────────────────────────
  supervisorRow: { flexDirection: 'row', alignItems: 'center' },
  supervisorName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  supervisorContact: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // ── Actions Terrain ────────────────────────────────────────
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 11, gap: 6,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionHint: { fontSize: 11, color: '#64748b', lineHeight: 16 },

  // ── Camera (Pointage tab) ──────────────────────────────────
  cameraCardHeader: { alignItems: 'center', marginBottom: 6, gap: 6 },
  cameraCardTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  cameraCardSub: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 10 },
  camAvailBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#052e1644', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  camAvailText: { fontSize: 11, color: '#10b981', fontWeight: '500' },
  cameraPlaceholder: { height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, marginBottom: 10 },
  cameraInlineWrap: { borderRadius: 12, overflow: 'hidden', height: 240, marginBottom: 10 },
  cameraInline: { width: '100%', height: '100%' },
  camOverlay: { flex: 1 },
  camTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 10 },
  camInstruct: { color: '#fff', fontSize: 13 },
  camMiddle: { flexDirection: 'row', height: 130 },
  camSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  camOval: {
    width: 100, height: 130, borderWidth: 2, borderRadius: 50,
    borderStyle: 'dashed', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 8,
  },
  camOvalCheck: { backgroundColor: '#10b981', borderRadius: 20, padding: 3 },
  camBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  captureBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#10b981',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff',
  },
  photoPreviewWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 10, position: 'relative' },
  photoPreview: { width: '100%', height: 200, resizeMode: 'cover' },
  photoBadge: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4,
  },
  photoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  camBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  camBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 11, gap: 6,
  },
  camBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  camBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 11, gap: 6,
    borderWidth: 1, borderColor: '#2563eb',
  },
  camBtnSecText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  retakeLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 },
  retakeLinkText: { fontSize: 12, color: '#64748b' },
  tipsList: { gap: 4, marginTop: 4 },
  tipsItem: { fontSize: 11, color: '#64748b', lineHeight: 16 },

  // ── Validation Row ─────────────────────────────────────────
  validationRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
    paddingVertical: 14,
  },
  validationItem: { flex: 1, alignItems: 'center', gap: 6 },
  validIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  validOk: { backgroundColor: '#10b981' },
  validPending: { backgroundColor: '#334155' },
  validLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },

  // ── Auth Message ───────────────────────────────────────────
  authMessage: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#334155', marginBottom: 10,
  },
  authMessageText: { flex: 1, fontSize: 12, fontWeight: '500' },

  // ── Entrée / Sortie ────────────────────────────────────────
  entryExitRow: { flexDirection: 'row', gap: 10 },
  entryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#475569', borderRadius: 12, paddingVertical: 15, gap: 7,
  },
  entryBtnDisabled: { backgroundColor: '#334155' },
  entryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  exitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#475569', borderRadius: 12, paddingVertical: 15, gap: 7,
  },
  exitBtnDisabled: { backgroundColor: '#334155' },
  exitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Select Event ───────────────────────────────────────────
  selectTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  selectSub: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  eventSelectCard: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  eventSelectName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  eventSelectLoc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // ── Empty / Loading ────────────────────────────────────────
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#f1f5f9', marginTop: 16, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  backBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  loadingText: { marginTop: 12, color: '#94a3b8', fontSize: 15 },
});

export default CheckInScreen;

