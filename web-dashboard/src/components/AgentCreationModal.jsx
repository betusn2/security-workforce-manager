import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiUser, FiPhone, FiCamera, FiUpload, FiLoader, FiCheck, FiAlertCircle, FiMapPin, FiClock, FiCalendar } from 'react-icons/fi';
import * as faceapi from 'face-api.js';
import { toast } from 'react-toastify';
import { eventsAPI, zonesAPI, assignmentsAPI } from '../services/api';

const AgentCreationModal = ({ isOpen, onClose, supervisorId, onSuccess, currentEvent, managedZones = [] }) => {
  
  // Log when modal opens with managed zones
  useEffect(() => {
    if (isOpen) {
      console.log('🚪 Agent Creation Modal opened');
      console.log('📍 Managed zones received:', managedZones);
      console.log('📍 Number of zones:', managedZones.length);
      console.log('📅 Current event:', currentEvent);
    }
  }, [isOpen, managedZones, currentEvent]);
  
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    cin: ''
  });
  const [cinPhoto, setCinPhoto] = useState(null);
  const [cinPreview, setCinPreview] = useState(null);
  const [facialPhoto, setFacialPhoto] = useState(null);
  const [facialPreview, setFacialPreview] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedZones, setSelectedZones] = useState([]);
  const [isWithinAllowedPeriod, setIsWithinAllowedPeriod] = useState(false);
  const [eventInfo, setEventInfo] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  // CIN verification states
  const [cinCheckLoading, setCinCheckLoading] = useState(false);
  const [cinExists, setCinExists] = useState(null);
  const [cinExistingUser, setCinExistingUser] = useState(null);
  
  // Real-time face detection states
  const [faceDetectionMessage, setFaceDetectionMessage] = useState('');
  const [faceQualityStatus, setFaceQualityStatus] = useState(''); // 'good', 'warning', 'error'
  const [detectionInterval, setDetectionInterval] = useState(null);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [goodQualityCount, setGoodQualityCount] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Auto-capture et auto-création quand la qualité est parfaite
  useEffect(() => {
    if (faceQualityStatus === 'good' && !autoProcessing && !facialPhoto && isCameraOpen) {
      setGoodQualityCount(prev => prev + 1);
      
      // Attendre 2 détections consécutives "good" (environ 1 seconde)
      if (goodQualityCount >= 1) {
        console.log('✅ Qualité parfaite détectée - Auto-capture en cours...');
        setAutoProcessing(true);
        
        // Capturer la photo automatiquement
        setTimeout(async () => {
          try {
            await captureFacialPhoto();
            console.log('📸 Photo capturée avec succès');
          } catch (error) {
            console.error('❌ Erreur auto-capture:', error);
            setAutoProcessing(false);
          }
        }, 500);
      }
    } else if (faceQualityStatus !== 'good') {
      setGoodQualityCount(0);
    }
  }, [faceQualityStatus, autoProcessing, facialPhoto, isCameraOpen, goodQualityCount]);

  // Auto-soumission après capture de la photo
  useEffect(() => {
    if (autoProcessing && facialPhoto && faceDescriptor) {
      console.log('🔍 Vérification des conditions pour auto-création...');
      console.log('Nom:', formData.nom, 'Prénom:', formData.prenom, 'Tél:', formData.telephone);
      console.log('CIN Photo:', !!cinPhoto, 'Zones:', selectedZones.length);
      
      if (formData.nom && formData.prenom && formData.telephone && cinPhoto && selectedZones.length > 0 && isWithinAllowedPeriod) {
        console.log('🚀 Auto-création de l\'agent...');
        toast.info('🤖 Création automatique de l\'agent...');
        
        setTimeout(() => {
          const form = document.createElement('form');
          form.onsubmit = handleSubmit;
          const event = new Event('submit', { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'target', { writable: false, value: form });
          handleSubmit(event);
        }, 1000);
      } else {
        console.log('⚠️ Conditions non remplies pour auto-création');
        if (!isWithinAllowedPeriod) console.log('- Hors période autorisée');
        if (!formData.nom) console.log('- Nom manquant');
        if (!formData.prenom) console.log('- Prénom manquant');
        if (!formData.telephone) console.log('- Téléphone manquant');
        if (!cinPhoto) console.log('- Photo CIN manquante');
        if (selectedZones.length === 0) console.log('- Aucune zone sélectionnée');
        setAutoProcessing(false);
      }
    }
  }, [facialPhoto, faceDescriptor, autoProcessing, formData, cinPhoto, selectedZones, isWithinAllowedPeriod]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('🔄 Loading face-api models from CDN...');
        // Utiliser le CDN GitHub pour les modèles
        const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        console.log('✅ Face-api models loaded successfully from CDN');
        setModelsLoaded(true);
        toast.success('✅ Modèles de reconnaissance chargés', { autoClose: 2000 });
      } catch (error) {
        console.error('❌ Error loading face-api models:', error);
        toast.error('❌ Erreur: ' + error.message, { autoClose: 5000 });
        
        // Essayer de charger depuis le dossier local en fallback
        try {
          console.log('🔄 Trying local models as fallback...');
          const LOCAL_MODEL_URL = '/models';
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_URL)
          ]);
          console.log('✅ Local models loaded');
          setModelsLoaded(true);
          toast.success('✅ Modèles locaux chargés');
        } catch (localError) {
          console.error('❌ Local models also failed:', localError);
        }
      }
    };
    
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  // Vérifier la période autorisée pour la création d'agent
  useEffect(() => {
    if (currentEvent && isOpen) {
      checkAllowedPeriod();
    }
  }, [currentEvent, isOpen]);

  const checkAllowedPeriod = () => {
    if (!currentEvent) {
      setIsWithinAllowedPeriod(false);
      return;
    }

    const now = new Date();
    
    // Parser les dates depuis la base (format ISO string)
    // startDate et endDate sont en UTC à minuit, on doit les combiner avec les heures locales
    const startDateStr = currentEvent.startDate.split('T')[0]; // '2026-01-22'
    const endDateStr = (currentEvent.endDate || currentEvent.startDate).split('T')[0];
    
    // Créer les dates en heure locale (pas UTC)
    let startDate, endDate;
    
    if (currentEvent.checkInTime) {
      // Combiner la date avec l'heure de check-in
      const [hours, minutes, seconds] = currentEvent.checkInTime.split(':');
      startDate = new Date(`${startDateStr}T${hours}:${minutes}:${seconds || '00'}`);
    } else {
      startDate = new Date(`${startDateStr}T00:00:00`);
    }
    
    if (currentEvent.checkOutTime) {
      // Combiner la date avec l'heure de check-out
      const [hours, minutes, seconds] = currentEvent.checkOutTime.split(':');
      
      // Si c'est minuit (00:00), c'est le lendemain
      if (hours === '00' && minutes === '00') {
        const nextDay = new Date(endDateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];
        endDate = new Date(`${nextDayStr}T${hours}:${minutes}:59`);
      } else {
        endDate = new Date(`${endDateStr}T${hours}:${minutes}:59`);
      }
    } else {
      endDate = new Date(`${endDateStr}T23:59:59`);
    }

    // Période autorisée : utiliser agentCreationBuffer de l'événement (30, 60, 90, ou 120 minutes avant)
    const bufferMinutes = currentEvent.agentCreationBuffer || 120; // Par défaut 2h si non défini
    const allowedStartTime = new Date(startDate.getTime() - (bufferMinutes * 60 * 1000));
    const allowedEndTime = endDate;

    const withinPeriod = now >= allowedStartTime && now <= allowedEndTime;
    setIsWithinAllowedPeriod(withinPeriod);
    setEventInfo({
      name: currentEvent.name,
      startDate: startDate,
      endDate: endDate,
      allowedStart: allowedStartTime,
      allowedEnd: allowedEndTime,
      bufferMinutes: bufferMinutes,
      withinPeriod
    });
  };

  // Check CIN availability with debounce
  useEffect(() => {
    const checkCIN = async () => {
      const cin = formData.cin.trim().toUpperCase();
      
      if (!cin || cin.length < 3) {
        setCinExists(null);
        setCinExistingUser(null);
        return;
      }

      setCinCheckLoading(true);
      
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const accessToken = localStorage.getItem('accessToken');
        const token = localStorage.getItem('token');
        const checkInToken = localStorage.getItem('checkInToken');
        const authToken = accessToken || token || checkInToken;

        console.log('🔐 CIN check auth:', {
          hasAccessToken: !!accessToken,
          hasToken: !!token,
          hasCheckInToken: !!checkInToken,
          selectedToken: authToken ? `${authToken.substring(0, 30)}...` : 'NONE'
        });

        if (!authToken) {
          console.warn('⚠️ No auth token available for CIN check');
          setCinCheckLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/supervisor/check-cin/${cin}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.ok) {
          console.error('CIN check failed:', response.status, response.statusText);
          setCinCheckLoading(false);
          return;
        }

        const data = await response.json();
        
        if (data.success) {
          setCinExists(data.exists);
          setCinExistingUser(data.user || null);
        }
      } catch (error) {
        console.error('Error checking CIN:', error);
      } finally {
        setCinCheckLoading(false);
      }
    };

    const timeoutId = setTimeout(checkCIN, 500); // Debounce 500ms
    return () => clearTimeout(timeoutId);
  }, [formData.cin]);

  // 🗜️ Fonction utilitaire pour compresser une image base64
  const compressBase64Image = (base64Data, maxSize = 640, quality = 0.5) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        
        // Calculer les dimensions redimensionnées
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
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir en base64 compressé
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        console.log(`🗜️ Image compressée: ${Math.round(base64Data.length / 1024)}KB → ${Math.round(compressedBase64.length / 1024)}KB`);
        resolve(compressedBase64);
      };
      img.src = base64Data;
    });
  };

  // Handle CIN photo upload
  const handleCinUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result;
        // 🗜️ COMPRESSER L'IMAGE CIN
        const compressedBase64 = await compressBase64Image(rawBase64, 640, 0.5);
        setCinPhoto(file); // Garder le File object pour compatibilité
        setCinPreview(compressedBase64); // Utiliser la version compressée pour l'aperçu et l'envoi
      };
      reader.readAsDataURL(file);
    }
  };

  // Open camera for facial capture
  const openCamera = async () => {
    // Éviter les appels multiples - vérification stricte
    if (isCameraOpen) {
      console.log('⚠️ Camera UI already open');
      return;
    }
    
    if (streamRef.current) {
      console.log('⚠️ Stream already exists');
      return;
    }

    console.log('📷 Opening camera...');
    
    // Mettre l'état immédiatement pour éviter les doubles appels
    setIsCameraOpen(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      console.log('✅ Camera stream obtained');
      
      if (!videoRef.current) {
        console.error('❌ Video ref is null');
        setIsCameraOpen(false);
        return;
      }
      
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      // Forcer l'attribut autoplay
      videoRef.current.setAttribute('autoplay', '');
      videoRef.current.setAttribute('playsinline', '');
      videoRef.current.muted = true;
      
      // Attendre un court instant puis démarrer
      setTimeout(async () => {
        try {
          if (videoRef.current) {
            await videoRef.current.play();
            console.log('✅ Video playing');
            toast.success('📷 Caméra activée', { autoClose: 2000 });
            
            // Démarrer la détection en temps réel après 1 seconde
            setTimeout(() => {
              startRealTimeDetection();
            }, 1000);
          }
        } catch (playErr) {
          console.error('❌ Play error:', playErr);
          // Réessayer après avoir attendu les métadonnées
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play()
                .then(() => {
                  console.log('✅ Video playing after metadata');
                  toast.success('📷 Caméra activée');
                  setTimeout(() => {
                    startRealTimeDetection();
                  }, 1000);
                })
                .catch(err => console.error('❌ Still cannot play:', err));
            };
          }
        }
      }, 300);
      
    } catch (error) {
      console.error('❌ Camera error:', error);
      setIsCameraOpen(false);
      
      if (error.name === 'NotAllowedError') {
        toast.error('🚫 Permission caméra refusée. Veuillez autoriser l\'accès à la caméra.');
      } else if (error.name === 'NotFoundError') {
        toast.error('❌ Aucune caméra détectée sur cet appareil.');
      } else {
        toast.error('❌ Impossible d\'accéder à la caméra: ' + error.message);
      }
    }
  };

  // Close camera
  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionInterval) {
      clearInterval(detectionInterval);
      setDetectionInterval(null);
    }
    setIsCameraOpen(false);
    setFaceDetectionMessage('');
    setFaceQualityStatus('');
  };

  // Real-time face detection for guidance
  const startRealTimeDetection = () => {
    if (!modelsLoaded || !videoRef.current) return;

    const detectFace = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
      
      // Vérifier que le video a des dimensions valides
      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        return;
      }

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceLandmarks();

        if (detection) {
          const box = detection.detection.box;
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;

          // Calculer la taille et position du visage
          const faceSize = Math.max(box.width, box.height);
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const videoCenterX = videoWidth / 2;
          const videoCenterY = videoHeight / 2;

          // Calculer les distances
          const offsetX = Math.abs(faceCenterX - videoCenterX);
          const offsetY = Math.abs(faceCenterY - videoCenterY);
          const isWellCentered = offsetX < videoWidth * 0.15 && offsetY < videoHeight * 0.15;

          // Évaluer la qualité
          if (faceSize < videoWidth * 0.2) {
            setFaceDetectionMessage('📏 Trop loin - Approchez-vous');
            setFaceQualityStatus('warning');
          } else if (faceSize > videoWidth * 0.6) {
            setFaceDetectionMessage('📏 Trop proche - Éloignez-vous');
            setFaceQualityStatus('warning');
          } else if (!isWellCentered) {
            setFaceDetectionMessage('🎯 Centrez votre visage');
            setFaceQualityStatus('warning');
          } else {
            setFaceDetectionMessage('✅ Parfait ! Capture automatique...');
            setFaceQualityStatus('good');
          }
        } else {
          setFaceDetectionMessage('👤 Aucun visage détecté');
          setFaceQualityStatus('error');
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
    };

    // Détecter toutes les 500ms
    const interval = setInterval(detectFace, 500);
    setDetectionInterval(interval);
  };

  // Capture facial photo and extract descriptor
  const captureFacialPhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Limiter la résolution pour réduire la taille
      const maxSize = 640;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);

      // Detect face and extract descriptor
      const detection = await faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        // Convert canvas to blob avec qualité réduite
        return new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            const file = new File([blob], 'facial-photo.jpg', { type: 'image/jpeg' });
            setFacialPhoto(file);
            setFacialPreview(canvas.toDataURL('image/jpeg', 0.5));
            setFaceDescriptor(Array.from(detection.descriptor));
            toast.success('✅ Visage capturé avec succès');
            closeCamera();
            
            // 🚀 AUTO-SUBMIT: Vérifier si le formulaire est complet
            setTimeout(() => {
              // Vérifier tous les champs requis
              const isFormValid = formData.nom?.trim() && 
                                  formData.prenom?.trim() && 
                                  formData.telephone?.trim() &&
                                  cinPhoto &&
                                  selectedZones.length > 0 &&
                                  cinExists === false &&
                                  isWithinAllowedPeriod;
              
              if (isFormValid) {
                console.log('✅ Formulaire complet - Déclenchement auto-soumission...');
                toast.info('⏱️ Création automatique de l\'agent en cours...');
                // Trigger form submit programmatically
                const form = document.querySelector('form');
                if (form) {
                  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                  form.dispatchEvent(submitEvent);
                }
              } else {
                console.log('⚠️ Formulaire incomplet - Attente des champs manquants');
                toast.warning('📝 Photo faciale capturée. Complétez le formulaire pour créer l\'agent.');
              }
            }, 1500);
            
            resolve();
          }, 'image/jpeg', 0.5);
        });
      } else {
        toast.error('Aucun visage détecté. Réessayez.');
        throw new Error('No face detected');
      }
    } catch (error) {
      console.error('Face capture error:', error);
      toast.error('Erreur lors de la capture du visage');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Vérifier si le CIN existe déjà
    if (cinExists === true) {
      toast.error('❌ Ce CIN existe déjà dans le système. Veuillez vérifier.');
      return;
    }

    // Vérifier la période autorisée
    if (!isWithinAllowedPeriod) {
      toast.error('❌ Création d\'agent non autorisée en dehors de la période autorisée');
      return;
    }
    
    // Vérifier la sélection de zones
    if (selectedZones.length === 0) {
      toast.error('❌ Veuillez sélectionner au moins une zone');
      return;
    }

    // Validation des champs
    if (!formData.nom || !formData.prenom || !formData.telephone) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (!cinPhoto) {
      toast.error('Veuillez télécharger la photo de la CIN');
      return;
    }

    if (!facialPhoto || !faceDescriptor) {
      toast.error('Veuillez capturer la photo faciale');
      return;
    }

    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('nom', formData.nom);
      formDataToSend.append('prenom', formData.prenom);
      formDataToSend.append('telephone', formData.telephone);
      formDataToSend.append('cin', formData.cin);
      formDataToSend.append('supervisorId', supervisorId);
      // 🗜️ Utiliser les versions compressées (base64) au lieu des File objects bruts
      formDataToSend.append('cinPhoto', cinPreview); // Version compressée
      formDataToSend.append('facialPhoto', facialPhoto); // Déjà compressée lors de la capture
      formDataToSend.append('faceDescriptor', JSON.stringify(faceDescriptor));
      formDataToSend.append('selectedZones', JSON.stringify(selectedZones));
      formDataToSend.append('eventId', currentEvent?.id);
      formDataToSend.append('autoAssign', 'true'); // Affectation automatique

      // Récupérer le token avec la même logique que api.js
      const accessToken = localStorage.getItem('accessToken');
      const token = localStorage.getItem('token');
      const checkInToken = localStorage.getItem('checkInToken');
      const authToken = accessToken || token || checkInToken;

      console.log('🔐 Agent creation auth:', {
        hasAccessToken: !!accessToken,
        hasToken: !!token,
        hasCheckInToken: !!checkInToken,
        selectedToken: authToken ? `${authToken.substring(0, 30)}...` : 'NONE'
      });

      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/supervisor/create-agent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formDataToSend
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`✅ Agent ${formData.prenom} ${formData.nom} créé avec succès et assigné aux zones!`);
        if (onSuccess) onSuccess(data.agent);
        resetForm();
        onClose();
      } else if (response.status === 409 && data.existingAgent) {
        // CIN existe déjà - rediriger vers login
        toast.error(`❌ ${data.message}`, { duration: 5000 });
        toast.info('Redirection vers la page de connexion...', { duration: 3000 });
        
        setTimeout(() => {
          resetForm();
          onClose();
          window.location.href = '/login';
        }, 3000);
      } else {
        toast.error(data.message || 'Erreur lors de la création de l\'agent');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Erreur réseau. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ nom: '', prenom: '', telephone: '', cin: '' });
    setCinPhoto(null);
    setCinPreview(null);
    setFacialPhoto(null);
    setFacialPreview(null);
    setFaceDescriptor(null);
    setSelectedZones([]);
    setAutoProcessing(false);
    setGoodQualityCount(0);
    setFaceQualityStatus('');
    setFaceDetectionMessage('');
    setCinExists(null);
    setCinExistingUser(null);
    closeCamera();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeCamera();
    };
  }, []);

  // Reset auto-processing when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAutoProcessing(false);
      setGoodQualityCount(0);
    } else {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FiUser className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Créer un Agent</h2>
              <p className="text-white/70 text-sm">Recrutement sur le terrain</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Event and Period Information */}
          {eventInfo && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FiCalendar className="text-blue-400" />
                Informations de l'événement
              </h3>
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <FiClock className={`${isWithinAllowedPeriod ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-white font-medium">{eventInfo.name}</span>
                </div>
                
                <div className="text-sm text-white/70 space-y-1">
                  <p>Début: {eventInfo.startDate.toLocaleString()}</p>
                  <p>Fin: {eventInfo.endDate.toLocaleString()}</p>
                  <p className="text-blue-300">
                    Création autorisée: {eventInfo.bufferMinutes < 60 ? `${eventInfo.bufferMinutes} min` : `${eventInfo.bufferMinutes / 60}h`} avant le début
                  </p>
                  <p>Période: {eventInfo.allowedStart.toLocaleString()} - {eventInfo.allowedEnd.toLocaleString()}</p>
                  <div className={`flex items-center gap-2 font-medium ${isWithinAllowedPeriod ? 'text-green-400' : 'text-red-400'}`}>
                    {isWithinAllowedPeriod ? <FiCheck size={16} /> : <FiAlertCircle size={16} />}
                    {isWithinAllowedPeriod ? 'Création d\'agent autorisée' : 'Création d\'agent non autorisée en dehors de la période'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Zone Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiMapPin className="text-green-400" />
              Affectation aux zones (Gérées par le superviseur) *
            </h3>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              {managedZones.length > 0 ? (
                <>
                  <p className="text-white/70 text-sm mb-3">
                    Vous gérez <span className="text-green-400 font-semibold">{managedZones.length}</span> zone{managedZones.length > 1 ? 's' : ''}. 
                    Sélectionnez une zone pour y affecter le nouvel agent :
                  </p>
                  
                  <div className="space-y-2">
                    {managedZones.map(zone => {
                      const isSelected = selectedZones.includes(zone.id);
                      const isDisabled = selectedZones.length > 0 && !isSelected;
                      
                      return (
                        <label 
                          key={zone.id} 
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            isDisabled 
                              ? 'opacity-40 cursor-not-allowed' 
                              : 'cursor-pointer hover:bg-white/5'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Remplacer la sélection (une seule zone)
                                setSelectedZones([zone.id]);
                              } else {
                                // Désélectionner
                                setSelectedZones([]);
                              }
                            }}
                            className={`w-4 h-4 text-primary-500 bg-white/10 border-white/20 rounded focus:ring-primary-500 focus:ring-2 ${
                              isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          />
                          <div className="flex-1">
                            <span className="text-white font-medium">{zone.name}</span>
                            <div className="text-sm text-white/60">
                              {zone.description} • Agents requis: {zone.requiredAgents}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  
                  {selectedZones.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-sm text-green-400 flex items-center gap-2">
                        <FiCheck size={16} />
                        Zone sélectionnée: {managedZones.find(z => z.id === selectedZones[0])?.name}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-3 text-yellow-400">
                  <FiAlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium mb-1">Aucune zone assignée à ce superviseur</p>
                    <p className="text-sm text-white/60">
                      Contactez un administrateur pour assigner des zones à votre compte superviseur.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiUser className="text-primary-400" />
              Informations personnelles
            </h3>

            {/* CIN Field - FIRST */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Numéro CIN * <span className="text-xs text-white/50">(Commencer par la CIN)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.cin}
                  onChange={(e) => setFormData(prev => ({ ...prev, cin: e.target.value.toUpperCase() }))}
                  className={`w-full px-4 py-3 pr-12 bg-white/10 border rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 ${
                    cinExists === true 
                      ? 'border-red-500 focus:ring-red-500' 
                      : cinExists === false 
                      ? 'border-green-500 focus:ring-green-500' 
                      : 'border-white/20 focus:ring-primary-500'
                  }`}
                  placeholder="A123456"
                  required
                  maxLength="8"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {cinCheckLoading && (
                    <FiLoader className="text-white/50 animate-spin" size={20} />
                  )}
                  {!cinCheckLoading && cinExists === true && (
                    <FiAlertCircle className="text-red-500" size={20} />
                  )}
                  {!cinCheckLoading && cinExists === false && (
                    <FiCheck className="text-green-500" size={20} />
                  )}
                </div>
              </div>
              {cinExists === true && cinExistingUser && (
                <div className="mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-300 text-sm flex items-center gap-2">
                    <FiAlertCircle size={16} />
                    <span className="font-semibold">CIN déjà enregistré!</span>
                  </p>
                  <p className="text-red-200 text-xs mt-1">
                    Agent: {cinExistingUser.firstName} {cinExistingUser.lastName} ({cinExistingUser.employeeId})
                  </p>
                  <p className="text-red-200 text-xs">
                    Rôle: {cinExistingUser.role}
                  </p>
                </div>
              )}
              {cinExists === false && formData.cin.length >= 3 && (
                <p className="mt-2 text-green-400 text-sm flex items-center gap-2">
                  <FiCheck size={16} />
                  CIN disponible
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Nom de famille"
                  required
                  disabled={!formData.cin || cinExists === true}
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Prénom"
                  required
                  disabled={!formData.cin || cinExists === true}
                />
              </div>
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Téléphone *
              </label>
              <div className="relative">
                <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+212 6XX XXX XXX"
                  required
                  disabled={!formData.cin || cinExists === true}
                />
              </div>
            </div>
          </div>

          {/* CIN Photo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiUpload className="text-yellow-400" />
              Photo de la CIN *
            </h3>

            {cinPreview ? (
              <div className="relative">
                <img
                  src={cinPreview}
                  alt="CIN Preview"
                  className="w-full h-48 object-cover rounded-xl border-2 border-white/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCinPhoto(null);
                    setCinPreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  <FiX size={18} />
                </button>
              </div>
            ) : (
              <label className="block w-full p-8 border-2 border-dashed border-white/30 rounded-xl hover:border-primary-500 transition-colors cursor-pointer bg-white/5">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCinUpload}
                  className="hidden"
                />
                <div className="text-center">
                  <FiUpload className="mx-auto text-white/50 mb-3" size={40} />
                  <p className="text-white/70 font-medium">
                    Cliquez pour télécharger la photo de la CIN
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    JPG, PNG (max. 10MB)
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Facial Photo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiCamera className="text-green-400" />
              Photo faciale (Reconnaissance) *
            </h3>

            {facialPreview ? (
              <div className="relative">
                <img
                  src={facialPreview}
                  alt="Facial Preview"
                  className="w-full h-64 object-cover rounded-xl border-2 border-green-500/50"
                />
                <div className="absolute top-2 left-2 bg-green-500 px-3 py-1 rounded-lg flex items-center gap-2">
                  <FiCheck size={16} className="text-white" />
                  <span className="text-white text-sm font-medium">Visage détecté</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFacialPhoto(null);
                    setFacialPreview(null);
                    setFaceDescriptor(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  <FiX size={18} />
                </button>
              </div>
            ) : isCameraOpen ? (
              <div className="relative bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Guide circulaire pour le positionnement du visage */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-48 h-48 rounded-full border-4 transition-all duration-300 ${
                    faceQualityStatus === 'good' 
                      ? 'border-green-500 shadow-lg shadow-green-500/50' 
                      : faceQualityStatus === 'warning'
                      ? 'border-yellow-500 shadow-lg shadow-yellow-500/50'
                      : 'border-red-500 shadow-lg shadow-red-500/50 animate-pulse'
                  }`}>
                    {/* Points de repère aux coins du cercle */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-white rounded-full"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>

                {/* Message de guidage en temps réel */}
                {faceDetectionMessage && (
                  <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg backdrop-blur-sm transition-all duration-300 ${
                    faceQualityStatus === 'good'
                      ? 'bg-green-500/90 text-white'
                      : faceQualityStatus === 'warning'
                      ? 'bg-yellow-500/90 text-white'
                      : 'bg-red-500/90 text-white'
                  }`}>
                    {faceDetectionMessage}
                  </div>
                )}

                {/* Instructions de positionnement */}
                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-xs text-white/90 space-y-1">
                  <div className="font-semibold mb-2 text-white">📋 Conseils:</div>
                  <div>✓ Regardez la caméra</div>
                  <div>✓ Bon éclairage</div>
                  <div>✓ Visage centré</div>
                  <div>✓ Distance moyenne</div>
                </div>
                
                {/* Boutons de contrôle */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                  <button
                    type="button"
                    onClick={captureFacialPhoto}
                    disabled={isProcessing || faceQualityStatus !== 'good'}
                    className={`px-6 py-3 font-semibold rounded-xl flex items-center gap-2 transition-all duration-300 ${
                      faceQualityStatus === 'good' && !isProcessing
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50 hover:scale-105'
                        : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <FiLoader className="animate-spin" size={20} />
                        Analyse...
                      </>
                    ) : (
                      <>
                        <FiCamera size={20} />
                        Capturer
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openCamera}
                disabled={!modelsLoaded}
                className={`w-full p-8 border-2 border-dashed rounded-xl transition-colors ${
                  modelsLoaded 
                    ? 'border-white/30 hover:border-green-500 bg-white/5 cursor-pointer'
                    : 'border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-60'
                }`}
              >
                <FiCamera className={`mx-auto mb-3 ${modelsLoaded ? 'text-white/50' : 'text-gray-500'}`} size={40} />
                <p className={`font-medium ${modelsLoaded ? 'text-white/70' : 'text-gray-400'}`}>
                  {modelsLoaded 
                    ? 'Ouvrir la caméra pour capturer le visage' 
                    : 'Chargement des modèles de reconnaissance...'}
                </p>
                <p className={`text-sm mt-1 ${modelsLoaded ? 'text-white/50' : 'text-gray-500'}`}>
                  {modelsLoaded 
                    ? 'La reconnaissance faciale sera automatique' 
                    : 'Veuillez patienter...'}
                </p>
                {!modelsLoaded && (
                  <div className="mt-3">
                    <FiLoader className="animate-spin mx-auto text-gray-400" size={24} />
                  </div>
                )}
              </button>
            )}
          </div>

          {/* Info Alert */}
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 flex items-start gap-3">
            <FiAlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-1">Information importante</p>
              <ul className="text-blue-300/80 space-y-1">
                <li>• L'agent créé sera automatiquement associé à votre compte responsable</li>
                <li>• Il pourra accéder à l'application avec son numéro de téléphone</li>
                <li>• Il sera automatiquement confirmé pour l'événement en cours</li>
                <li>• Il sera assigné aux zones sélectionnées</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.nom || !formData.prenom || !formData.telephone || !formData.cin || !cinPhoto || !facialPhoto || selectedZones.length === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <FiLoader className="animate-spin" size={20} />
                  Création...
                </>
              ) : (
                <>
                  <FiCheck size={20} />
                  Créer l'agent
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentCreationModal;
