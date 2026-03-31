import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { attendanceAPI, assignmentsAPI, eventsAPI } from '../services/api';
import socketService from '../services/socketService';
import deviceInfoService from '../services/deviceInfoService';
import soundEffects from '../utils/soundEffects';
import { getDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundTracking, stopBackgroundTracking } from '../services/backgroundLocationTask';

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
  const [activeEvents,    setActiveEvents]    = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [selectedEvent,   setSelectedEvent]   = useState(passedEvent  || null);
  const [selectedAssign,  setSelectedAssign]  = useState(passedAssignment || null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [zone,            setZone]            = useState(null);

  // Camera
  const [cameraPermission, setCameraPermission] = useState(null);
  const [cameraReady,      setCameraReady]      = useState(false);
  const [faceDetected,     setFaceDetected]     = useState(false);
  const [capturedPhoto,    setCapturedPhoto]    = useState(null);

  // Location (même que web)
  const [location,         setLocation]         = useState(null);
  const [locationLoading,  setLocationLoading]  = useState(false);
  const [distance,         setDistance]         = useState(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(null);

  // Flow: init | camera | confirm | success | already_checked_in
  const [step,         setStep]         = useState('init');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // ── 1. INIT : mêmes appels API que web ─────────────────────
  useEffect(() => { initData(); }, []);

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

  const initData = async () => {
    try {
      setInitLoading(true);

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
        setStep('already_checked_in');
        return;
      }
    } catch (_) {}

    // Demander permissions caméra + GPS en parallèle
    await Promise.all([requestCamera(), getGPS(event)]);
    setStep('camera');
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

  // ── Capture photo ─────────────────────────────────────────
  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      // 🎵 Son de capture (comme le web)
      soundEffects.playCameraShutter();
      
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: false });
      // Compresser et redimensionner avant upload (évite envoi 2MB+)
      const compressed = await ImageManipulator.manipulateAsync(
        raw.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setCapturedPhoto({ ...compressed, base64: compressed.base64 });
      setStep('confirm');
    } catch (err) {
      Alert.alert('Erreur', 'Capture impossible');
    }
  };

  // ── Submit check-in (mêmes champs que web attendanceAPI.checkIn) ──
  const submitCheckIn = async () => {
    if (!capturedPhoto || !location) {
      Alert.alert('Erreur', 'Photo et GPS requis');
      return;
    }
    setIsSubmitting(true);
    try {
      await attendanceAPI.checkIn({
        eventId:              selectedEvent?.id,
        assignmentId:         selectedAssign?.id,
        latitude:             location.latitude,
        longitude:            location.longitude,
        checkInPhoto:         `data:image/jpeg;base64,${capturedPhoto.base64}`,
        checkInMethod:        'facial',
        isWithinGeofence,
        distanceFromLocation: distance,
        deviceInfo:           { 
          platform: Platform.OS, 
          version: String(Platform.Version),
          fingerprint: deviceFingerprint,
          ...enrichedDeviceInfo 
        },
      });
      
      // 🎵 Son de succès (comme le web)
      soundEffects.playValidation();
      
      // 🆕 DÉMARRER LE TRACKING BACKGROUND (jusqu'à la fin de l'événement)
      if (userId && selectedEvent?.id) {
        console.log('🔋 Démarrage tracking arrière-plan...');
        const bgStarted = await startBackgroundTracking(userId, selectedEvent.id);
        
        if (bgStarted) {
          console.log('✅ Tracking arrière-plan actif jusqu\'à la fin de l\'événement');
          
          // Stocker la date de fin pour surveillance
          if (selectedEvent.endDate) {
            await AsyncStorage.setItem('trackingEventEndDate', selectedEvent.endDate);
            await AsyncStorage.setItem('trackingEventId', String(selectedEvent.id));
            
            // Démarrer la surveillance de fin d'événement
            startEventEndMonitoring(selectedEvent.endDate, selectedEvent.id);
          }
          
          Alert.alert(
            '✅ Pointage réussi',
            'Votre position sera suivie automatiquement jusqu\'à la fin de l\'événement, même si votre appareil est en veille.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '⚠️ Tracking limité',
            'Le suivi en arrière-plan n\'a pas pu démarrer. Votre position sera suivie uniquement lorsque l\'application est ouverte.',
            [{ text: 'OK' }]
          );
        }
      }
      
      setStep('success');
      setTimeout(() => navigation.navigate('Home'), 2500);
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
      const end = new Date(endDate);
      
      console.log(`🕐 Vérif fin événement: ${now.toISOString()} vs ${end.toISOString()}`);
      
      // Si l'événement est terminé
      if (now >= end) {
        console.log('🏁 Événement terminé - Arrêt du tracking background');
        
        await stopBackgroundTracking();
        await AsyncStorage.removeItem('trackingEventEndDate');
        await AsyncStorage.removeItem('trackingEventId');
        
        clearInterval(checkInterval);
        
        Alert.alert(
          '🏁 Événement terminé',
          'Le suivi de position a été arrêté automatiquement. N\'oubliez pas de pointer votre sortie.',
          [{ text: 'OK' }]
        );
      }
    }, 60000); // Vérifier toutes les minutes
    
    // Nettoyer l'intervalle quand le composant est démonté
    return () => clearInterval(checkInterval);
  };

  // ────────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────────

  if (initLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Chargement des affectations...</Text>
      </View>
    );
  }

  // Sélection événement si plusieurs actifs
  if (step === 'init' && activeEvents.length > 1) {
    return (
      <ScrollView style={styles.bgGray} contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.pageTitle}>Choisir un événement</Text>
        <Text style={styles.pageSubtitle}>Plusieurs événements actifs. Sélectionnez celui à pointer.</Text>
        {activeEvents.map((ev) => (
          <TouchableOpacity
            key={ev.id}
            style={styles.eventSelectCard}
            onPress={() => selectEvent(ev, assignments.find(a => a.eventId === ev.id))}
          >
            <Ionicons name="calendar" size={22} color="#2563eb" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.eventSelectName}>{ev.name}</Text>
              {ev.location && <Text style={styles.eventSelectLoc}>{ev.location}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  // Aucun événement actif
  if (step === 'init' && activeEvents.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
        <Text style={styles.errorTitle}>Aucun événement actif</Text>
        <Text style={styles.errorText}>Pas d'événement ouvert au pointage pour le moment.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.btnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Déjà pointé → proposer checkout (même comportement que web)
  if (step === 'already_checked_in') {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={80} color="#10b981" />
        <Text style={styles.successTitle}>Déjà pointé !</Text>
        <Text style={styles.successText}>
          Arrivée à {new Date(todayAttendance?.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {selectedEvent && <Text style={styles.eventNameSmall}>{selectedEvent.name}</Text>}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: '#f59e0b', marginTop: 20, flexDirection: 'row', gap: 8 }]}
          onPress={() => navigation.navigate('CheckOut', { attendanceId: todayAttendance.id, event: selectedEvent })}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>Pointer le départ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#6b7280', marginTop: 10 }]} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.btnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Succès
  if (step === 'success') {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={100} color="#10b981" />
        <Text style={styles.successTitle}>Pointage réussi !</Text>
        <Text style={styles.successText}>
          Arrivée enregistrée à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {selectedEvent && (
          <View style={styles.eventInfoBox}>
            <Text style={styles.eventInfoName}>{selectedEvent.name}</Text>
            {selectedEvent.location && <Text style={styles.eventInfoLoc}>{selectedEvent.location}</Text>}
          </View>
        )}
      </View>
    );
  }

  // Confirmation photo + GPS
  if (step === 'confirm' && capturedPhoto) {
    return (
      <ScrollView style={styles.bgGray} contentContainerStyle={{ padding: 16 }}>
        {/* 🆕 Status Bar aussi dans confirmation */}
        <View style={[styles.statusBar, { position: 'relative', top: 0, marginBottom: 12 }]}>
          {batteryLevel !== null && (
            <View style={[styles.statusBadge, { backgroundColor: batteryLevel < 20 ? '#ef4444' : '#10b981' }]}>
              <Ionicons name={batteryCharging ? 'battery-charging' : 'battery-full'} size={12} color="#fff" />
              <Text style={styles.statusBadgeText}>{batteryLevel}%</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { 
            backgroundColor: isSocketAuthenticated ? '#10b981' : isSocketConnected ? '#f59e0b' : '#6b7280' 
          }]}>
            <Ionicons name="wifi" size={12} color="#fff" />
            <Text style={styles.statusBadgeText}>
              {isSocketAuthenticated ? 'En ligne' : isSocketConnected ? 'Auth...' : 'Hors ligne'}
            </Text>
          </View>
        </View>
        
        {/* Carte événement (même que web) */}
        {selectedEvent && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedEvent.name}</Text>
            {selectedEvent.location && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                <Text style={styles.infoText}>{selectedEvent.location}</Text>
              </View>
            )}
            {zone && (
              <View style={[styles.infoRow, { marginTop: 4 }]}>
                <Ionicons name="map-outline" size={14} color="#7c3aed" />
                <Text style={[styles.infoText, { color: '#7c3aed' }]}>Zone : {zone.name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Preview photo */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} />
          <View style={[styles.faceBadge, { backgroundColor: faceDetected ? '#10b981' : '#f59e0b' }]}>
            <Ionicons name={faceDetected ? 'checkmark' : 'warning'} size={13} color="#fff" />
            <Text style={styles.faceBadgeText}>{faceDetected ? 'Visage détecté' : 'Vérifier'}</Text>
          </View>
        </View>

        {/* GPS Card (même que web) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={18} color="#2563eb" />
            <Text style={styles.cardTitle2}>Géolocalisation</Text>
            {locationLoading && <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 8 }} />}
          </View>
          {location ? (
            <>
              <Text style={styles.coords}>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>
              {distance !== null && (
                <View style={[styles.geofenceRow, { backgroundColor: isWithinGeofence ? '#d1fae5' : '#fee2e2' }]}>
                  <Ionicons
                    name={isWithinGeofence ? 'checkmark-circle' : 'warning'}
                    size={17}
                    color={isWithinGeofence ? '#10b981' : '#ef4444'}
                  />
                  <Text style={[styles.geofenceText, { color: isWithinGeofence ? '#065f46' : '#991b1b' }]}>
                    {isWithinGeofence
                      ? `Dans la zone (${distance}m)`
                      : `Hors zone — ${distance}m (max ${selectedEvent?.geoRadius || 200}m)`}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={{ color: '#f59e0b', fontSize: 13 }}>Acquisition GPS...</Text>
          )}
        </View>

        {/* Warning hors géofence */}
        {isWithinGeofence === false && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={17} color="#f59e0b" />
            <Text style={styles.warningText}>Hors de la zone autorisée — le pointage sera signalé.</Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => { setCapturedPhoto(null); setStep('camera'); }}
            disabled={isSubmitting}
          >
            <Ionicons name="camera-reverse" size={17} color="#6b7280" />
            <Text style={styles.retakeBtnText}>Reprendre</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (!location || isSubmitting) && styles.btnDisabled]}
            onPress={submitCheckIn}
            disabled={!location || isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="checkmark-circle" size={17} color="#fff" /><Text style={styles.confirmBtnText}>Confirmer</Text></>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── Pas de permission caméra ─────────────────────────────
  if (cameraPermission === false) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Caméra requise</Text>
        <Text style={styles.errorText}>Autorisez la caméra dans les paramètres de l'application.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.btnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Vue caméra (step = 'camera') ─────────────────────────
  return (
    <View style={styles.container}>
      {/* Barre infos événement + distance (même que web) */}
      {selectedEvent && (
        <View style={styles.cameraTopBar}>
          <Text style={styles.cameraEventName} numberOfLines={1}>{selectedEvent.name}</Text>
          {distance !== null && (
            <View style={[styles.distPill, { backgroundColor: isWithinGeofence ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.distPillText}>{distance}m</Text>
            </View>
          )}
        </View>
      )}

      {/* 🆕 Indicateurs Web-like: Battery + Socket + GPS */}
      <View style={styles.statusBar}>
        {/* Battery */}
        {batteryLevel !== null && (
          <View style={[styles.statusBadge, { backgroundColor: batteryLevel < 20 ? '#ef4444' : '#10b981' }]}>
            <Ionicons name={batteryCharging ? 'battery-charging' : 'battery-full'} size={12} color="#fff" />
            <Text style={styles.statusBadgeText}>{batteryLevel}%</Text>
          </View>
        )}
        
        {/* Socket.IO */}
        <View style={[styles.statusBadge, { 
          backgroundColor: isSocketAuthenticated ? '#10b981' : isSocketConnected ? '#f59e0b' : '#6b7280' 
        }]}>
          <Ionicons name="wifi" size={12} color="#fff" />
          <Text style={styles.statusBadgeText}>
            {isSocketAuthenticated ? 'En ligne' : isSocketConnected ? 'Auth...' : 'Hors ligne'}
          </Text>
        </View>
        
        {/* GPS Tracking */}
        <View style={[styles.statusBadge, { backgroundColor: location ? '#10b981' : '#f59e0b' }]}>
          <Ionicons name="location" size={12} color="#fff" />
          <Text style={styles.statusBadgeText}>GPS</Text>
        </View>
      </View>

      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants?.Type?.front ?? 1}
        onCameraReady={() => { setCameraReady(true); setFaceDetected(true); }}
      >
        <View style={styles.overlay}>
          {/* Top */}
          <View style={styles.topOverlay}>
            <Text style={styles.instructionText}>Placez votre visage dans le cadre</Text>
          </View>

          {/* Oval guide (même design que web) */}
          <View style={styles.middleRow}>
            <View style={styles.sideMask} />
            <View style={[styles.faceGuide, { borderColor: faceDetected ? '#10b981' : '#fff' }]}>
              {faceDetected && (
                <View style={styles.faceOKBadge}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.sideMask} />
          </View>

          {/* Bottom */}
          <View style={styles.bottomOverlay}>
            {/* GPS indicator */}
            <View style={styles.gpsRow}>
              <Ionicons
                name={location ? 'location' : locationLoading ? 'hourglass-outline' : 'location-outline'}
                size={17}
                color={location ? (isWithinGeofence === false ? '#ef4444' : '#10b981') : '#f59e0b'}
              />
              <Text style={[styles.gpsText, {
                color: location ? (isWithinGeofence === false ? '#ef4444' : '#10b981') : '#f59e0b'
              }]}>
                {locationLoading
                  ? 'Acquisition GPS...'
                  : location
                    ? (distance !== null ? `${distance}m de l'événement` : 'Position OK')
                    : 'GPS indisponible'}
              </Text>
            </View>

            {/* Bouton capture */}
            <TouchableOpacity
              style={[styles.captureBtn, (!faceDetected || !cameraReady) && styles.captureBtnDisabled]}
              onPress={capturePhoto}
              disabled={!faceDetected || !cameraReady}
            >
              <Ionicons name="camera" size={32} color={faceDetected ? '#fff' : '#9ca3af'} />
            </TouchableOpacity>

            <Text style={styles.captureHint}>
              {faceDetected ? 'Appuyez pour capturer' : 'Aucun visage détecté'}
            </Text>
          </View>
        </View>
      </Camera>
    </View>
  );
};

// ──────────────────── STYLES ────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#000' },
  bgGray:     { flex: 1, backgroundColor: '#f3f4f6' },
  centered:   { flex: 1, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:{ marginTop: 12, color: '#6b7280', fontSize: 15 },
  pageTitle:  { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  pageSubtitle:{ fontSize: 13, color: '#6b7280', marginBottom: 20 },
  eventSelectCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3,
  },
  eventSelectName: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  eventSelectLoc:  { fontSize: 12, color: '#6b7280', marginTop: 3 },
  errorTitle:  { fontSize: 18, fontWeight: '600', color: '#1f2937', marginTop: 16, textAlign: 'center' },
  errorText:   { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginTop: 16 },
  successText:  { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  eventNameSmall: { fontSize: 14, color: '#2563eb', marginTop: 8, fontWeight: '600' },
  eventInfoBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 20, alignItems: 'center', minWidth: 260 },
  eventInfoName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  eventInfoLoc:  { fontSize: 13, color: '#6b7280', marginTop: 4 },
  // Confirm step
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2,
  },
  cardTitle:  { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 6 },
  cardTitle2: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginLeft: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  infoText:   { fontSize: 13, color: '#6b7280', marginLeft: 5, flex: 1 },
  photoWrap:  { position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  previewImage: { width: '100%', height: 240, resizeMode: 'cover' },
  faceBadge: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  faceBadgeText: { color: '#fff', fontSize: 11, marginLeft: 4, fontWeight: '500' },
  coords: { fontSize: 12, color: '#6b7280', marginBottom: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  geofenceRow:  { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8 },
  geofenceText: { marginLeft: 7, fontSize: 13, fontWeight: '500', flex: 1 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 12 },
  warningText:   { flex: 1, marginLeft: 7, color: '#92400e', fontSize: 12 },
  actionRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#d1d5db',
  },
  retakeBtnText: { marginLeft: 6, color: '#6b7280', fontSize: 15, fontWeight: '500' },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12,
  },
  confirmBtnText: { marginLeft: 6, color: '#fff', fontSize: 15, fontWeight: '600' },
  btnDisabled:    { backgroundColor: '#9ca3af' },
  // Camera view
  camera:  { flex: 1 },
  overlay: { flex: 1 },
  cameraTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 38, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cameraEventName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 10 },
  distPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  distPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // 🆕 Status Bar Web-like
  statusBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 92 : 78,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 19,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  topOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 16,
  },
  instructionText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  middleRow:   { flexDirection: 'row', height: 270 },
  sideMask:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  faceGuide: {
    width: 210, height: 270, borderWidth: 3, borderRadius: 110,
    borderStyle: 'dashed', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 10,
  },
  faceOKBadge: { backgroundColor: '#10b981', borderRadius: 20, padding: 4 },
  bottomOverlay: { flex: 1.5, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: 24 },
  gpsRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  gpsText:    { marginLeft: 8, fontSize: 13 },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#10b981',
    justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff',
  },
  captureBtnDisabled: { backgroundColor: '#374151' },
  captureHint: { color: '#9ca3af', fontSize: 13, marginTop: 14 },
});

export default CheckInScreen;

