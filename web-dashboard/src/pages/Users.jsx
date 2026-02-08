import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiFilter,
  FiUser, FiMail, FiPhone, FiMoreVertical, FiCamera,
  FiAward, FiShield, FiStar, FiCalendar, FiX, FiEye,
  FiUserCheck, FiAlertCircle, FiCheck, FiMapPin, FiCreditCard,
  FiArrowLeft, FiArrowRight, FiUpload, FiImage, FiFolder,
  FiList, FiGrid, FiUsers, FiChevronDown, FiChevronRight, FiChevronUp, FiLock,
  FiBell, FiFileText, FiClipboard, FiDownload, FiAlertTriangle, FiSave
} from 'react-icons/fi';
import { usersAPI, permissionsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import FaceVerification from '../components/FaceVerification';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { extractDescriptorFromBase64, loadModels } from '../services/faceRecognition';
import MiniMap from '../components/MiniMap';
import NotificationOverlay, { ValidationErrorsOverlay } from '../components/NotificationOverlay';
import DocumentUpload from '../components/DocumentUpload';

const UserModal = ({ isOpen, onClose, user, onSave }) => {
  const [formData, setFormData] = useState({
    cin: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    whatsappNumber: '',
    role: 'agent',
    status: 'active',
    supervisorId: '',
    // Informations personnelles
    dateOfBirth: '',
    address: '',
    // Informations physiques
    height: '',
    weight: '',
    // Informations professionnelles
    hireDate: '',
    diploma: '',
    diplomaLevel: '',
    securityCard: '',
    securityCardExpiry: '',
    experienceYears: 0,
    specializations: [],
    languages: [],
    // Contact d'urgence
    emergencyContact: '',
    emergencyPhone: '',
    // Scores
    punctualityScore: 100,
    reliabilityScore: 100,
    professionalismScore: 100
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showCamera, setShowCamera] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [facialDescriptor, setFacialDescriptor] = useState(null);
  const [facialPhoto, setFacialPhoto] = useState(null);
  const [facialVectorUpdatedAt, setFacialVectorUpdatedAt] = useState(null);
  const [addressCoordinates, setAddressCoordinates] = useState({ latitude: null, longitude: null });
  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // États pour les notifications animées
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [savedUserData, setSavedUserData] = useState(null);

  // État pour le mode de capture faciale (camera ou upload)
  const [facialCaptureMode, setFacialCaptureMode] = useState('camera'); // 'camera' ou 'upload'
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const fileInputRef = useRef(null);

  // État pour les documents
  const [userDocuments, setUserDocuments] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);

  // État pour les permissions
  const [allPermissions, setAllPermissions] = useState({ permissions: [], grouped: {} });
  const [roleDefaultPermissions, setRoleDefaultPermissions] = useState({});
  const [userCustomPermissions, setUserCustomPermissions] = useState({ granted: [], denied: [] });
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // États pour la vérification d'unicité en temps réel
  const [uniquenessChecks, setUniquenessChecks] = useState({
    email: { checking: false, isUnique: true, message: '' },
    cin: { checking: false, isUnique: true, message: '' },
    phone: { checking: false, isUnique: true, message: '' }
  });
  const debounceTimers = useRef({});

  // Charger la liste des superviseurs
  useEffect(() => {
    const fetchSupervisors = async () => {
      setLoadingSupervisors(true);
      try {
        const response = await usersAPI.getSupervisors();
        setSupervisors(response.data.data || []);
      } catch (error) {
        console.error('Erreur chargement superviseurs:', error);
      } finally {
        setLoadingSupervisors(false);
      }
    };
    if (isOpen) {
      fetchSupervisors();
    }
  }, [isOpen]);

  // Charger les permissions disponibles et les permissions par rôle
  useEffect(() => {
    const fetchPermissions = async () => {
      setLoadingPermissions(true);
      try {
        const [permissionsRes, rolesPermissionsRes] = await Promise.all([
          permissionsAPI.getAllPermissions(),
          permissionsAPI.getAllRolesPermissions()
        ]);
        setAllPermissions(permissionsRes.data.data || { permissions: [], grouped: {} });
        setRoleDefaultPermissions(rolesPermissionsRes.data.data || {});
      } catch (error) {
        console.error('Erreur chargement permissions:', error);
        // Si les permissions ne sont pas initialisées, initialiser
        if (error.response?.status === 404) {
          try {
            await permissionsAPI.initialize();
            const [permissionsRes, rolesPermissionsRes] = await Promise.all([
              permissionsAPI.getAllPermissions(),
              permissionsAPI.getAllRolesPermissions()
            ]);
            setAllPermissions(permissionsRes.data.data || { permissions: [], grouped: {} });
            setRoleDefaultPermissions(rolesPermissionsRes.data.data || {});
          } catch (initError) {
            console.error('Erreur initialisation permissions:', initError);
          }
        }
      } finally {
        setLoadingPermissions(false);
      }
    };
    if (isOpen) {
      fetchPermissions();
      
      // Réinitialiser les notifications à chaque ouverture
      setShowSuccessNotification(false);
      setShowErrorNotification(false);
      setValidationErrors([]);
      setSavedUserData(null);
    }
  }, [isOpen]);

  // Charger les permissions personnalisées de l'utilisateur lors de l'édition
  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (user?.id) {
        try {
          const response = await permissionsAPI.getUserPermissions(user.id);
          setUserCustomPermissions({
            granted: response.data.data.customPermissions?.granted || [],
            denied: response.data.data.customPermissions?.denied || []
          });
        } catch (error) {
          console.error('Erreur chargement permissions utilisateur:', error);
          setUserCustomPermissions({ granted: [], denied: [] });
        }
      } else {
        setUserCustomPermissions({ granted: [], denied: [] });
      }
    };
    if (isOpen && user) {
      fetchUserPermissions();
    }
  }, [isOpen, user]);

  const specializationOptions = [
    'Incendie', 'Secourisme', 'Cynophile', 'Sûreté aéroportuaire',
    'Protection rapprochée', 'Vidéosurveillance', 'Rondier', 'Accueil'
  ];

  const languageOptions = ['Français', 'Anglais', 'Arabe', 'Espagnol', 'Portugais', 'Allemand'];

  useEffect(() => {
    if (user) {
      setFormData({
        cin: user.cin || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: '',
        phone: user.phone || '',
        whatsappNumber: user.whatsappNumber || '',
        role: user.role || 'agent',
        status: user.status || 'active',
        supervisorId: user.supervisorId || '',
        dateOfBirth: user.dateOfBirth || '',
        address: user.address || '',
        height: user.height || '',
        weight: user.weight || '',
        hireDate: user.hireDate || '',
        diploma: user.diploma || '',
        diplomaLevel: user.diplomaLevel || '',
        securityCard: user.securityCard || '',
        securityCardExpiry: user.securityCardExpiry || '',
        experienceYears: user.experienceYears || 0,
        specializations: user.specializations || [],
        languages: user.languages || [],
        emergencyContact: user.emergencyContact || '',
        emergencyPhone: user.emergencyPhone || '',
        punctualityScore: user.punctualityScore || 100,
        reliabilityScore: user.reliabilityScore || 100,
        professionalismScore: user.professionalismScore || 100
      });
      setProfilePhoto(user.profilePhoto);

      // Charger les coordonnées de l'adresse si existantes
      if (user.currentLatitude && user.currentLongitude) {
        setAddressCoordinates({
          latitude: parseFloat(user.currentLatitude),
          longitude: parseFloat(user.currentLongitude)
        });
      } else {
        setAddressCoordinates({ latitude: null, longitude: null });
      }

      // Charger le vecteur facial si existant
      const loadFacialVector = async () => {
        try {
          const response = await usersAPI.getFacialVector(user.id);
          if (response.data.data?.facialVector) {
            setFacialDescriptor(response.data.data.facialVector);
            setFacialVectorUpdatedAt(response.data.data.updatedAt);
          }
        } catch (error) {
          // Pas de vecteur facial, c'est normal
        }
      };
      loadFacialVector();

      // Charger les documents existants si utilisateur
      if (user.documents && user.documents.length > 0) {
        setExistingDocuments(user.documents);
      } else {
        setExistingDocuments([]);
      }
      setUserDocuments([]);
    } else {
      setFormData({
        cin: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        whatsappNumber: '',
        role: 'agent',
        status: 'active',
        supervisorId: '',
        dateOfBirth: '',
        address: '',
        height: '',
        weight: '',
        hireDate: '',
        diploma: '',
        diplomaLevel: '',
        securityCard: '',
        securityCardExpiry: '',
        experienceYears: 0,
        specializations: [],
        languages: [],
        emergencyContact: '',
        emergencyPhone: '',
        punctualityScore: 100,
        reliabilityScore: 100,
        professionalismScore: 100
      });
      setProfilePhoto(null);
      setFacialDescriptor(null);
      setFacialPhoto(null);
      setFacialVectorUpdatedAt(null);
      setAddressCoordinates({ latitude: null, longitude: null });
      setUserDocuments([]);
      setExistingDocuments([]);
    }
    setActiveTab('basic');
    
    // Réinitialiser les notifications à chaque ouverture du modal
    setShowSuccessNotification(false);
    setShowErrorNotification(false);
    setValidationErrors([]);
    setSavedUserData(null);
  }, [user]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast.error('Impossible d\'accéder à la caméra');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    setProfilePhoto(photoData);
    stopCamera();
  };

  // Fonction pour gérer l'upload de photo pour reconnaissance faciale
  const handleFacialPhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setValidationErrors(['Veuillez sélectionner un fichier image (JPG, PNG, etc.)']);
      setShowErrorNotification(true);
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setValidationErrors(['L\'image ne doit pas dépasser 5 Mo']);
      setShowErrorNotification(true);
      return;
    }

    setIsProcessingUpload(true);

    try {
      // Charger les modèles si nécessaire
      await loadModels();

      // Lire le fichier en base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result;

        try {
          // Extraire le descripteur facial
          const result = await extractDescriptorFromBase64(base64Image);

          if (result && result.descriptor) {
            setFacialDescriptor(result.descriptor);
            setFacialPhoto(base64Image);
            if (!profilePhoto) {
              setProfilePhoto(base64Image);
            }

            // Si utilisateur existant, sauvegarder directement (sans notification pour éviter confusion)
            if (user?.id) {
              try {
                await usersAPI.updateFacialVector(user.id, {
                  facialVector: result.descriptor,
                  profilePhoto: base64Image
                });
                setFacialVectorUpdatedAt(new Date().toISOString());
                // Ne pas afficher de notification ici pour éviter confusion avec autres actions
                // toast.success('Photo mise à jour', { autoClose: 1500 });
              } catch (error) {
                setValidationErrors(['Erreur lors de l\'enregistrement du vecteur facial']);
                setShowErrorNotification(true);
              }
            } else {
              // Nouvel utilisateur - sauvegarder automatiquement
              console.log('Auto-save après upload photo...');
              await saveUser(result.descriptor, base64Image);
            }
          } else {
            setValidationErrors([
              'Aucun visage détecté dans l\'image',
              'Assurez-vous que le visage est bien visible et éclairé',
              'Essayez avec une autre photo ou utilisez la caméra'
            ]);
            setShowErrorNotification(true);
          }
        } catch (error) {
          console.error('Erreur extraction:', error);
          setValidationErrors(['Erreur lors de l\'analyse de l\'image']);
          setShowErrorNotification(true);
        } finally {
          setIsProcessingUpload(false);
        }
      };

      reader.onerror = () => {
        setValidationErrors(['Erreur lors de la lecture du fichier']);
        setShowErrorNotification(true);
        setIsProcessingUpload(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erreur chargement modèles:', error);
      setValidationErrors(['Erreur lors du chargement des modèles de reconnaissance']);
      setShowErrorNotification(true);
      setIsProcessingUpload(false);
    }

    // Reset input file pour permettre de resélectionner le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fonction pour valider les champs obligatoires
  const validateForm = () => {
    const errors = [];

    // Champs obligatoires pour tous
    if (!formData.firstName?.trim()) errors.push('Le prénom est obligatoire');
    if (!formData.lastName?.trim()) errors.push('Le nom est obligatoire');
    if (!formData.email?.trim()) errors.push('L\'email est obligatoire');

    // CIN obligatoire pour agents et superviseurs (pas pour admin et user)
    if (['agent', 'supervisor'].includes(formData.role) && !formData.cin?.trim()) {
      errors.push('Le numéro CIN est obligatoire pour les agents et responsables');
    }

    // Superviseur obligatoire pour les agents
    if (formData.role === 'agent' && !formData.supervisorId) {
      errors.push('Un agent doit avoir un responsable assigné');
    }

    // Mot de passe obligatoire pour admin et user (lors de la création)
    if (['admin', 'user'].includes(formData.role) && !user && !formData.password?.trim()) {
      errors.push('Le mot de passe est obligatoire');
    }

    // Vérification d'unicité
    if (!uniquenessChecks.email.isUnique) {
      errors.push('Cet email est déjà utilisé par un autre utilisateur');
    }
    if (!uniquenessChecks.cin.isUnique) {
      errors.push('Ce numéro CIN est déjà utilisé par un autre utilisateur');
    }
    if (!uniquenessChecks.phone.isUnique) {
      errors.push('Ce numéro de téléphone est déjà utilisé par un autre utilisateur');
    }

    // Vérification en cours
    if (uniquenessChecks.email.checking || uniquenessChecks.cin.checking || uniquenessChecks.phone.checking) {
      errors.push('Vérification des champs en cours, veuillez patienter...');
    }

    return errors;
  };

  // Fonction pour enregistrer l'utilisateur (utilisée par handleSubmit et auto-save)
  const saveUser = async (descriptor = null, photo = null) => {
    console.log('💾 saveUser called - SOURCE:', new Error().stack);
    
    // Protection contre les doubles clics
    if (loading) {
      console.log('⚠️ Sauvegarde déjà en cours, ignoré');
      return false;
    }
    
    // Valider le formulaire avant de sauvegarder
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrorNotification(true);
      return false;
    }

    setLoading(true);

    try {
      const data = { ...formData };
      if (!data.password) delete data.password;
      if (profilePhoto || photo) data.profilePhoto = profilePhoto || photo;

      // Ajouter les coordonnées de l'adresse si disponibles
      if (addressCoordinates.latitude && addressCoordinates.longitude) {
        data.currentLatitude = addressCoordinates.latitude;
        data.currentLongitude = addressCoordinates.longitude;
      }

      // Ajouter le vecteur facial si capturé (pour agents et responsables)
      if (descriptor || facialDescriptor) {
        data.facialVector = descriptor || facialDescriptor;
      }
      if (photo || facialPhoto) {
        data.facialPhoto = photo || facialPhoto;
      }

      // Ajouter les documents si uploadés (pour nouveaux utilisateurs)
      if (!user && userDocuments.length > 0) {
        data.documents = userDocuments.map(doc => ({
          documentType: doc.documentType,
          customName: doc.customName,
          originalFilename: doc.originalFilename,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          fileExtension: doc.fileExtension,
          fileContent: doc.fileContent,
          description: doc.description,
          expiryDate: doc.expiryDate
        }));
      }

      // Convert empty strings to null for optional fields
      Object.keys(data).forEach(key => {
        if (data[key] === '') data[key] = null;
      });

      // Debug: voir les données envoyées
      console.log('Données envoyées:', {
        ...data,
        facialVector: data.facialVector ? `[${data.facialVector.length} points]` : null,
        facialPhoto: data.facialPhoto ? '[photo base64]' : null,
        profilePhoto: data.profilePhoto ? '[photo base64]' : null
      });

      let userId = user?.id;

      if (user) {
        await usersAPI.update(user.id, data);
      } else {
        const createResponse = await usersAPI.create(data);
        userId = createResponse.data.data?.id;
      }

      // Sauvegarder les permissions personnalisées si des modifications ont été faites
      if (userId && (userCustomPermissions.granted.length > 0 || userCustomPermissions.denied.length > 0)) {
        try {
          await permissionsAPI.updateUserPermissions(userId, {
            grantedPermissions: userCustomPermissions.granted,
            deniedPermissions: userCustomPermissions.denied
          });
        } catch (permError) {
          console.error('Erreur sauvegarde permissions:', permError);
          // Ne pas bloquer la création de l'utilisateur si les permissions échouent
        }
      }

      // Afficher notification de succès
      setSavedUserData({
        name: `${data.firstName} ${data.lastName}`,
        photo: data.profilePhoto || data.facialPhoto
      });
      setShowSuccessNotification(true);

      // 1. Sauvegarder ✓ (déjà fait ci-dessus)
      // 2. Mise à jour + Actualisation
      setTimeout(() => {
        onSave(); // Recharge la liste des utilisateurs
        onClose(); // Ferme le modal
        
        // 3. Actualiser la page complète après 500ms
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }, 2000);

      return true;
    } catch (error) {
      console.error('❌ Erreur création utilisateur:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      setLoading(false); // Arrêter le loading immédiatement

      // Extraire les erreurs du serveur
      const serverData = error.response?.data;
      let errorMessages = [];
      console.log('📋 Server data détaillé:', JSON.stringify(serverData, null, 2));

      if (serverData) {
        // Si c'est un tableau d'erreurs
        if (Array.isArray(serverData.errors)) {
          errorMessages = serverData.errors.map(e => e.message || e.msg || e);
        }
        // Si c'est un objet avec des champs en erreur
        else if (serverData.errors && typeof serverData.errors === 'object') {
          errorMessages = Object.values(serverData.errors).flat();
        }
        // Si c'est un message simple
        else if (serverData.message) {
          errorMessages = [serverData.message];
        }
        // Si c'est une erreur de validation Sequelize
        else if (serverData.error) {
          errorMessages = [serverData.error];
        }
      }

      // Fallback si aucune erreur trouvée
      if (errorMessages.length === 0) {
        errorMessages = ['Erreur lors de l\'enregistrement. Vérifiez vos données.'];
      }

      console.log('🚨 Messages d\'erreur à afficher:', errorMessages);
      setValidationErrors(errorMessages);
      setShowErrorNotification(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveUser();
  };

  const toggleSpecialization = (spec) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
  };

  const toggleLanguage = (lang) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  // Fonctions de vérification d'unicité en temps réel
  const checkUniqueness = async (field, value) => {
    if (!value || value.trim() === '') {
      setUniquenessChecks(prev => ({
        ...prev,
        [field]: { checking: false, isUnique: true, message: '' }
      }));
      return;
    }

    // Clear previous timer
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }

    // Set checking state
    setUniquenessChecks(prev => ({
      ...prev,
      [field]: { ...prev[field], checking: true }
    }));

    // Debounce 500ms
    debounceTimers.current[field] = setTimeout(async () => {
      try {
        const excludeId = user?.id;
        let response;

        switch (field) {
          case 'email':
            response = await usersAPI.checkEmailUnique(value, excludeId);
            break;
          case 'cin':
            response = await usersAPI.checkCinUnique(value, excludeId);
            break;
          case 'phone':
            response = await usersAPI.checkPhoneUnique(value, excludeId);
            break;
          default:
            return;
        }

        const isUnique = response.data.data?.isUnique;
        const fieldLabels = { email: 'email', cin: 'CIN', phone: 'téléphone' };

        setUniquenessChecks(prev => ({
          ...prev,
          [field]: {
            checking: false,
            isUnique,
            message: isUnique ? '' : `Ce ${fieldLabels[field]} est déjà utilisé`
          }
        }));
      } catch (error) {
        console.error(`Erreur vérification ${field}:`, error);
        setUniquenessChecks(prev => ({
          ...prev,
          [field]: { checking: false, isUnique: true, message: '' }
        }));
      }
    }, 500);
  };

  // Handler pour les champs avec vérification d'unicité
  const handleUniqueFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    checkUniqueness(field, value);
  };

  // Fonctions pour la gestion des permissions
  const toggleGrantedPermission = (code) => {
    setUserCustomPermissions(prev => {
      const isGranted = prev.granted.includes(code);
      const isDenied = prev.denied.includes(code);

      if (isGranted) {
        // Retirer de granted
        return { ...prev, granted: prev.granted.filter(c => c !== code) };
      } else {
        // Ajouter à granted et retirer de denied si présent
        return {
          granted: [...prev.granted, code],
          denied: prev.denied.filter(c => c !== code)
        };
      }
    });
  };

  const toggleDeniedPermission = (code) => {
    setUserCustomPermissions(prev => {
      const isDenied = prev.denied.includes(code);

      if (isDenied) {
        // Retirer de denied
        return { ...prev, denied: prev.denied.filter(c => c !== code) };
      } else {
        // Ajouter à denied et retirer de granted si présent
        return {
          denied: [...prev.denied, code],
          granted: prev.granted.filter(c => c !== code)
        };
      }
    });
  };

  // Calculer les permissions effectives pour prévisualisation
  const getEffectivePermissions = () => {
    const rolePerms = roleDefaultPermissions[formData.role] || [];
    const effective = [...new Set([...rolePerms, ...userCustomPermissions.granted])]
      .filter(code => !userCustomPermissions.denied.includes(code));
    return effective;
  };

  // Obtenir le statut d'une permission (role, granted, denied, none)
  const getPermissionStatus = (code) => {
    if (userCustomPermissions.denied.includes(code)) return 'denied';
    if (userCustomPermissions.granted.includes(code)) return 'granted';
    if ((roleDefaultPermissions[formData.role] || []).includes(code)) return 'role';
    return 'none';
  };

  const calculateBMI = () => {
    if (formData.height && formData.weight) {
      const heightM = formData.height / 100;
      return (formData.weight / (heightM * heightM)).toFixed(1);
    }
    return null;
  };

  const getBMIStatus = (bmi) => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: 'Insuffisant', color: 'text-yellow-600' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-600' };
    if (bmi < 30) return { label: 'Surpoids', color: 'text-orange-600' };
    return { label: 'Obésité', color: 'text-red-600' };
  };

  if (!isOpen) return null;

  // Onglets selon le rôle - pas de reconnaissance faciale pour admin et user
  const baseTabs = [
    { id: 'basic', label: 'Informations', icon: FiUser, shortLabel: '1' },
    { id: 'professional', label: 'Professionnel', icon: FiShield, shortLabel: '2' },
    { id: 'physical', label: 'Physique', icon: FiAward, shortLabel: '3' },
    { id: 'documents', label: 'Documents', icon: FiFolder, shortLabel: '4' },
    { id: 'permissions', label: 'Permissions', icon: FiLock, shortLabel: '5' },
  ];

  // Ajouter l'onglet reconnaissance faciale uniquement pour agents et superviseurs
  const tabs = ['agent', 'supervisor'].includes(formData.role)
    ? [...baseTabs, { id: 'facial', label: 'Reconnaissance', icon: FiCamera, shortLabel: '6' }]
    : baseTabs;

  // Trouver l'index de l'onglet actif
  const currentTabIndex = tabs.findIndex(t => t.id === activeTab);

  // Validation par étape
  const isStepValid = (stepId) => {
    switch (stepId) {
      case 'basic':
        const hasBasicInfo = formData.firstName?.trim() && formData.lastName?.trim() && formData.email?.trim();
        const hasCin = formData.role === 'admin' || formData.cin?.trim();
        const hasSupervisor = formData.role !== 'agent' || formData.supervisorId;
        return hasBasicInfo && hasCin && hasSupervisor;
      case 'professional':
        return true; // Optionnel
      case 'physical':
        return true; // Optionnel
      case 'documents':
        return true; // Optionnel - les documents ne sont pas obligatoires
      case 'permissions':
        return true; // Optionnel - les permissions par défaut du rôle sont utilisées si aucune modification
      case 'facial':
        return !!facialDescriptor; // Doit avoir capturé le visage
      default:
        return true;
    }
  };

  // Aller à l'étape suivante
  const goToNextStep = () => {
    if (currentTabIndex < tabs.length - 1) {
      // Valider l'étape actuelle avant de passer à la suivante
      if (!isStepValid(activeTab)) {
        if (activeTab === 'basic') {
          const errors = validateForm();
          if (errors.length > 0) {
            setValidationErrors(errors);
            setShowErrorNotification(true);
            return;
          }
        }
      }
      setActiveTab(tabs[currentTabIndex + 1].id);
    }
  };

  // Aller à l'étape précédente
  const goToPrevStep = () => {
    if (currentTabIndex > 0) {
      setActiveTab(tabs[currentTabIndex - 1].id);
    }
  };

  // Calculer le pourcentage de progression
  const progressPercent = ((currentTabIndex + 1) / tabs.length) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header amélioré */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <p className="text-primary-100 text-sm mt-1">
                {formData.role === 'agent' ? 'Agent de sécurité' :
                 formData.role === 'supervisor' ? 'Responsable' :
                 formData.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                {formData.firstName && ` - ${formData.firstName} ${formData.lastName}`}
              </p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
              <FiX size={24} />
            </button>
          </div>

          {/* Barre de progression */}
          <div className="relative">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {tabs.map((tab, index) => (
                <div
                  key={tab.id}
                  className={`flex flex-col items-center ${index <= currentTabIndex ? 'text-white' : 'text-white/50'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    index < currentTabIndex
                      ? 'bg-green-400 text-green-900'
                      : index === currentTabIndex
                        ? 'bg-white text-primary-600'
                        : 'bg-white/20'
                  }`}>
                    {index < currentTabIndex ? <FiCheck size={16} /> : tab.shortLabel}
                  </div>
                  <span className="text-xs mt-1 hidden sm:block">{tab.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Indicateur d'étape mobile */}
        <div className="sm:hidden bg-gray-50 px-4 py-2 border-b flex items-center justify-center">
          <span className="text-sm text-gray-600">
            Étape {currentTabIndex + 1} sur {tabs.length}: <strong>{tabs[currentTabIndex]?.label}</strong>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">ID Employé</label>
                  {user ? (
                    <div className="input bg-gray-100 text-gray-700 font-mono">
                      {user.employeeId}
                    </div>
                  ) : (
                    <div className="input bg-gray-50 text-gray-500 font-mono flex items-center">
                      <span className="text-primary-600 font-semibold">
                        {formData.role === 'agent' ? 'AGT' :
                         formData.role === 'supervisor' ? 'RES' :
                         formData.role === 'admin' ? 'ADM' : 'UTI'}
                      </span>
                      <span className="text-gray-400">XXXXX</span>
                      <span className="ml-2 text-xs text-gray-400">(auto)</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Généré automatiquement
                  </p>
                </div>
                <div>
                  <label className="label flex items-center">
                    <FiCreditCard className="mr-1 text-primary-600" size={14} />
                    CIN {['agent', 'supervisor'].includes(formData.role) ? '*' : ''}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.cin}
                      onChange={(e) => handleUniqueFieldChange('cin', e.target.value.toUpperCase())}
                      className={`input font-mono tracking-wider pr-10 ${
                        !uniquenessChecks.cin.isUnique ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                      placeholder="AB123456"
                      required={['agent', 'supervisor'].includes(formData.role)}
                    />
                    {uniquenessChecks.cin.checking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!uniquenessChecks.cin.checking && formData.cin && uniquenessChecks.cin.isUnique && (
                      <FiCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                    )}
                    {!uniquenessChecks.cin.checking && !uniquenessChecks.cin.isUnique && (
                      <FiAlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                    )}
                  </div>
                  {!uniquenessChecks.cin.isUnique && (
                    <p className="text-xs text-red-500 mt-1 flex items-center">
                      <FiAlertCircle className="mr-1" />
                      {uniquenessChecks.cin.message}
                    </p>
                  )}
                  {['agent', 'supervisor'].includes(formData.role) && uniquenessChecks.cin.isUnique && (
                    <p className="text-xs text-blue-600 mt-1">
                      Le mot de passe sera le CIN
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Rôle *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({ ...formData, role: newRole, supervisorId: newRole !== 'agent' ? '' : formData.supervisorId });
                      // Si on passe à admin/user et qu'on est sur l'onglet facial, revenir à basic
                      if (['admin', 'user'].includes(newRole) && activeTab === 'facial') {
                        setActiveTab('basic');
                      }
                    }}
                    className="input"
                  >
                    <option value="agent">Agent de sécurité</option>
                    <option value="supervisor">Responsable / Superviseur</option>
                    <option value="admin">Administrateur</option>
                    <option value="user">Utilisateur</option>
                  </select>
                </div>
              </div>

              {/* Sélection du responsable - obligatoire pour les agents */}
              {formData.role === 'agent' && (
                <div>
                  <label className="label flex items-center">
                    <FiUserCheck className="mr-2 text-primary-600" />
                    Responsable / Superviseur *
                  </label>
                  <select
                    value={formData.supervisorId}
                    onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                    className={`input ${!formData.supervisorId ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                  >
                    <option value="">-- Sélectionner un responsable --</option>
                    {loadingSupervisors ? (
                      <option disabled>Chargement...</option>
                    ) : (
                      supervisors.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.firstName} {sup.lastName} ({sup.role === 'admin' ? 'Admin' : 'Superviseur'}) - {sup.agentCount || 0} agent(s)
                        </option>
                      ))
                    )}
                  </select>
                  {!formData.supervisorId && (
                    <p className="text-xs text-red-500 mt-1 flex items-center">
                      <FiAlertCircle className="mr-1" />
                      Un agent doit obligatoirement avoir un responsable assigné
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prénom *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleUniqueFieldChange('email', e.target.value)}
                      className={`input pr-10 ${
                        !uniquenessChecks.email.isUnique ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                      required
                    />
                    {uniquenessChecks.email.checking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!uniquenessChecks.email.checking && formData.email && uniquenessChecks.email.isUnique && (
                      <FiCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                    )}
                    {!uniquenessChecks.email.checking && !uniquenessChecks.email.isUnique && (
                      <FiAlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                    )}
                  </div>
                  {!uniquenessChecks.email.isUnique && (
                    <p className="text-xs text-red-500 mt-1 flex items-center">
                      <FiAlertCircle className="mr-1" />
                      {uniquenessChecks.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Date de naissance</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Mot de passe pour les admins et utilisateurs */}
              {!user && ['admin', 'user'].includes(formData.role) && (
                <div>
                  <label className="label">Mot de passe *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input"
                    placeholder="Min. 8 caractères"
                    required
                  />
                </div>
              )}

              {/* Info mot de passe = CIN pour agents/superviseurs */}
              {!user && ['agent', 'supervisor'].includes(formData.role) && formData.cin && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-700 flex items-center">
                    <FiCreditCard className="mr-2" />
                    <span>
                      Le mot de passe de connexion sera: <strong className="font-mono">{formData.cin}</strong>
                    </span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Téléphone principal *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleUniqueFieldChange('phone', e.target.value)}
                      className={`input pr-10 ${
                        !uniquenessChecks.phone.isUnique ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                      placeholder="+33 6 00 00 00 00"
                      required
                    />
                    {uniquenessChecks.phone.checking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!uniquenessChecks.phone.checking && formData.phone && uniquenessChecks.phone.isUnique && (
                      <FiCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                    )}
                    {!uniquenessChecks.phone.checking && !uniquenessChecks.phone.isUnique && (
                      <FiAlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                    )}
                  </div>
                  {!uniquenessChecks.phone.isUnique && (
                    <p className="text-xs text-red-500 mt-1 flex items-center">
                      <FiAlertCircle className="mr-1" />
                      {uniquenessChecks.phone.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">WhatsApp / Secondaire</label>
                  <input
                    type="tel"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    className="input"
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
              </div>

              {/* Adresse avec autocomplétion et mini carte */}
              <div className="space-y-3">
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(address) => setFormData({ ...formData, address })}
                  onCoordinatesChange={(coords) => {
                    if (coords) {
                      setAddressCoordinates({
                        latitude: coords.latitude,
                        longitude: coords.longitude
                      });
                      setFormData(prev => ({
                        ...prev,
                        address: coords.address || prev.address
                      }));
                    } else {
                      setAddressCoordinates({ latitude: null, longitude: null });
                    }
                  }}
                  label="Adresse"
                  placeholder="Tapez une adresse pour rechercher..."
                  initialCoordinates={addressCoordinates.latitude ? addressCoordinates : null}
                />

                {/* Mini carte */}
                <MiniMap
                  latitude={addressCoordinates.latitude}
                  longitude={addressCoordinates.longitude}
                  geoRadius={0}
                  height="180px"
                  draggable={true}
                  onPositionChange={(pos) => {
                    console.log('🗺️ onPositionChange called:', pos, '- NO AUTO-SAVE');
                    setAddressCoordinates({
                      latitude: pos.latitude,
                      longitude: pos.longitude
                    });
                  }}
                />

                {/* Info coordonnées */}
                {addressCoordinates.latitude && addressCoordinates.longitude && (
                  <div className="flex items-center text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                    <FiMapPin className="mr-2 text-green-500" />
                    <span>
                      Position enregistrée: {addressCoordinates.latitude.toFixed(6)}, {addressCoordinates.longitude.toFixed(6)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact d'urgence</label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    className="input"
                    placeholder="Nom du contact"
                  />
                </div>
                <div>
                  <label className="label">Téléphone d'urgence</label>
                  <input
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    className="input"
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
              </div>

              {user && (
                <div>
                  <label className="label">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input"
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Professional Tab */}
          {activeTab === 'professional' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date d'embauche</label>
                  <input
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Années d'expérience</label>
                  <input
                    type="number"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                    className="input"
                    min="0"
                    max="50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Diplôme / Certification</label>
                  <input
                    type="text"
                    value={formData.diploma}
                    onChange={(e) => setFormData({ ...formData, diploma: e.target.value })}
                    className="input"
                    placeholder="Ex: CQP APS, SSIAP..."
                  />
                </div>
                <div>
                  <label className="label">Niveau de diplôme</label>
                  <select
                    value={formData.diplomaLevel}
                    onChange={(e) => setFormData({ ...formData, diplomaLevel: e.target.value })}
                    className="input"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="cap">CAP / BEP</option>
                    <option value="bac">Baccalauréat</option>
                    <option value="bac+2">Bac+2 (BTS, DUT)</option>
                    <option value="bac+3">Bac+3 (Licence)</option>
                    <option value="bac+5">Bac+5 (Master)</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">N° Carte professionnelle</label>
                  <input
                    type="text"
                    value={formData.securityCard}
                    onChange={(e) => setFormData({ ...formData, securityCard: e.target.value })}
                    className="input"
                    placeholder="CAR-XXXXX-XXXXX"
                  />
                </div>
                <div>
                  <label className="label">Expiration carte</label>
                  <input
                    type="date"
                    value={formData.securityCardExpiry}
                    onChange={(e) => setFormData({ ...formData, securityCardExpiry: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Spécialisations</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {specializationOptions.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpecialization(spec)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        formData.specializations.includes(spec)
                          ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Langues parlées</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {languageOptions.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        formData.languages.includes(lang)
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Physical Tab */}
          {activeTab === 'physical' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="label">Taille (cm)</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || '' })}
                    className="input"
                    placeholder="175"
                    min="100"
                    max="250"
                  />
                </div>
                <div>
                  <label className="label">Poids (kg)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || '' })}
                    className="input"
                    placeholder="75"
                    min="30"
                    max="300"
                  />
                </div>
              </div>

              {/* BMI Calculator */}
              {formData.height && formData.weight && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-3">Indice de Masse Corporelle (IMC)</h4>
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl font-bold text-primary-600">
                      {calculateBMI()}
                    </div>
                    <div>
                      <span className={`font-medium ${getBMIStatus(calculateBMI())?.color}`}>
                        {getBMIStatus(calculateBMI())?.label}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        IMC idéal pour le gardiennage: 20-25
                      </p>
                    </div>
                  </div>
                  {/* BMI Scale */}
                  <div className="mt-3">
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div className="w-1/4 bg-yellow-400" title="< 18.5 Insuffisant" />
                      <div className="w-1/4 bg-green-500" title="18.5-25 Normal" />
                      <div className="w-1/4 bg-orange-400" title="25-30 Surpoids" />
                      <div className="w-1/4 bg-red-500" title="> 30 Obésité" />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>18.5</span>
                      <span>25</span>
                      <span>30</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-700 mb-2">Critères physiques pour le gardiennage</h4>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Taille minimale recommandée: 170 cm (hommes), 160 cm (femmes)</li>
                  <li>• IMC idéal: entre 20 et 25</li>
                  <li>• Bonne condition physique générale</li>
                  <li>• Aptitude à la station debout prolongée</li>
                </ul>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <FiFolder className="mr-2 text-primary-600" />
                    Documents de l'utilisateur
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Uploadez les documents scannés de l'agent ou du responsable (CIN, CV, diplômes, etc.)
                  </p>
                </div>
                {userDocuments.length > 0 && (
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                    {userDocuments.length} document(s)
                  </span>
                )}
              </div>

              <DocumentUpload
                documents={userDocuments}
                onChange={setUserDocuments}
                disabled={loading}
                showExisting={!!user}
                existingDocuments={existingDocuments}
              />
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <FiLock className="mr-2 text-primary-600" />
                    Permissions de l'utilisateur
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Les permissions héritées du rôle "{formData.role}" sont marquées en bleu.
                    Vous pouvez ajouter (+) ou retirer (-) des permissions personnalisées.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">Permissions effectives</span>
                  <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                    {getEffectivePermissions().length}
                  </span>
                </div>
              </div>

              {/* Légende */}
              <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-xl text-sm">
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400 mr-2"></span>
                  <span className="text-gray-600">Permission du rôle</span>
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded bg-green-100 border-2 border-green-500 mr-2"></span>
                  <span className="text-gray-600">Permission ajoutée (+)</span>
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded bg-red-100 border-2 border-red-500 mr-2"></span>
                  <span className="text-gray-600">Permission retirée (-)</span>
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded bg-gray-100 border-2 border-gray-300 mr-2"></span>
                  <span className="text-gray-600">Non attribuée</span>
                </div>
              </div>

              {loadingPermissions ? (
                <div className="flex justify-center py-8">
                  <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(allPermissions.grouped || {}).map(([module, permissions]) => (
                    <div key={module} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Header du module */}
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h4 className="font-semibold text-gray-800 capitalize flex items-center">
                          {module === 'dashboard' && <FiGrid className="mr-2 text-primary-600" />}
                          {module === 'users' && <FiUsers className="mr-2 text-blue-600" />}
                          {module === 'events' && <FiCalendar className="mr-2 text-green-600" />}
                          {module === 'assignments' && <FiClipboard className="mr-2 text-yellow-600" />}
                          {module === 'attendance' && <FiMapPin className="mr-2 text-purple-600" />}
                          {module === 'reports' && <FiFileText className="mr-2 text-indigo-600" />}
                          {module === 'incidents' && <FiAlertTriangle className="mr-2 text-red-600" />}
                          {module === 'notifications' && <FiBell className="mr-2 text-pink-600" />}
                          {module === 'messages' && <FiMail className="mr-2 text-cyan-600" />}
                          {module === 'tracking' && <FiMapPin className="mr-2 text-teal-600" />}
                          {module === 'sos' && <FiAlertCircle className="mr-2 text-red-700" />}
                          {module === 'badges' && <FiStar className="mr-2 text-amber-600" />}
                          {module === 'documents' && <FiFolder className="mr-2 text-orange-600" />}
                          {module === 'admin' && <FiShield className="mr-2 text-gray-700" />}
                          {module.charAt(0).toUpperCase() + module.slice(1)}
                          <span className="ml-2 text-xs text-gray-400 font-normal">
                            ({permissions.length} permissions)
                          </span>
                        </h4>
                      </div>

                      {/* Liste des permissions du module */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {permissions.map((perm) => {
                          const status = getPermissionStatus(perm.code);
                          const isEffective = getEffectivePermissions().includes(perm.code);

                          return (
                            <div
                              key={perm.id}
                              className={`
                                flex items-center justify-between p-3 rounded-lg border-2 transition-all
                                ${status === 'role' ? 'bg-blue-50 border-blue-300' : ''}
                                ${status === 'granted' ? 'bg-green-50 border-green-400' : ''}
                                ${status === 'denied' ? 'bg-red-50 border-red-400' : ''}
                                ${status === 'none' ? 'bg-gray-50 border-gray-200' : ''}
                              `}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm truncate ${isEffective ? 'text-gray-800' : 'text-gray-400'}`}>
                                  {perm.name}
                                </p>
                                <p className="text-xs text-gray-400 font-mono truncate">{perm.code}</p>
                              </div>

                              <div className="flex items-center gap-1 ml-2">
                                {/* Bouton Ajouter (+) */}
                                <button
                                  type="button"
                                  onClick={() => toggleGrantedPermission(perm.code)}
                                  className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all
                                    ${status === 'granted'
                                      ? 'bg-green-500 text-white shadow-sm'
                                      : 'bg-white border border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500'
                                    }
                                  `}
                                  title="Ajouter cette permission"
                                >
                                  +
                                </button>

                                {/* Bouton Retirer (-) - seulement si permission du rôle */}
                                {(status === 'role' || status === 'denied') && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDeniedPermission(perm.code)}
                                    className={`
                                      w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all
                                      ${status === 'denied'
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'bg-white border border-gray-300 text-gray-400 hover:border-red-400 hover:text-red-500'
                                      }
                                    `}
                                    title="Retirer cette permission"
                                  >
                                    −
                                  </button>
                                )}

                                {/* Indicateur de statut */}
                                <div className={`
                                  w-6 h-6 rounded-full flex items-center justify-center ml-1
                                  ${isEffective ? 'bg-green-500' : 'bg-gray-300'}
                                `}>
                                  {isEffective ? (
                                    <FiCheck className="text-white" size={14} />
                                  ) : (
                                    <FiX className="text-white" size={14} />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Résumé des modifications */}
              {(userCustomPermissions.granted.length > 0 || userCustomPermissions.denied.length > 0) && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <h4 className="font-semibold text-yellow-800 mb-2">Modifications personnalisées</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {userCustomPermissions.granted.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-1">
                          Permissions ajoutées ({userCustomPermissions.granted.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {userCustomPermissions.granted.map(code => (
                            <span key={code} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {userCustomPermissions.denied.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-1">
                          Permissions retirées ({userCustomPermissions.denied.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {userCustomPermissions.denied.map(code => (
                            <span key={code} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Facial Recognition Tab - Style Mobile */}
          {activeTab === 'facial' && (
            <div className="flex flex-col items-center justify-center min-h-[400px] -mx-6 -mt-6 bg-gradient-to-b from-gray-900 to-gray-800">
              {/* Header info - compact */}
              <div className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${facialDescriptor ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                    <span className="text-white text-sm font-medium">
                      {facialDescriptor ? 'Visage capturé' : 'En attente de capture'}
                    </span>
                  </div>
                  <div className="flex items-center text-white/70 text-xs">
                    <FiUser className="mr-1" />
                    {formData.firstName} {formData.lastName}
                  </div>
                </div>
              </div>

              {/* Sélecteur de mode - Camera ou Upload */}
              {!facialPhoto && (
                <div className="w-full px-4 py-3 bg-black/20">
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFacialCaptureMode('camera')}
                      className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        facialCaptureMode === 'camera'
                          ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      <FiCamera className="mr-2" size={16} />
                      Caméra
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacialCaptureMode('upload')}
                      className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        facialCaptureMode === 'upload'
                          ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      <FiUpload className="mr-2" size={16} />
                      Photo pièce jointe
                    </button>
                  </div>
                </div>
              )}

              {/* Zone de capture principale */}
              <div className="flex-1 w-full flex flex-col items-center justify-center p-4">
                {!facialPhoto ? (
                  <>
                    {/* Mode Caméra */}
                    {facialCaptureMode === 'camera' && (
                      <FaceVerification
                        mode="capture"
                        autoStart={true}
                        showReferencePhoto={false}
                        className="w-full max-w-md"
                        onDescriptorCaptured={async (data) => {
                          setFacialDescriptor(data.descriptor);
                          setFacialPhoto(data.photo);
                          if (!profilePhoto) {
                            setProfilePhoto(data.photo);
                          }
                          // Pas de sauvegarde automatique - l'utilisateur cliquera sur Enregistrer
                          console.log('✅ Capture faciale réussie, en attente d\'enregistrement...');
                        }}
                      />
                    )}

                    {/* Mode Upload */}
                    {facialCaptureMode === 'upload' && (
                      <div className="text-center w-full max-w-md">
                        {/* Input file caché */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFacialPhotoUpload}
                          accept="image/*"
                          className="hidden"
                        />

                        {/* Zone de drop/upload */}
                        <div
                          onClick={() => !isProcessingUpload && fileInputRef.current?.click()}
                          className={`
                            border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all
                            ${isProcessingUpload
                              ? 'border-primary-400 bg-primary-500/10'
                              : 'border-white/30 hover:border-white/50 hover:bg-white/5'
                            }
                          `}
                        >
                          {isProcessingUpload ? (
                            <div className="flex flex-col items-center">
                              <div className="w-16 h-16 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mb-4" />
                              <p className="text-white font-medium">Analyse en cours...</p>
                              <p className="text-white/60 text-sm mt-1">Détection du visage</p>
                            </div>
                          ) : (
                            <>
                              <div className="w-20 h-20 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                                <FiImage className="text-white/70" size={40} />
                              </div>
                              <h3 className="text-white font-semibold text-lg mb-2">
                                Importer une photo
                              </h3>
                              <p className="text-white/60 text-sm mb-4">
                                Cliquez pour sélectionner une photo d'identité
                              </p>
                              <div className="flex flex-wrap justify-center gap-2 text-xs text-white/50">
                                <span className="px-2 py-1 bg-white/10 rounded">JPG</span>
                                <span className="px-2 py-1 bg-white/10 rounded">PNG</span>
                                <span className="px-2 py-1 bg-white/10 rounded">Max 5 Mo</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Conseils pour une bonne photo */}
                        <div className="mt-6 text-left bg-white/5 rounded-xl p-4">
                          <h4 className="text-white/90 font-medium mb-2 flex items-center">
                            <FiAlertCircle className="mr-2 text-yellow-400" size={16} />
                            Conseils pour une bonne photo
                          </h4>
                          <ul className="text-white/60 text-sm space-y-1">
                            <li>• Visage bien visible et de face</li>
                            <li>• Bonne luminosité, pas de contre-jour</li>
                            <li>• Fond neutre de préférence</li>
                            <li>• Photo récente de l'agent</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Photo capturée - style mobile */
                  <div className="text-center">
                    <div className="relative inline-block">
                      <img
                        src={facialPhoto}
                        alt="Visage capturé"
                        className="w-48 h-48 rounded-full object-cover border-4 border-green-500 shadow-2xl shadow-green-500/30"
                      />
                      <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <FiCheck className="text-white" size={24} />
                      </div>
                    </div>

                    <div className="mt-6 text-center">
                      <h3 className="text-xl font-bold text-white">Capture réussie!</h3>
                      <p className="text-green-400 text-sm mt-1">
                        {facialDescriptor?.length || 128} points de données extraits
                      </p>
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-4">
                      <div className="bg-blue-500/20 border border-blue-400 rounded-xl p-4 max-w-md">
                        <p className="text-blue-300 text-center text-sm">
                          ✓ Photo capturée! Cliquez sur <strong>"Enregistrer"</strong> en bas pour sauvegarder.
                        </p>
                      </div>

                      <div className="flex gap-3 justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setFacialPhoto(null);
                            setFacialDescriptor(null);
                            setFacialCaptureMode('camera');
                          }}
                          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all flex items-center text-sm"
                        >
                          <FiCamera className="mr-2" />
                          Reprendre
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFacialPhoto(null);
                            setFacialDescriptor(null);
                            setFacialCaptureMode('upload');
                          }}
                          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all flex items-center text-sm"
                        >
                          <FiUpload className="mr-2" />
                          Autre photo
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer instructions */}
              {!facialPhoto && (
                <div className="w-full px-4 py-4 bg-black/30 backdrop-blur-sm">
                  <div className="flex items-center justify-center text-white/80 text-sm">
                    <FiAlertCircle className="mr-2 text-yellow-400" />
                    <span>
                      {facialCaptureMode === 'camera'
                        ? 'Positionnez votre visage dans le cadre • Qualité 80% requise'
                        : 'Sélectionnez une photo claire avec le visage bien visible'
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </form>

        {/* Footer avec navigation */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            {/* Bouton Précédent */}
            <button
              type="button"
              onClick={goToPrevStep}
              disabled={currentTabIndex === 0}
              className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                currentTabIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiArrowLeft className="mr-2" />
              Précédent
            </button>

            {/* Indicateur central */}
            <div className="hidden sm:flex items-center space-x-2">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    // Permettre de revenir aux étapes précédentes seulement
                    if (index <= currentTabIndex || isStepValid(tabs[currentTabIndex].id)) {
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentTabIndex
                      ? 'bg-primary-600 scale-125'
                      : index < currentTabIndex
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Boutons droite */}
            <div className="flex items-center space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-all">
                Annuler
              </button>

              {/* Bouton Suivant ou Enregistrer selon l'étape */}
              {activeTab === 'facial' || (['admin', 'user'].includes(formData.role) && activeTab === 'permissions') ? (
                // Dernière étape: bouton Enregistrer
                <button
                  type="button"
                  onClick={() => saveUser(facialDescriptor, facialPhoto)}
                  disabled={loading || (activeTab === 'facial' && !facialDescriptor)}
                  className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <FiCheck className="mr-2" />
                      Enregistrer
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
                >
                  Suivant
                  <FiArrowRight className="ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification de succès */}
      <NotificationOverlay
        show={showSuccessNotification}
        type="success"
        title={user ? 'Utilisateur mis à jour!' : 'Utilisateur créé avec succès!'}
        message={user ? 'Les modifications ont été enregistrées' : 'Le compte a été créé et est prêt à être utilisé'}
        userPhoto={savedUserData?.photo}
        userName={savedUserData?.name}
        onClose={() => setShowSuccessNotification(false)}
        autoCloseDelay={2500}
      />

      {/* Notification d'erreurs de validation */}
      <ValidationErrorsOverlay
        show={showErrorNotification}
        errors={validationErrors}
        onClose={() => {
          setShowErrorNotification(false);
          setValidationErrors([]);
        }}
      />
    </div>
  );
};

// User Detail Modal
const UserDetailModal = ({ isOpen, onClose, user }) => {
  if (!isOpen || !user) return null;

  const calculateBMI = () => {
    if (user.height && user.weight) {
      const heightM = user.height / 100;
      return (user.weight / (heightM * heightM)).toFixed(1);
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Détails de l'utilisateur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-6">
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-2xl font-bold">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold">{user.firstName} {user.lastName}</h3>
              <p className="text-gray-500">{user.employeeId}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${
                  user.role === 'admin' ? 'badge-danger' :
                  user.role === 'supervisor' ? 'badge-warning' : 'badge-info'
                }`}>
                  {user.role === 'admin' ? 'Admin' : user.role === 'supervisor' ? 'Superviseur' : 'Agent'}
                </span>
                <span className={`badge ${
                  user.status === 'active' ? 'badge-success' :
                  user.status === 'inactive' ? 'badge-warning' : 'badge-danger'
                }`}>
                  {user.status === 'active' ? 'Actif' : user.status === 'inactive' ? 'Inactif' : 'Suspendu'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-primary-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary-600">{user.overallScore || 0}</div>
              <div className="text-xs text-gray-500">Score global</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{user.punctualityScore || 0}%</div>
              <div className="text-xs text-gray-500">Ponctualité</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{user.reliabilityScore || 0}%</div>
              <div className="text-xs text-gray-500">Fiabilité</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{user.experienceYears || 0}</div>
              <div className="text-xs text-gray-500">Ans d'exp.</div>
            </div>
          </div>

          {/* Responsable / Agents supervisés */}
          {user.supervisor && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-700 mb-3 flex items-center">
                <FiUserCheck className="mr-2" /> Responsable
              </h4>
              <div className="flex items-center">
                {user.supervisor.profilePhoto ? (
                  <img
                    src={user.supervisor.profilePhoto}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 font-medium mr-3">
                    {user.supervisor.firstName?.[0]}{user.supervisor.lastName?.[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800">{user.supervisor.firstName} {user.supervisor.lastName}</p>
                  <p className="text-sm text-gray-500">{user.supervisor.email}</p>
                  {user.supervisor.phone && <p className="text-sm text-gray-500">{user.supervisor.phone}</p>}
                </div>
              </div>
            </div>
          )}

          {user.supervisedAgents?.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-700 mb-3 flex items-center">
                <FiUserCheck className="mr-2" /> Agents supervisés ({user.supervisedAgents.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {user.supervisedAgents.map(agent => (
                  <div key={agent.id} className="flex items-center bg-white rounded-lg px-3 py-2 shadow-sm">
                    {agent.profilePhoto ? (
                      <img src={agent.profilePhoto} alt="" className="w-6 h-6 rounded-full object-cover mr-2" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs mr-2">
                        {agent.firstName?.[0]}{agent.lastName?.[0]}
                      </div>
                    )}
                    <span className="text-sm text-gray-700">{agent.firstName} {agent.lastName}</span>
                    <span className={`ml-2 w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Contact</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <FiMail className="mr-2" /> {user.email}
                </div>
                <div className="flex items-center text-gray-600">
                  <FiPhone className="mr-2" /> {user.phone}
                </div>
                {user.whatsappNumber && (
                  <div className="flex items-center text-gray-600">
                    <FiPhone className="mr-2" /> WhatsApp: {user.whatsappNumber}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Professionnel</h4>
              <div className="space-y-2 text-sm">
                {user.diploma && <p className="text-gray-600">Diplôme: {user.diploma}</p>}
                {user.securityCard && <p className="text-gray-600">Carte pro: {user.securityCard}</p>}
                {user.hireDate && (
                  <p className="text-gray-600">
                    Embauché le: {format(new Date(user.hireDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            </div>

            {(user.height || user.weight) && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Physique</h4>
                <div className="space-y-2 text-sm">
                  {user.height && <p className="text-gray-600">Taille: {user.height} cm</p>}
                  {user.weight && <p className="text-gray-600">Poids: {user.weight} kg</p>}
                  {calculateBMI() && <p className="text-gray-600">IMC: {calculateBMI()}</p>}
                </div>
              </div>
            )}

            {user.specializations?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Spécialisations</h4>
                <div className="flex flex-wrap gap-1">
                  {user.specializations.map(spec => (
                    <span key={spec} className="badge bg-primary-100 text-primary-700">{spec}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant carte agent compact pour la vue groupée
const AgentCard = ({ user, onEdit, onDelete, onView, getStatusBadge }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          {user.profilePhoto ? (
            <img
              src={user.profilePhoto}
              alt=""
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-100"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
          )}
          <div className="ml-3">
            <h4 className="font-semibold text-gray-900">{user.firstName} {user.lastName}</h4>
            <p className="text-xs text-gray-500 font-mono">{user.employeeId}</p>
          </div>
        </div>
        {getStatusBadge(user.status)}
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center text-gray-600">
          <FiMail className="mr-2 text-gray-400" size={14} />
          <span className="truncate">{user.email}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <FiPhone className="mr-2 text-gray-400" size={14} />
          <span>{user.phone || '-'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center text-yellow-600">
            <FiStar className="mr-1" size={14} />
            <span className="font-medium text-sm">{user.overallScore || 0}</span>
          </div>
          <div className="text-xs text-gray-500">
            {user.experienceYears || 0} ans exp.
          </div>
        </div>

        {/* Actions - visibles au hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(user)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Voir"
          >
            <FiEye size={16} />
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
            title="Modifier"
          >
            <FiEdit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(user.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Supprimer"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant groupe de responsable
const SupervisorGroup = ({ supervisor, agents, onEdit, onDelete, onView, getStatusBadge, getRoleBadge, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeAgents = agents.filter(a => a.status === 'active').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header du groupe */}
      <div
        className="p-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button className="mr-3 p-1 hover:bg-gray-200 rounded-lg transition-colors">
              {expanded ? (
                <FiChevronDown className="text-gray-600" size={20} />
              ) : (
                <FiChevronRight className="text-gray-600" size={20} />
              )}
            </button>

            {supervisor ? (
              <>
                {supervisor.profilePhoto ? (
                  <img
                    src={supervisor.profilePhoto}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover border-2 border-primary-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xl">
                    {supervisor.firstName?.[0]}{supervisor.lastName?.[0]}
                  </div>
                )}
                <div className="ml-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {supervisor.firstName} {supervisor.lastName}
                    </h3>
                    {getRoleBadge(supervisor.role)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center">
                      <FiMail className="mr-1" size={12} />
                      {supervisor.email}
                    </span>
                    {supervisor.phone && (
                      <span className="flex items-center">
                        <FiPhone className="mr-1" size={12} />
                        {supervisor.phone}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center">
                  <FiAlertCircle className="text-gray-400" size={24} />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-gray-500">Sans responsable assigné</h3>
                  <p className="text-sm text-red-500">Ces agents n'ont pas de superviseur</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Stats du groupe */}
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-primary-50 rounded-xl">
                <div className="text-2xl font-bold text-primary-600">{agents.length}</div>
                <div className="text-xs text-primary-600">Agent{agents.length > 1 ? 's' : ''}</div>
              </div>
              <div className="text-center px-4 py-2 bg-green-50 rounded-xl">
                <div className="text-2xl font-bold text-green-600">{activeAgents}</div>
                <div className="text-xs text-green-600">Actif{activeAgents > 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* Actions sur le superviseur */}
            {supervisor && (
              <div className="flex items-center gap-1 border-l pl-4">
                <button
                  onClick={(e) => { e.stopPropagation(); onView(supervisor); }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Voir détails"
                >
                  <FiEye size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(supervisor); }}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  title="Modifier"
                >
                  <FiEdit2 size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Liste des agents */}
      {expanded && agents.length > 0 && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                user={agent}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        </div>
      )}

      {expanded && agents.length === 0 && (
        <div className="p-8 bg-gray-50 border-t text-center">
          <FiUsers className="mx-auto text-gray-300 mb-2" size={40} />
          <p className="text-gray-500">Aucun agent assigné à ce responsable</p>
        </div>
      )}
    </div>
  );
};

// Composant pour les alertes d'expiration de documents
const DocumentExpirationAlert = ({ users }) => {
  const today = new Date();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

  // Calculer les alertes d'expiration
  const expirationAlerts = useMemo(() => {
    const alerts = [];

    users.forEach(user => {
      // Vérifier la carte de sécurité (CIN professionnel)
      if (user.securityCardExpiry) {
        const expiryDate = new Date(user.securityCardExpiry);
        if (expiryDate <= threeMonthsFromNow) {
          const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          alerts.push({
            user,
            type: 'Carte professionnelle',
            expiryDate,
            daysRemaining,
            isExpired: daysRemaining <= 0,
            isUrgent: daysRemaining <= 30 && daysRemaining > 0,
            isWarning: daysRemaining > 30 && daysRemaining <= 90
          });
        }
      }

      // Vérifier les documents (CIN, permis, fiche anthropométrique)
      if (user.documents && user.documents.length > 0) {
        user.documents.forEach(doc => {
          if (doc.expiryDate) {
            const expiryDate = new Date(doc.expiryDate);
            if (expiryDate <= threeMonthsFromNow) {
              const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
              alerts.push({
                user,
                type: doc.documentType === 'cin' ? 'CIN' :
                      doc.documentType === 'permis' ? 'Permis de conduire' :
                      doc.documentType === 'fiche_anthropometrique' ? 'Fiche anthropométrique' :
                      doc.customName || doc.documentType,
                expiryDate,
                daysRemaining,
                isExpired: daysRemaining <= 0,
                isUrgent: daysRemaining <= 30 && daysRemaining > 0,
                isWarning: daysRemaining > 30 && daysRemaining <= 90
              });
            }
          }
        });
      }
    });

    // Trier par urgence (expirés d'abord, puis urgents, puis warnings)
    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [users]);

  if (expirationAlerts.length === 0) return null;

  const expiredCount = expirationAlerts.filter(a => a.isExpired).length;
  const urgentCount = expirationAlerts.filter(a => a.isUrgent).length;
  const warningCount = expirationAlerts.filter(a => a.isWarning).length;

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-3">
            <FiAlertTriangle className="text-red-600" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-red-800">Alertes d'expiration de documents</h3>
            <p className="text-sm text-red-600">
              {expirationAlerts.length} document(s) expire(nt) dans les 3 prochains mois
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {expiredCount > 0 && (
            <span className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
              {expiredCount} expiré(s)
            </span>
          )}
          {urgentCount > 0 && (
            <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-bold">
              {urgentCount} urgent(s)
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-3 py-1 bg-yellow-500 text-white rounded-full text-xs font-bold">
              {warningCount} à surveiller
            </span>
          )}
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {expirationAlerts.slice(0, 9).map((alert, index) => (
            <div
              key={index}
              className={`flex items-center p-2 rounded-lg ${
                alert.isExpired ? 'bg-red-100 border border-red-300' :
                alert.isUrgent ? 'bg-orange-100 border border-orange-300' :
                'bg-yellow-100 border border-yellow-300'
              }`}
            >
              <div className="flex-shrink-0 mr-2">
                {alert.user.profilePhoto ? (
                  <img src={alert.user.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold">
                    {alert.user.firstName?.[0]}{alert.user.lastName?.[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {alert.user.firstName} {alert.user.lastName}
                </p>
                <p className={`text-xs ${
                  alert.isExpired ? 'text-red-700' :
                  alert.isUrgent ? 'text-orange-700' :
                  'text-yellow-700'
                }`}>
                  {alert.type} - {alert.isExpired
                    ? `Expiré depuis ${Math.abs(alert.daysRemaining)} jours`
                    : `Expire dans ${alert.daysRemaining} jours`
                  }
                </p>
              </div>
            </div>
          ))}
        </div>
        {expirationAlerts.length > 9 && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            + {expirationAlerts.length - 9} autre(s) alerte(s)
          </p>
        )}
      </div>
    </div>
  );
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [viewMode, setViewMode] = useState('grouped'); // 'list' ou 'grouped'
  const [selectedUsers, setSelectedUsers] = useState([]); // Pour suppression multiple
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchDebounceRef = useRef(null);

  // Debounce de la recherche (300ms)
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, roleFilter, statusFilter, supervisorFilter, sortBy, sortOrder, pagination.page]);

  const fetchUsers = async () => {
    try {
      const params = {
        page: pagination.page,
        limit: 100, // Charger plus pour la vue groupée
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        sortBy,
        sortOrder
      };

      const response = await usersAPI.getAll(params);
      let fetchedUsers = response.data.data.users || [];

      // Filtrer par superviseur côté client si nécessaire
      if (supervisorFilter) {
        if (supervisorFilter === 'unassigned') {
          fetchedUsers = fetchedUsers.filter(u => !u.supervisorId && u.role === 'agent');
        } else {
          fetchedUsers = fetchedUsers.filter(u => u.supervisorId === supervisorFilter);
        }
      }

      setUsers(fetchedUsers);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.data.pagination?.totalPages || 1
      }));
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  // Regrouper les utilisateurs par responsable
  const groupedUsers = useMemo(() => {
    const supervisors = users.filter(u => u.role === 'supervisor' || u.role === 'admin');
    const agents = users.filter(u => u.role === 'agent');

    // Créer un map des superviseurs avec leurs agents
    const groups = [];

    // Ajouter les superviseurs/admins avec leurs agents
    supervisors.forEach(supervisor => {
      const supervisorAgents = agents.filter(a => a.supervisorId === supervisor.id);
      groups.push({
        supervisor,
        agents: supervisorAgents
      });
    });

    // Ajouter les agents sans superviseur
    const unassignedAgents = agents.filter(a => !a.supervisorId);
    if (unassignedAgents.length > 0) {
      groups.push({
        supervisor: null,
        agents: unassignedAgents
      });
    }

    // Trier: d'abord les superviseurs avec agents, puis ceux sans, puis les non-assignés
    return groups.sort((a, b) => {
      if (!a.supervisor) return 1;
      if (!b.supervisor) return -1;
      return b.agents.length - a.agents.length;
    });
  }, [users]);

  // Stats globales
  const stats = useMemo(() => {
    const totalAgents = users.filter(u => u.role === 'agent').length;
    const totalSupervisors = users.filter(u => u.role === 'supervisor').length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const totalUsers = users.filter(u => u.role === 'user').length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const unassignedAgents = users.filter(u => u.role === 'agent' && !u.supervisorId).length;

    return { totalAgents, totalSupervisors, totalAdmins, totalUsers, activeUsers, unassignedAgents };
  }, [users]);

  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) return;

    try {
      await usersAPI.delete(id);
      toast.success('Utilisateur supprimé');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  // Suppression multiple
  const handleBulkDelete = async (role = null) => {
    let usersToDelete = selectedUsers;
    let message = `Voulez-vous vraiment supprimer ${selectedUsers.length} utilisateur(s) sélectionné(s) ?`;

    if (role) {
      usersToDelete = users.filter(u => u.role === role).map(u => u.id);
      const roleLabel = role === 'agent' ? 'agents' : role === 'supervisor' ? 'responsables' : role === 'user' ? 'utilisateurs' : role;
      message = `Voulez-vous vraiment supprimer TOUS les ${roleLabel} (${usersToDelete.length}) ?`;
    }

    if (usersToDelete.length === 0) {
      toast.warning('Aucun utilisateur à supprimer');
      return;
    }

    if (!window.confirm(message)) return;

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const userId of usersToDelete) {
        try {
          await usersAPI.delete(userId);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} utilisateur(s) supprimé(s)`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} erreur(s) lors de la suppression`);
      }

      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      toast.error('Erreur lors de la suppression multiple');
    }
  };

  // Toggle sélection utilisateur
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Sélectionner tous les utilisateurs visibles
  const toggleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  // Export Excel
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const data = users.map(user => ({
        'ID Employé': user.employeeId,
        'CIN': user.cin || '',
        'Prénom': user.firstName,
        'Nom': user.lastName,
        'Email': user.email,
        'Téléphone': user.phone || '',
        'WhatsApp': user.whatsappNumber || '',
        'Rôle': user.role === 'agent' ? 'Agent' : user.role === 'supervisor' ? 'Superviseur' : user.role === 'admin' ? 'Admin' : 'Utilisateur',
        'Statut': user.status === 'active' ? 'Actif' : user.status === 'inactive' ? 'Inactif' : 'Suspendu',
        'Responsable': user.supervisor ? `${user.supervisor.firstName} ${user.supervisor.lastName}` : '',
        'Date embauche': user.hireDate ? format(new Date(user.hireDate), 'dd/MM/yyyy') : '',
        'Expérience (ans)': user.experienceYears || 0,
        'Carte pro': user.securityCard || '',
        'Expiration carte': user.securityCardExpiry ? format(new Date(user.securityCardExpiry), 'dd/MM/yyyy') : '',
        'Score': user.overallScore || 0,
        'Adresse': user.address || ''
      }));

      // Créer le contenu CSV avec BOM pour Excel
      const headers = Object.keys(data[0] || {});
      const csvContent = '\uFEFF' + [
        headers.join(';'),
        ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(';'))
      ].join('\n');

      // Télécharger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `utilisateurs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Export Excel terminé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  // Export PDF
  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Créer le contenu HTML pour le PDF
      const roleLabels = { agent: 'Agent', supervisor: 'Superviseur', admin: 'Admin', user: 'Utilisateur' };
      const statusLabels = { active: 'Actif', inactive: 'Inactif', suspended: 'Suspendu' };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Liste des Utilisateurs</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
            h1 { color: #1a56db; font-size: 18px; margin-bottom: 5px; }
            .date { color: #666; font-size: 11px; margin-bottom: 15px; }
            .stats { display: flex; gap: 15px; margin-bottom: 15px; }
            .stat { background: #f3f4f6; padding: 8px 12px; border-radius: 5px; }
            .stat-value { font-size: 16px; font-weight: bold; color: #1a56db; }
            .stat-label { font-size: 9px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #1a56db; color: white; padding: 8px 5px; text-align: left; font-size: 9px; }
            td { padding: 6px 5px; border-bottom: 1px solid #e5e7eb; font-size: 9px; }
            tr:nth-child(even) { background: #f9fafb; }
            .badge { padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: bold; }
            .badge-agent { background: #dbeafe; color: #1e40af; }
            .badge-supervisor { background: #fef3c7; color: #92400e; }
            .badge-admin { background: #fee2e2; color: #991b1b; }
            .badge-user { background: #e9d5ff; color: #6b21a8; }
            .badge-active { background: #d1fae5; color: #065f46; }
            .badge-inactive { background: #fef3c7; color: #92400e; }
            .badge-suspended { background: #fee2e2; color: #991b1b; }
            @media print { body { margin: 10px; } }
          </style>
        </head>
        <body>
          <h1>Liste des Utilisateurs - Security Guard Management</h1>
          <div class="date">Exporté le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</div>

          <div class="stats">
            <div class="stat"><div class="stat-value">${stats.totalAgents}</div><div class="stat-label">Agents</div></div>
            <div class="stat"><div class="stat-value">${stats.totalSupervisors}</div><div class="stat-label">Superviseurs</div></div>
            <div class="stat"><div class="stat-value">${stats.totalAdmins}</div><div class="stat-label">Admins</div></div>
            <div class="stat"><div class="stat-value">${stats.totalUsers}</div><div class="stat-label">Utilisateurs</div></div>
            <div class="stat"><div class="stat-value">${stats.activeUsers}</div><div class="stat-label">Actifs</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Responsable</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(user => `
                <tr>
                  <td>${user.employeeId}</td>
                  <td><strong>${user.firstName} ${user.lastName}</strong></td>
                  <td>${user.email}</td>
                  <td>${user.phone || '-'}</td>
                  <td><span class="badge badge-${user.role}">${roleLabels[user.role] || user.role}</span></td>
                  <td><span class="badge badge-${user.status}">${statusLabels[user.status] || user.status}</span></td>
                  <td>${user.supervisor ? `${user.supervisor.firstName} ${user.supervisor.lastName}` : '-'}</td>
                  <td>${user.overallScore || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 20px; text-align: center; color: #666; font-size: 9px;">
            Total: ${users.length} utilisateur(s)
          </div>
        </body>
        </html>
      `;

      // Ouvrir dans une nouvelle fenêtre pour impression/PDF
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);

      toast.success('PDF généré - Utilisez "Enregistrer en PDF" dans la fenêtre d\'impression');
    } catch (error) {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const openDetailModal = (user) => {
    setSelectedUser(user);
    setDetailModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const classes = {
      active: 'badge-success',
      inactive: 'badge-warning',
      suspended: 'badge-danger'
    };
    const labels = {
      active: 'Actif',
      inactive: 'Inactif',
      suspended: 'Suspendu'
    };
    return <span className={`badge ${classes[status]}`}>{labels[status]}</span>;
  };

  const getRoleBadge = (role) => {
    const classes = {
      admin: 'badge-danger',
      supervisor: 'badge-warning',
      agent: 'badge-info',
      user: 'bg-purple-100 text-purple-700'
    };
    const labels = {
      admin: 'Admin',
      supervisor: 'Superviseur',
      agent: 'Agent',
      user: 'Utilisateur'
    };
    return <span className={`badge ${classes[role] || 'bg-gray-100 text-gray-700'}`}>{labels[role] || role}</span>;
  };

  // Fonction de tri des colonnes
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
  };

  // Composant en-tête de colonne triable
  const SortableHeader = ({ column, label, className = '' }) => (
    <th
      className={`table-header cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === column ? (
          sortOrder === 'ASC' ? (
            <FiChevronUp className="text-primary-600" size={14} />
          ) : (
            <FiChevronDown className="text-primary-600" size={14} />
          )
        ) : (
          <FiChevronDown className="text-gray-300" size={14} />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-gray-500">Gestion des agents et responsables</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Menu Export */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary flex items-center"
              disabled={exporting}
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <FiDownload className="mr-2" />
              )}
              Exporter
              <FiChevronDown className="ml-2" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-10 overflow-hidden">
                <button
                  onClick={exportToExcel}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center"
                >
                  <FiFileText className="mr-3 text-green-600" />
                  Exporter en Excel (CSV)
                </button>
                <button
                  onClick={exportToPDF}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center border-t"
                >
                  <FiFileText className="mr-3 text-red-600" />
                  Exporter en PDF
                </button>
              </div>
            )}
          </div>

          {/* Menu Suppression Multiple */}
          <div className="relative group">
            <button className="btn-secondary flex items-center text-red-600 hover:bg-red-50 hover:border-red-300">
              <FiTrash2 className="mr-2" />
              Supprimer
              <FiChevronDown className="ml-2" />
            </button>
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-10 overflow-hidden hidden group-hover:block">
              <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500">
                SUPPRIMER PAR RÔLE
              </div>
              <button
                onClick={() => handleBulkDelete('agent')}
                className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center text-red-600"
              >
                <FiUser className="mr-3" />
                Tous les agents ({stats.totalAgents})
              </button>
              <button
                onClick={() => handleBulkDelete('supervisor')}
                className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center text-red-600 border-t"
              >
                <FiUserCheck className="mr-3" />
                Tous les responsables ({stats.totalSupervisors})
              </button>
              <button
                onClick={() => handleBulkDelete('user')}
                className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center text-red-600 border-t"
              >
                <FiUsers className="mr-3" />
                Tous les utilisateurs ({stats.totalUsers})
              </button>
              {selectedUsers.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gray-50 border-t border-b text-xs font-semibold text-gray-500">
                    SÉLECTION
                  </div>
                  <button
                    onClick={() => handleBulkDelete()}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center text-red-700 font-medium"
                  >
                    <FiTrash2 className="mr-3" />
                    Supprimer sélection ({selectedUsers.length})
                  </button>
                </>
              )}
            </div>
          </div>

          <button onClick={openCreateModal} className="btn-primary flex items-center">
            <FiPlus className="mr-2" /> Nouvel utilisateur
          </button>
        </div>
      </div>

      {/* Alertes d'expiration de documents */}
      <DocumentExpirationAlert users={users} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Agents</p>
              <p className="text-2xl font-bold text-primary-600">{stats.totalAgents}</p>
            </div>
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <FiUser className="text-primary-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Superviseurs</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.totalSupervisors}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
              <FiUserCheck className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Admins</p>
              <p className="text-2xl font-bold text-red-600">{stats.totalAdmins}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <FiShield className="text-red-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Utilisateurs</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <FiUsers className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Actifs</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <FiCheck className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Non assignés</p>
              <p className={`text-2xl font-bold ${stats.unassignedAgents > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {stats.unassignedAgents}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.unassignedAgents > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <FiAlertCircle className={stats.unassignedAgents > 0 ? 'text-red-600' : 'text-gray-400'} size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email, CIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 pr-10"
              />
              {search && debouncedSearch !== search && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {search && debouncedSearch === search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input w-44"
          >
            <option value="">Tous les rôles</option>
            <option value="agent">Agents</option>
            <option value="supervisor">Superviseurs</option>
            <option value="admin">Admins</option>
            <option value="user">Utilisateurs</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-40"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="suspended">Suspendu</option>
          </select>

          {/* Filtre par responsable */}
          <select
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
            className="input w-52"
          >
            <option value="">Tous les responsables</option>
            {users
              .filter(u => u.role === 'supervisor' || u.role === 'admin')
              .map(sup => (
                <option key={sup.id} value={sup.id}>
                  {sup.firstName} {sup.lastName}
                </option>
              ))}
            <option value="unassigned">Sans responsable</option>
          </select>

          {/* Toggle vue */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'grouped'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiUsers className="mr-2" size={16} />
              Par responsable
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiList className="mr-2" size={16} />
              Liste
            </button>
          </div>
        </div>

        {/* Filtres actifs */}
        {(search || roleFilter || statusFilter || supervisorFilter) && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Filtres actifs:</span>
            {search && (
              <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center">
                Recherche: "{search}"
                <button onClick={() => setSearch('')} className="ml-1 hover:text-primary-900">
                  <FiX size={12} />
                </button>
              </span>
            )}
            {roleFilter && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center">
                Rôle: {roleFilter === 'agent' ? 'Agent' : roleFilter === 'supervisor' ? 'Superviseur' : roleFilter === 'admin' ? 'Admin' : 'Utilisateur'}
                <button onClick={() => setRoleFilter('')} className="ml-1 hover:text-blue-900">
                  <FiX size={12} />
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center">
                Statut: {statusFilter === 'active' ? 'Actif' : statusFilter === 'inactive' ? 'Inactif' : 'Suspendu'}
                <button onClick={() => setStatusFilter('')} className="ml-1 hover:text-green-900">
                  <FiX size={12} />
                </button>
              </span>
            )}
            {supervisorFilter && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs flex items-center">
                Responsable: {supervisorFilter === 'unassigned' ? 'Sans responsable' : users.find(u => u.id === supervisorFilter)?.firstName || 'Inconnu'}
                <button onClick={() => setSupervisorFilter('')} className="ml-1 hover:text-yellow-900">
                  <FiX size={12} />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearch('');
                setRoleFilter('');
                setStatusFilter('');
                setSupervisorFilter('');
              }}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Effacer tout
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'grouped' ? (
        /* Vue groupée par responsable */
        <div className="space-y-6">
          {groupedUsers.length === 0 ? (
            <div className="card text-center py-12">
              <FiUsers className="mx-auto text-gray-300 mb-4" size={60} />
              <p className="text-gray-500 text-lg">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            groupedUsers.map((group, index) => (
              <SupervisorGroup
                key={group.supervisor?.id || 'unassigned'}
                supervisor={group.supervisor}
                agents={group.agents}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onView={openDetailModal}
                getStatusBadge={getStatusBadge}
                getRoleBadge={getRoleBadge}
                defaultExpanded={index < 3} // Les 3 premiers groupes sont ouverts par défaut
              />
            ))
          )}
        </div>
      ) : (
        /* Vue liste classique */
        <div className="card overflow-hidden p-0">
          {/* Barre de sélection */}
          {selectedUsers.length > 0 && (
            <div className="px-4 py-3 bg-primary-50 border-b flex items-center justify-between">
              <div className="flex items-center">
                <FiCheck className="text-primary-600 mr-2" />
                <span className="text-sm font-medium text-primary-700">
                  {selectedUsers.length} utilisateur(s) sélectionné(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedUsers([])}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Désélectionner tout
                </button>
                <button
                  onClick={() => handleBulkDelete()}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center"
                >
                  <FiTrash2 className="mr-1" size={14} />
                  Supprimer
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header w-10">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                  </th>
                  <SortableHeader column="firstName" label="Utilisateur" />
                  <SortableHeader column="email" label="Contact" />
                  <SortableHeader column="role" label="Rôle" />
                  <th className="table-header">Responsable</th>
                  <th className="table-header">Créé par</th>
                  <SortableHeader column="overallScore" label="Score" />
                  <SortableHeader column="status" label="Statut" />
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-gray-500">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${selectedUsers.includes(user.id) ? 'bg-primary-50' : ''}`}>
                      <td className="table-cell">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          {user.profilePhoto ? (
                            <img
                              src={user.profilePhoto}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium mr-3">
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-500">{user.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center text-gray-500 text-sm">
                          <FiMail className="mr-1" /> {user.email}
                        </div>
                        <div className="flex items-center text-gray-500 text-sm mt-1">
                          <FiPhone className="mr-1" /> {user.phone}
                        </div>
                      </td>
                      <td className="table-cell">{getRoleBadge(user.role)}</td>
                      <td className="table-cell">
                        {user.supervisor ? (
                          <div className="flex items-center">
                            {user.supervisor.profilePhoto ? (
                              <img
                                src={user.supervisor.profilePhoto}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover mr-2"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs mr-2">
                                {user.supervisor.firstName?.[0]}{user.supervisor.lastName?.[0]}
                              </div>
                            )}
                            <span className="text-sm text-gray-700">
                              {user.supervisor.firstName} {user.supervisor.lastName}
                            </span>
                          </div>
                        ) : user.role === 'agent' ? (
                          <span className="text-xs text-red-500 flex items-center">
                            <FiAlertCircle className="mr-1" /> Non assigné
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {user.role === 'agent' ? (
                          user.createdByType === 'supervisor' || (user.supervisor && user.supervisor.role === 'responsable') ? (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <FiUsers className="mr-1" size={12} />
                              Responsable
                            </div>
                          ) : user.createdByType === 'admin' || (user.creator && user.creator.role === 'admin') ? (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <FiShield className="mr-1" size={12} />
                              Admin
                            </div>
                          ) : user.createdByType === 'self_registration' ? (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <FiUserCheck className="mr-1" size={12} />
                              Auto-inscrit
                            </div>
                          ) : (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              <FiUser className="mr-1" size={12} />
                              Système
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <FiStar className="text-yellow-500 mr-1" />
                          <span className="font-medium">{user.overallScore || 0}</span>
                        </div>
                      </td>
                      <td className="table-cell">{getStatusBadge(user.status)}</td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => openDetailModal(user)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg mr-1"
                          title="Voir détails"
                        >
                          <FiEye />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg mr-1"
                          title="Modifier"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 p-4 border-t">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-secondary"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} sur {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}

      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        onSave={fetchUsers}
      />

      <UserDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        user={selectedUser}
      />
    </div>
  );
};

export { UserModal };
export default Users;
