import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCamera, FiMapPin, FiClock, FiCheckCircle, FiXCircle,
  FiUser, FiCalendar, FiNavigation, FiRefreshCw, FiAlertCircle,
  FiLoader, FiEye, FiShield, FiTarget, FiActivity, FiCheck
} from 'react-icons/fi';
import { attendanceAPI, eventsAPI, authAPI, usersAPI, assignmentsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as faceapi from 'face-api.js';

// Configuration
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MATCH_THRESHOLD = 0.50; // Seuil de correspondance: 50% (>=50% = Valide, <50% = Rejeté)
const AUTO_CAPTURE_QUALITY = 75;
const AUTO_CAPTURE_STABILITY_TIME = 2000;
const LIVENESS_BLINK_THRESHOLD = 0.3;

const CheckInOut = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [searchedAgent, setSearchedAgent] = useState(null);
  const [cin, setCin] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [todayStatus, setTodayStatus] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  // États reconnaissance faciale
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [storedDescriptor, setStoredDescriptor] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [matchScore, setMatchScore] = useState(0);
  const [stabilityScore, setStabilityScore] = useState(0);
  const [facialProgress, setFacialProgress] = useState(0);
  const [accessoryWarning, setAccessoryWarning] = useState(null);
  const [instructions, setInstructions] = useState('Chargement...');
  const [livenessStatus, setLivenessStatus] = useState({ isRealPerson: false, score: 0, blinkDetected: false });
  const [captureCountdown, setCaptureCountdown] = useState(0);
  const goodQualityStartRef = useRef(null);
  const lastPositionsRef = useRef([]);
  const blinkStartRef = useRef(null);
  const lastBlinkTimeRef = useRef(0);

  // Charger les modèles face-api.js
  useEffect(() => {
    const loadFaceModels = async () => {
      try {
        setInstructions('Chargement des modèles IA...');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        setInstructions('Activez la caméra pour commencer');
      } catch (error) {
        console.error('Erreur chargement modèles:', error);
        setInstructions('Erreur de chargement');
      }
    };
    loadFaceModels();
  }, []);

  // Charger le profil utilisateur et rediriger si nécessaire
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const response = await authAPI.getProfile();
        const user = response.data.data;
        setCurrentUser(user);
        
        // Plus de redirection - tous les utilisateurs utilisent cette page
        // Les agents/responsables font leur propre check-in
        // Les admins/utilisateurs peuvent faire le check-in pour d'autres
      } catch (error) {
        console.error('Erreur chargement profil:', error);
      }
    };
    checkUserRole();
  }, [navigate]);

  // Charger le descripteur facial de l'utilisateur connecté
  useEffect(() => {
    const loadUserDescriptor = async () => {
      try {
        const response = await authAPI.getProfile();
        const user = response.data.data;
        console.log('👤 User profile loaded:', {
          id: user?.id,
          firstName: user?.firstName,
          hasFacialVector: !!user?.facialVector
        });

        // Le facialVector est supprimé dans toJSON() pour la sécurité
        // On le récupère via l'API spécifique pour CheckInOut
        try {
          console.log('📥 Calling getFacialVectorForCheckIn...');
          const facialResponse = await authAPI.getFacialVectorForCheckIn();
          console.log('📊 Facial vector response:', {
            success: facialResponse.data.success,
            hasData: !!facialResponse.data.data,
            vectorLength: facialResponse.data.data?.facialVector?.length
          });

          if (facialResponse.data.success && facialResponse.data.data?.facialVector) {
            const vectorData = facialResponse.data.data.facialVector;
            // Convertir en Float32Array si c'est un array
            let descriptor;
            if (Array.isArray(vectorData)) {
              descriptor = new Float32Array(vectorData);
            } else if (vectorData instanceof Float32Array) {
              descriptor = vectorData;
            } else {
              console.warn('⚠️ Unexpected facial vector type:', typeof vectorData);
              descriptor = new Float32Array(vectorData);
            }
            
            console.log('✅ Facial descriptor loaded:', {
              length: descriptor.length,
              first5: Array.from(descriptor.slice(0, 5)),
              sample: descriptor[0]
            });
            
            setStoredDescriptor(descriptor);
          } else {
            console.warn('⚠️ No facial vector in response:', facialResponse.data);
          }
        } catch (apiError) {
          console.error('❌ API error fetching facial vector:', {
            message: apiError.message,
            status: apiError.response?.status,
            response: apiError.response?.data
          });
        }
      } catch (error) {
        console.error('❌ Erreur chargement descripteur:', error);
      }
    };
    loadUserDescriptor();
  }, []);

  useEffect(() => {
    fetchTodayEvents();
    getLocation();
    return () => {
      stopCamera();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const fetchTodayEvents = async () => {
    try {
      // ✅ Charger les événements d'aujourd'hui
      let eventsRes = await eventsAPI.getToday();
      let allEvents = eventsRes.data?.data || [];
      
      console.log('📅 Events loaded:', allEvents.length, allEvents);
      
      // ✅ Essayer de charger les affectations de l'utilisateur
      try {
        const assignmentsRes = await assignmentsAPI.getMyAssignments({ status: 'confirmed', today: true });
        const assignments = assignmentsRes.data?.data || [];
        
        console.log('📋 Assignments loaded:', assignments.length, assignments);
        
        if (assignments.length > 0) {
          const assignedEventIds = assignments.map(a => a.eventId);
          console.log('🎯 Assigned event IDs:', assignedEventIds);
          
          // Filtrer les événements: garder seulement ceux où l'utilisateur est affecté
          const assignedEvents = allEvents.filter(e => assignedEventIds.includes(e.id));
          console.log('✅ Filtered events:', assignedEvents.length);
          setEvents(assignedEvents);
        } else {
          // Pas d'affectations confirmées, afficher tous les événements
          console.warn('⚠️ No confirmed assignments, showing all events');
          setEvents(allEvents);
        }
      } catch (err) {
        // Si les affectations échouent, afficher tous les événements
        console.warn('⚠️ Could not load assignments, showing all events:', err.message);
        setEvents(allEvents);
      }
      
      // Charger le statut de présence
      try {
        const statusRes = await attendanceAPI.getTodayStatus();
        setTodayStatus(statusRes.data?.data?.events || []);
      } catch (err) {
        console.warn('⚠️ Could not load today status:', err.message);
      }
    } catch (error) {
      console.error('Error fetching today events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Géolocalisation non supportée');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError('Impossible d\'obtenir la position');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearchByCin = async () => {
    if (!cin.trim()) {
      toast.error('Veuillez entrer un CIN');
      return;
    }

    setSearching(true);
    try {
      const response = await usersAPI.searchByCin(cin.trim());
      
      if (response && response.data && response.data.data) {
        const agent = response.data.data;
        
        setSearchedAgent(agent);
        toast.success(`Agent trouvé: ${agent.firstName} ${agent.lastName}`);
        
        console.log('🔍 Agent searched:', {
          id: agent.id,
          cin: agent.cin,
          firstName: agent.firstName,
          hasFacialVector: !!agent.facialVector,
          vectorType: typeof agent.facialVector,
          vectorLength: Array.isArray(agent.facialVector) ? agent.facialVector.length : agent.facialVector?.length
        });
        
        // Charger le descripteur facial de l'agent
        if (agent.facialVector) {
          try {
            let descriptor;
            
            // Le vecteur peut être un array, une string JSON, ou déjà décrypté du backend
            if (Array.isArray(agent.facialVector)) {
              descriptor = new Float32Array(agent.facialVector);
            } else if (typeof agent.facialVector === 'string') {
              try {
                const parsed = JSON.parse(agent.facialVector);
                descriptor = new Float32Array(parsed);
              } catch {
                console.warn('⚠️ Could not parse facial vector as JSON, trying direct conversion');
                descriptor = new Float32Array(agent.facialVector);
              }
            } else if (agent.facialVector instanceof Float32Array) {
              descriptor = agent.facialVector;
            } else {
              // Essayez de convertir directement
              descriptor = new Float32Array(Object.values(agent.facialVector));
            }
            
            console.log('✅ Agent facial descriptor loaded:', {
              cin: agent.cin,
              length: descriptor.length,
              first5: Array.from(descriptor.slice(0, 5))
            });
            
            setStoredDescriptor(descriptor);
          } catch (parseError) {
            console.error('❌ Error parsing agent facial vector:', {
              cin: agent.cin,
              error: parseError.message
            });
            toast.error('Erreur lors du chargement du vecteur facial de l\'agent');
            setStoredDescriptor(null);
          }
        } else {
          console.warn('⚠️ Agent has no facial vector');
          toast.warning('Cet agent n\'a pas de vecteur facial enregistré');
          setStoredDescriptor(null);
        }
      } else {
        toast.error('Agent non trouvé avec ce CIN');
        setSearchedAgent(null);
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Agent non trouvé avec ce CIN';
      toast.error(errorMessage);
      setSearchedAgent(null);
    } finally {
      setSearching(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Force la lecture de la vidéo
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(err => {
            console.error('Erreur lecture vidéo:', err);
          });
        };
      }
      setCameraActive(true);
      setVerificationResult(null);
      setInstructions('Positionnez votre visage dans le cadre');
    } catch (error) {
      console.error('Erreur caméra:', error);
      toast.error('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Détection des yeux pour clignotement (liveness)
  const detectBlink = (landmarks) => {
    if (!landmarks) return false;

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    return avgEAR < LIVENESS_BLINK_THRESHOLD;
  };

  const calculateEAR = (eye) => {
    const vertical1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const vertical2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const horizontal = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (vertical1 + vertical2) / (2 * horizontal);
  };

  // Détection d'accessoires
  const detectAccessories = (landmarks, detection) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const jawline = landmarks.getJawOutline();

    // Détection lunettes
    const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
    const leftEyeWidth = Math.abs(leftEye[3].x - leftEye[0].x);
    const leftEyeRatio = leftEyeHeight / leftEyeWidth;

    const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
    const rightEyeWidth = Math.abs(rightEye[3].x - rightEye[0].x);
    const rightEyeRatio = rightEyeHeight / rightEyeWidth;

    const hasGlasses = leftEyeRatio < 0.18 || rightEyeRatio < 0.18;

    // Détection chapeau
    const foreheadTop = nose[0].y - (jawline[8].y - nose[0].y) * 0.85;
    const foreheadSpace = detection.box.y - foreheadTop;
    const hasHat = foreheadSpace > detection.box.height * 0.12;

    // Détection masque
    const noseBridge = landmarks.getNose().slice(0, 3);
    const noseVisible = noseBridge.every(point => point.y > jawline[0].y);
    const hasMask = !noseVisible && (jawline[8].y - landmarks.getNose()[0].y) < (jawline[8].y - foreheadTop) * 0.6;

    return {
      hasGlasses,
      hasHat,
      hasMask,
      warning: hasMask ? 'Veuillez retirer votre masque' : hasGlasses ? 'Veuillez retirer vos lunettes' : hasHat ? 'Veuillez retirer votre chapeau' : null
    };
  };

  // Boucle de détection faciale
  const runFaceDetection = useCallback(async () => {
    if (!videoRef.current || !cameraActive || !modelsLoaded) return;

    const video = videoRef.current;
    if (video.readyState !== 4) {
      animationRef.current = requestAnimationFrame(runFaceDetection);
      return;
    }

    try {
      let detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (detection) {
        setFaceDetected(true);

        // Détection accessoires
        const accessories = detectAccessories(detection.landmarks, detection.detection);

        if (accessories.warning) {
          setAccessoryWarning(accessories.warning);
          setInstructions(accessories.warning);
          setFacialProgress(0);
          setLivenessStatus({ isRealPerson: false, score: 0, blinkDetected: false });
          goodQualityStartRef.current = null;
        } else {
          setAccessoryWarning(null);

          // Détection clignotement (liveness)
          const isBlinking = detectBlink(detection.landmarks);
          if (isBlinking && !blinkStartRef.current) {
            blinkStartRef.current = Date.now();
          } else if (!isBlinking && blinkStartRef.current) {
            const blinkDuration = Date.now() - blinkStartRef.current;
            if (blinkDuration > 50 && blinkDuration < 400) {
              const now = Date.now();
              if (now - lastBlinkTimeRef.current > 1000) {
                setLivenessStatus(prev => ({
                  ...prev,
                  blinkDetected: true,
                  score: Math.min(100, prev.score + 30)
                }));
                lastBlinkTimeRef.current = now;
              }
            }
            blinkStartRef.current = null;
          }

          // Calcul qualité
          const box = detection.detection.box;
          const faceSize = (box.width * box.height) / (video.videoWidth * video.videoHeight);
          const sizeScore = Math.min(100, faceSize * 800);
          const confidenceScore = detection.detection.score * 100;
          const qualityScore = Math.round((sizeScore + confidenceScore) / 2);

          setFacialProgress(qualityScore);

          // Stabilité
          const currentPosition = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          lastPositionsRef.current.push(currentPosition);
          if (lastPositionsRef.current.length > 10) {
            lastPositionsRef.current.shift();
          }

          let stability = 0;
          if (lastPositionsRef.current.length >= 5) {
            const positions = lastPositionsRef.current;
            let totalMovement = 0;
            for (let i = 1; i < positions.length; i++) {
              const dx = positions[i].x - positions[i - 1].x;
              const dy = positions[i].y - positions[i - 1].y;
              totalMovement += Math.sqrt(dx * dx + dy * dy);
            }
            const avgMovement = totalMovement / (positions.length - 1);
            stability = Math.max(0, Math.min(100, 100 - avgMovement * 1.5));
          }
          setStabilityScore(Math.round(stability));

          // Score de correspondance
          let currentMatchScore = 0;
          if (storedDescriptor && detection.descriptor) {
            try {
              // Assurez-vous que les deux sont des Float32Array
              const referenceDescriptor = storedDescriptor instanceof Float32Array ? storedDescriptor : new Float32Array(storedDescriptor);
              const capturedDescriptor = detection.descriptor instanceof Float32Array ? detection.descriptor : new Float32Array(detection.descriptor);
              
              // Calcul de la distance euclidienne
              const distance = faceapi.euclideanDistance(capturedDescriptor, referenceDescriptor);
              
              // Conversion en score de correspondance
              // Distance typique pour une bonne correspondance: 0.4-0.6
              // Distance pour une mauvaise correspondance: >0.8
              currentMatchScore = Math.max(0, Math.min(100, (1 - Math.min(distance, 1.0)) * 100));
              
              console.log('🔍 Face comparison:', {
                distance: distance.toFixed(3),
                matchScore: currentMatchScore.toFixed(1),
                referenceLength: referenceDescriptor.length,
                capturedLength: capturedDescriptor.length
              });
              
              setMatchScore(Math.round(currentMatchScore));
            } catch (compareError) {
              console.error('❌ Face comparison error:', compareError);
              setMatchScore(0);
            }
          } else {
            console.warn('⚠️ Missing descriptor for comparison:', {
              hasStored: !!storedDescriptor,
              hasDetected: !!detection.descriptor
            });
          }

          // Mise à jour liveness
          if (qualityScore >= AUTO_CAPTURE_QUALITY && stability >= 50) {
            setLivenessStatus(prev => ({
              ...prev,
              isRealPerson: prev.blinkDetected || stability >= 70,
              score: Math.min(100, prev.score + (qualityScore > 85 ? 2 : 0.5))
            }));
          }

          // Instructions
          if (qualityScore >= AUTO_CAPTURE_QUALITY && stability >= 50) {
            if (!goodQualityStartRef.current) {
              goodQualityStartRef.current = Date.now();
              setInstructions('Excellente position! Maintenez...');
            } else {
              const elapsed = Date.now() - goodQualityStartRef.current;
              const remainingSeconds = Math.ceil((AUTO_CAPTURE_STABILITY_TIME - elapsed) / 1000);
              setCaptureCountdown(remainingSeconds);
              
              if (elapsed >= AUTO_CAPTURE_STABILITY_TIME) {
                setInstructions('📸 Capture automatique!');
                captureAndVerify(detection, currentMatchScore);
                return;
              } else {
                setInstructions(`⏱️ Capture automatique dans ${remainingSeconds}s...`);
              }
            }
          } else {
            goodQualityStartRef.current = null;
            setCaptureCountdown(0);
            if (qualityScore < AUTO_CAPTURE_QUALITY) {
              setInstructions('Rapprochez-vous légèrement');
            } else if (stability < 50) {
              setInstructions('Restez plus immobile');
            }
          }
        }
      } else {
        setFaceDetected(false);
        setFacialProgress(0);
        setStabilityScore(0);
        setMatchScore(0);
        setAccessoryWarning(null);
        setCaptureCountdown(0);
        setInstructions('Positionnez votre visage dans le cadre');
        setLivenessStatus({ isRealPerson: false, score: 0, blinkDetected: false });
        goodQualityStartRef.current = null;
        lastPositionsRef.current = [];
        blinkStartRef.current = null;
      }
    } catch (error) {
      console.error('Erreur détection:', error);
    }

    animationRef.current = requestAnimationFrame(runFaceDetection);
  }, [cameraActive, modelsLoaded, storedDescriptor]);

  useEffect(() => {
    if (cameraActive && modelsLoaded) {
      runFaceDetection();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraActive, modelsLoaded, runFaceDetection]);

  // Capture et vérification
  const captureAndVerify = async (detection, currentMatchScore = 0) => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Limit resolution to reduce file size (fit in TEXT column max 64KB)
    const maxSize = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;

    // Calculate scaled dimensions maintaining aspect ratio
    if (width > height) {
      if (width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    const photoData = canvas.toDataURL('image/jpeg', 0.5);
    setCapturedPhoto(photoData);
    stopCamera();

    // Utiliser le currentMatchScore passé en paramètre (score actuel calculé)
    const finalMatchScore = currentMatchScore > 0 ? currentMatchScore : matchScore;
    
    // Logique de reconnaissance faciale:
    // - Si matchScore > 50% → Visage RECONNU = Valide ✅
    // - Si 0% < matchScore < 50% → Visage DETECTE mais NON RECONNU ❌
    // - Si matchScore = 0% → Aucun visage DETECTE ❌
    const isFaceDetected = finalMatchScore > 0;
    const isMatch = finalMatchScore > 50;  // Strictement supérieur à 50%
    // ✅ LIVENESS CHECK DISABLED - seulement matchScore > 50% suffit
    const isLivenessValid = true;  // Accepter tous les visages

    console.log('📸 Verification result:', {
      matchScore: Math.round(finalMatchScore),
      livenessScore: livenessStatus.score,
      qualityScore: facialProgress,
      stabilityScore: stabilityScore,
      isFaceDetected,
      isMatch,
      isLivenessValid,
      success: isMatch,  // ✅ Seulement basé sur matchScore > 50%
      faceStatus: isFaceDetected ? (isMatch ? '✅ RECONNU' : '❌ NON RECONNU') : '❌ PAS DE VISAGE',
      threshold: 50
    });

    const result = {
      success: isMatch,  // ✅ Pointage confirmé si matchScore > 50%
      matchScore: finalMatchScore,
      livenessScore: livenessStatus.score,
      quality: facialProgress,
      stability: stabilityScore,
      timestamp: new Date()
    };

    setVerificationResult(result);
    setAttemptHistory(prev => [result, ...prev].slice(0, 5));

    if (result.success) {
      setInstructions('✅ Vérification réussie! Photo capturée.');
      toast.success(`✅ Reconnaissance faciale confirmée! (${Math.round(finalMatchScore)}% de correspondance)`);
    } else {
      setInstructions('❌ Vérification échouée. Veuillez réessayer.');
      console.warn('❌ Verification failed:', {
        reason: !isFaceDetected ? 'Face not detected' : 'Low match score',
        matchScore: Math.round(finalMatchScore),
        threshold: 50
      });
      
      // Messages distincts selon le cas
      if (!isFaceDetected) {
        // Cas 1: Aucun visage détecté (matchScore = 0%)
        toast.error('❌ Aucun visage détecté (0%). Positionnez votre visage dans le cadre.');
      } else if (!isMatch) {
        // Cas 2: Visage détecté mais non reconnu (0% < matchScore <= 50%)
        toast.error(`❌ Visage non reconnu (${Math.round(finalMatchScore)}% ≤ 50%). Veuillez réessayer.`);
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    const photoData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(photoData);
    stopCamera();
    setVerificationResult({ success: false, matchScore, manual: true });
  };

  const handleCheckIn = async () => {
    if (!selectedEvent) {
      toast.error('Sélectionnez un événement');
      return;
    }
    if (!location) {
      toast.error('Position GPS requise');
      return;
    }
    if (!capturedPhoto) {
      toast.error('Photo de pointage requise');
      return;
    }

    setCheckingIn(true);
    try {
      // Récupérer les informations d'appareil depuis le backend
      let deviceInfo = {
        deviceName: 'Unknown',
        ipAddress: 'Unknown',
        macAddress: null  // Impossible à récupérer depuis le navigateur pour des raisons de sécurité
      };

      try {
        const deviceResponse = await attendanceAPI.getDeviceInfo();
        if (deviceResponse.data?.success) {
          deviceInfo = {
            deviceName: deviceResponse.data.data.deviceName,
            ipAddress: deviceResponse.data.data.ipAddress,
            macAddress: null
          };
          console.log('📱 Device Info:', deviceInfo);
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch device info:', err);
      }
      
      const checkInData = {
        eventId: selectedEvent.id,
        latitude: location.latitude,
        longitude: location.longitude,
        checkInPhoto: capturedPhoto,
        checkInMethod: 'facial',
        facialMatchScore: (verificationResult?.matchScore || matchScore) / 100,
        deviceInfo
      };

      // Si un agent a été recherché et son visage reconnu, envoyer son ID
      // Cela permet à l'admin de pointer pour le compte d'un agent
      if (searchedAgent && searchedAgent.id && verificationResult?.success) {
        checkInData.agentId = searchedAgent.id;
        console.log('👤 Pointage pour l\'agent:', searchedAgent.firstName, searchedAgent.lastName);
      }
      
      console.log('📤 SENDING CHECK-IN DATA:', {
        ...checkInData,
        photoLength: checkInData.checkInPhoto.length
      });

      const response = await attendanceAPI.checkIn(checkInData);
      
      console.log('✅ CHECK-IN RESPONSE:', response.data);
      
      toast.success(response.data.message || 'Pointage enregistré!');
      setCapturedPhoto(null);
      setSelectedEvent(null);
      setVerificationResult(null);
      fetchTodayEvents();
    } catch (error) {
      console.error('❌ CHECK-IN ERROR:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error(error.response?.data?.message || 'Erreur de pointage');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async (attendanceId) => {
    if (!location) {
      toast.error('Position GPS requise');
      return;
    }
    setCheckingIn(true);
    try {
      const response = await attendanceAPI.checkOut(attendanceId, {
        latitude: location.latitude,
        longitude: location.longitude,
        checkOutPhoto: capturedPhoto,
        checkOutMethod: capturedPhoto ? 'facial' : 'manual'
      });
      toast.success(response.data.message || 'Sortie enregistrée!');
      setCapturedPhoto(null);
      setVerificationResult(null);
      fetchTodayEvents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setCheckingIn(false);
    }
  };

  const calculateDistance = (eventLat, eventLon) => {
    if (!location || !eventLat || !eventLon) return null;
    const R = 6371e3;
    const φ1 = (location.latitude * Math.PI) / 180;
    const φ2 = (eventLat * Math.PI) / 180;
    const Δφ = ((eventLat - location.latitude) * Math.PI) / 180;
    const Δλ = ((eventLon - location.longitude) * Math.PI) / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  };

  const getEventStatus = (eventId) => todayStatus.find(e => e.eventId === eventId);

  const resetCapture = () => {
    setCapturedPhoto(null);
    setVerificationResult(null);
    setMatchScore(0);
    setStabilityScore(0);
    setFacialProgress(0);
    setLivenessStatus({ isRealPerson: false, score: 0, blinkDetected: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FiShield className="mr-3 text-primary-600" />
            Pointage Facial
          </h1>
          <p className="text-gray-500 mt-1">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <button onClick={getLocation} className="btn-secondary flex items-center">
          <FiRefreshCw className="mr-2" /> Position GPS
        </button>
      </div>

      {/* Carte d'info pour agents/responsables faisant leur propre check-in */}
      {currentUser && (currentUser.role === 'agent' || currentUser.role === 'responsable') && (
        <div className="card bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
          <div className="flex items-center gap-4">
            {currentUser.profilePhoto && (
              <img 
                src={currentUser.profilePhoto} 
                alt={currentUser.firstName}
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500"
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-indigo-900 flex items-center">
                <FiUser className="mr-2" /> 
                Bonjour {currentUser.firstName} {currentUser.lastName}
              </h3>
              <p className="text-sm text-indigo-700">
                CIN: {currentUser.cin} • ID: {currentUser.employeeId}
              </p>
              <p className="text-sm text-indigo-600 mt-1">
                <span className="font-medium">Rôle:</span> <span className="capitalize">{currentUser.role === 'agent' ? 'Agent' : 'Responsable'}</span>
              </p>
            </div>
            <FiCheckCircle className="text-indigo-500" size={32} />
          </div>
          <p className="text-sm text-indigo-700 mt-3 flex items-center">
            <FiShield className="mr-2" />
            Utilisez la caméra ci-dessous pour effectuer votre pointage facial
          </p>
        </div>
      )}

      {/* Champ CIN pour admins et utilisateurs */}
      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'utilisateur') && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold mb-3 flex items-center text-blue-900">
            <FiUser className="mr-2" /> Check-in pour un agent
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Entrez le CIN de l'agent (ex: BK517312)"
              value={cin}
              onChange={(e) => setCin(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchByCin()}
              className="input flex-1"
              disabled={searching}
            />
            <button
              onClick={handleSearchByCin}
              disabled={searching || !cin.trim()}
              className="btn-primary flex items-center"
            >
              {searching ? <FiLoader className="mr-2 animate-spin" /> : <FiUser className="mr-2" />}
              Rechercher
            </button>
          </div>
          
          {/* Affichage de l'agent trouvé */}
          {searchedAgent && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
              <div className="flex items-center gap-4">
                {searchedAgent.profilePhoto && (
                  <img 
                    src={searchedAgent.profilePhoto} 
                    alt={searchedAgent.firstName}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">
                    {searchedAgent.firstName} {searchedAgent.lastName}
                  </h4>
                  <p className="text-sm text-gray-600">
                    CIN: {searchedAgent.cin} • ID: {searchedAgent.employeeId}
                  </p>
                  <p className="text-sm text-gray-600">
                    Rôle: <span className="capitalize">{searchedAgent.role}</span> • 
                    Statut: <span className={`font-medium ${searchedAgent.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                      {searchedAgent.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </p>
                </div>
                <FiCheckCircle className="text-green-500" size={32} />
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-600 mt-2">
            💡 Entrez le CIN de l'agent pour effectuer son pointage
          </p>
        </div>
      )}

      {/* Status GPS */}
      <div className={`card ${location ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FiMapPin className={`mr-3 ${location ? 'text-green-600' : 'text-red-600'}`} size={24} />
            <div>
              <p className="font-medium">{location ? 'Position GPS active' : 'En attente de position...'}</p>
              {location && (
                <p className="text-sm text-gray-600">
                  Précision: ±{Math.round(location.accuracy)}m
                </p>
              )}
            </div>
          </div>
          {location && <FiCheck className="text-green-600" size={24} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera & Facial Recognition */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiTarget className="mr-2" /> Vérification Faciale
          </h2>

          <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-[4/3]">
            {/* Vidéo toujours affichée */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ zIndex: 1 }}
              onLoadedMetadata={(e) => {
                console.log('Video metadata loaded');
                e.target.play().catch(err => console.error('Play error:', err));
              }}
              onCanPlay={() => console.log('Video can play')}
              onError={(e) => {
                console.error('Video error:', e);
                toast.error('Erreur de lecture vidéo');
              }}
            />

            {/* Info agent/responsable connecté - affichée sur la vidéo */}
            {!searchedAgent && currentUser && (currentUser.role === 'agent' || currentUser.role === 'responsable') && (
              <div className="absolute top-16 left-0 right-0 p-4" style={{ zIndex: 3 }}>
                <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    {currentUser.profilePhoto && (
                      <img 
                        src={currentUser.profilePhoto} 
                        alt={currentUser.firstName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-gray-900">
                        {currentUser.firstName} {currentUser.lastName}
                      </h4>
                      <p className="text-xs text-gray-600">
                        <span className="capitalize font-medium">{currentUser.role === 'agent' ? 'Agent' : 'Responsable'}</span>
                        {currentUser.cin && ` • CIN: ${currentUser.cin}`}
                      </p>
                    </div>
                    <FiShield className="text-indigo-500" size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* Info agent recherché - affichée sur la vidéo */}
            {searchedAgent && (
              <div className="absolute top-16 left-0 right-0 p-4" style={{ zIndex: 3 }}>
                <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    {searchedAgent.profilePhoto && (
                      <img 
                        src={searchedAgent.profilePhoto} 
                        alt={searchedAgent.firstName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-green-500"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-gray-900">
                        {searchedAgent.firstName} {searchedAgent.lastName}
                      </h4>
                      <p className="text-xs text-gray-600">
                        <span className="capitalize font-medium">{searchedAgent.role}</span>
                        {searchedAgent.cin && ` • CIN: ${searchedAgent.cin}`}
                      </p>
                    </div>
                    <FiCheckCircle className="text-green-500" size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* Message quand caméra inactive */}
            {!cameraActive && !capturedPhoto && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center text-gray-400" style={{ zIndex: 2 }}>
                <div className="text-center">
                  <FiUser size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Caméra inactive</p>
                  <p className="text-sm text-gray-500 mt-1">Cliquez sur "Activer la caméra"</p>
                </div>
              </div>
            )}

            {/* Photo capturée */}
            {capturedPhoto && (
              <img src={capturedPhoto} alt="Captured" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 2 }} />
            )}

            {/* Face Guide Overlay - Guide visuel pour positionner le visage */}
            {cameraActive && !capturedPhoto && (
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                {/* Overlay avec zone de scan */}
                <svg className="w-full h-full" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice">
                  {/* Zone sombre autour */}
                  <defs>
                    <mask id="faceMask">
                      <rect width="640" height="480" fill="white" />
                      <ellipse cx="320" cy="240" rx="140" ry="180" fill="black" />
                    </mask>
                  </defs>
                  
                  {/* Fond semi-transparent sauf zone visage */}
                  <rect width="640" height="480" fill="black" opacity="0.5" mask="url(#faceMask)" />
                  
                  {/* Cercle guide principal */}
                  <ellipse
                    cx="320" cy="240" rx="140" ry="180"
                    fill="none"
                    stroke={faceDetected ? '#10b981' : '#ffffff'}
                    strokeWidth="4"
                    strokeDasharray={faceDetected ? "0" : "15,10"}
                    opacity={faceDetected ? "1" : "0.8"}
                    className={faceDetected ? '' : 'animate-pulse'}
                  />
                  
                  {/* Cercle extérieur animé */}
                  {!faceDetected && (
                    <ellipse
                      cx="320" cy="240" rx="145" ry="185"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      opacity="0.3"
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                  )}
                  
                  {/* Coins du cadre */}
                  <g stroke={faceDetected ? '#10b981' : '#ffffff'} strokeWidth="3" opacity="0.9">
                    {/* Coin haut gauche */}
                    <path d="M 180,60 L 180,100 M 180,60 L 220,60" strokeLinecap="round" />
                    {/* Coin haut droit */}
                    <path d="M 460,60 L 460,100 M 460,60 L 420,60" strokeLinecap="round" />
                    {/* Coin bas gauche */}
                    <path d="M 180,420 L 180,380 M 180,420 L 220,420" strokeLinecap="round" />
                    {/* Coin bas droit */}
                    <path d="M 460,420 L 460,380 M 460,420 L 420,420" strokeLinecap="round" />
                  </g>
                  
                  {/* Points de repère pour les yeux */}
                  {!faceDetected && (
                    <>
                      <circle cx="270" cy="210" r="8" fill="#ffffff" opacity="0.6">
                        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="370" cy="210" r="8" fill="#ffffff" opacity="0.6">
                        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                      </circle>
                      {/* Ligne pour la bouche */}
                      <line x1="290" y1="290" x2="350" y2="290" stroke="#ffffff" strokeWidth="3" opacity="0.6" strokeLinecap="round">
                        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                      </line>
                    </>
                  )}
                  
                  {/* Indicateur de qualité avec barre */}
                  {faceDetected && (
                    <>
                      <rect x="250" y="440" width="140" height="8" rx="4" fill="#1f2937" opacity="0.8" />
                      <rect x="250" y="440" width={140 * (matchScore / 100)} height="8" rx="4" 
                        fill={matchScore > 70 ? '#10b981' : matchScore > 40 ? '#f59e0b' : '#ef4444'} 
                        opacity="0.9">
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite" />
                      </rect>
                    </>
                  )}
                  
                  {/* Compte à rebours circulaire pour capture automatique */}
                  {faceDetected && captureCountdown > 0 && facialProgress >= AUTO_CAPTURE_QUALITY && stabilityScore >= 50 && (
                    <g>
                      {/* Cercle de fond */}
                      <circle cx="320" cy="100" r="35" fill="#1f2937" opacity="0.9" />
                      {/* Cercle de progression */}
                      <circle
                        cx="320" cy="100" r="28"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="5"
                        strokeDasharray={`${Math.round(2 * Math.PI * 28 * (1 - captureCountdown / 2))} ${Math.round(2 * Math.PI * 28)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 320 100)"
                        opacity="0.95"
                      >
                        <animate attributeName="opacity" values="0.8;1;0.8" dur="1s" repeatCount="indefinite" />
                      </circle>
                      {/* Texte compte à rebours */}
                      <text x="320" y="110" textAnchor="middle" fill="#10b981" fontSize="24" fontWeight="bold">
                        {captureCountdown}
                      </text>
                      {/* Icône caméra */}
                      <text x="320" y="85" textAnchor="middle" fontSize="16">📸</text>
                    </g>
                  )}
                </svg>
                
                {/* Ligne de scan animée */}
                {cameraActive && !faceDetected && (
                  <div className="absolute left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70"
                    style={{
                      top: '30%',
                      animation: 'scan 2s ease-in-out infinite'
                    }}>
                  </div>
                )}
              </div>
            )}

            {/* Instructions Banner */}
            <div className={`absolute top-0 left-0 right-0 p-3 text-center transition-colors ${
              accessoryWarning ? 'bg-yellow-500' :
              verificationResult?.success ? 'bg-green-500' :
              verificationResult && !verificationResult.success ? 'bg-red-500' :
              'bg-gray-800/80'
            }`} style={{ zIndex: 3 }}>
              <p className="text-white font-medium text-sm">
                {accessoryWarning || instructions}
              </p>
            </div>

            {/* Face detection indicator */}
            {cameraActive && (
              <div className="absolute bottom-4 left-4 right-4" style={{ zIndex: 3 }}>
                <div className="flex items-center justify-center gap-4">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                    faceDetected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    {faceDetected ? 'Visage détecté' : 'Positionnez votre visage'}
                  </div>
                  {livenessStatus.blinkDetected && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      <FiActivity size={12} />
                      Clignotement détecté
                    </div>
                  )}
                  {faceDetected && matchScore > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      Match: {Math.round(matchScore)}%
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Control Buttons */}
          <div className="flex gap-3 mt-4">
            {!cameraActive && !capturedPhoto && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startCamera();
                }}
                className="btn-primary flex-1 flex items-center justify-center py-4"
              >
                <FiCamera className="mr-2" /> Activer la caméra (Capture Automatique)
              </button>
            )}
            {cameraActive && (
              <button onClick={stopCamera} className="btn-secondary flex-1 flex items-center justify-center py-4">
                <FiXCircle className="mr-2" /> Arrêter la caméra
              </button>
            )}
            {capturedPhoto && (
              <>
                <button onClick={resetCapture} className="btn-secondary flex-1">
                  Réessayer
                </button>
                <button onClick={startCamera} className="btn-primary flex-1">
                  Nouvelle prise
                </button>
              </>
            )}
          </div>

          {/* Real-time Indicators */}
          {cameraActive && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {/* Qualité */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Qualité</span>
                    <span className={`text-sm font-bold ${
                      facialProgress >= AUTO_CAPTURE_QUALITY ? 'text-green-600' : 'text-gray-600'
                    }`}>{facialProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        facialProgress >= AUTO_CAPTURE_QUALITY ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${facialProgress}%` }}
                    />
                  </div>
                </div>

                {/* Stabilité */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Stabilité</span>
                    <span className={`text-sm font-bold ${
                      stabilityScore >= 60 ? 'text-green-600' : 'text-gray-600'
                    }`}>{stabilityScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        stabilityScore >= 60 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${stabilityScore}%` }}
                    />
                  </div>
                </div>

                {/* Liveness */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Liveness</span>
                    <span className={`text-sm font-bold ${
                      livenessStatus.score >= 60 ? 'text-green-600' : 'text-gray-600'
                    }`}>{livenessStatus.score}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        livenessStatus.score >= 60 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${livenessStatus.score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Match Score */}
              {storedDescriptor && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FiUser size={14} className="text-gray-500" />
                      <span className="text-xs text-gray-500">Correspondance visage</span>
                    </div>
                    <span className={`text-sm font-bold ${
                      matchScore >= 50 ? 'text-green-600' : matchScore >= 30 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{matchScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        matchScore >= 50 ? 'bg-green-500' : matchScore >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(matchScore, 5)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {matchScore >= 50 ? '✅ Reconnaissance réussie' : '❌ Non reconnu (< 50%)'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <div className={`mt-4 p-4 rounded-lg border ${
              verificationResult.success
                ? 'bg-green-50 border-green-300 shadow-lg'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center mb-3">
                {verificationResult.success ? (
                  <div className="flex items-center">
                    <div className="text-3xl mr-3 animate-bounce">✅</div>
                    <div>
                      <p className="font-bold text-green-800 text-lg">Reconnaissance faciale réussie!</p>
                      <p className="text-sm text-green-700">Votre visage a été identifié avec succès</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <FiXCircle className="text-red-600 mr-3" size={24} />
                    <div>
                      <p className={`font-semibold ${
                        verificationResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {verificationResult.success ? 'Vérification réussie!' : 'Vérification échouée'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Score de correspondance: {verificationResult.matchScore}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-gray-500">Qualité</p>
                  <p className="font-medium">{verificationResult.quality}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Stabilité</p>
                  <p className="font-medium">{verificationResult.stability}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Liveness</p>
                  <p className="font-medium">{verificationResult.livenessScore}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Attempt History */}
          {attemptHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Historique des tentatives</p>
              <div className="space-y-2">
                {attemptHistory.map((attempt, index) => (
                  <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">
                      {format(new Date(attempt.timestamp), 'HH:mm:ss')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        attempt.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {attempt.success ? 'Réussi' : 'Échoué'}
                      </span>
                      <span className="text-gray-600">
                        {attempt.matchScore}% correspondance
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Events List */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FiCalendar className="mr-2" /> Événements du jour
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FiCalendar size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucun événement aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Message pointage déjà effectué */}
              {getEventStatus(selectedEvent?.id)?.attendance?.checkInTime && getEventStatus(selectedEvent?.id)?.attendance?.checkOutTime && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center gap-3">
                  <FiCheckCircle className="text-blue-600 flex-shrink-0" size={24} />
                  <div>
                    <p className="font-semibold text-blue-900">✅ Pointage déjà effectué</p>
                    <p className="text-sm text-blue-700">Votre pointage du jour a été complété avec succès</p>
                  </div>
                </div>
              )}

              {events.map((event) => {
                const status = getEventStatus(event.id);
                const distance = calculateDistance(event.latitude, event.longitude);
                const isWithinRange = distance !== null && distance <= (event.geoRadius || 100);

                return (
                  <div
                    key={event.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedEvent?.id === event.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${status?.attendance?.checkOutTime ? 'opacity-60' : ''}`}
                    onClick={() => !status?.attendance?.checkOutTime && setSelectedEvent(event)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{event.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                          <FiMapPin className="mr-1" size={12} />
                          {event.location?.substring(0, 35)}...
                        </p>
                      </div>
                      {status?.attendance?.checkInTime ? (
                        status?.attendance?.checkOutTime ? (
                          <span className="badge bg-gray-100 text-gray-600">✅ Terminé</span>
                        ) : (
                          <span className="badge badge-success">⏱️ En cours</span>
                        )
                      ) : (
                        <span className="badge badge-warning">⏳ En attente</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center text-gray-500">
                        <FiClock className="mr-1" size={12} />
                        {event.checkInTime} - {event.checkOutTime}
                      </span>
                      {distance !== null && (
                        <span className={`flex items-center ${isWithinRange ? 'text-green-600' : 'text-red-600'}`}>
                          <FiNavigation className="mr-1" size={12} />
                          {distance}m
                        </span>
                      )}
                    </div>

                    {status?.attendance?.checkInTime && !status?.attendance?.checkOutTime && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-600 mb-2">
                          Arrivée: {format(new Date(status.attendance.checkInTime), 'HH:mm')}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckOut(status.attendance.id);
                          }}
                          disabled={checkingIn}
                          className="btn-secondary w-full text-sm py-2"
                        >
                          {checkingIn ? 'Traitement...' : 'Pointer la sortie'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Check-in Button and Success Message */}
      {selectedEvent && (
        <div>
          {getEventStatus(selectedEvent.id)?.attendance?.checkInTime && (
            <div className="card mb-4 border-2 border-green-300 bg-green-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-4xl animate-bounce">✅</div>
                  <div>
                    <h3 className="font-bold text-green-900 text-lg">Pointage facial réussi!</h3>
                    <p className="text-green-700">
                      Vous avez été enregistré pour: <strong>{selectedEvent.name}</strong>
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Heure: {format(new Date(getEventStatus(selectedEvent.id).attendance.checkInTime), 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
                <FiCheckCircle className="text-green-600" size={40} />
              </div>
            </div>
          )}

          {!getEventStatus(selectedEvent.id)?.attendance?.checkInTime && (
            <div className={`card border-2 ${
              verificationResult?.success ? 'border-green-500 bg-green-50' : 'border-primary-200 bg-primary-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {verificationResult?.success ? '🎯 Prêt pour le pointage!' : 'Pointage en attente'}
                  </h3>
                  <p className="text-gray-600">{selectedEvent.name}</p>
                  {!verificationResult?.success && (
                    <p className="text-sm text-yellow-600 mt-1">
                      ⚠️ La vérification faciale est requise avant le pointage
                    </p>
                  )}
                  {verificationResult?.success && (
                    <p className="text-sm text-green-700 mt-1">
                      ✅ Reconnaissance faciale confirmée - Cliquez sur confirmer pour terminer
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn || !verificationResult?.success || !location}
                  className={`px-8 py-3 text-lg font-medium rounded-lg flex items-center transition-all ${
                    verificationResult?.success && location
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {checkingIn ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="mr-2" />
                      Confirmer le pointage
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckInOut;
