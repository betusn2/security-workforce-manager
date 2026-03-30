import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const IncidentReportScreen = ({ route, navigation }) => {
  const { event } = route.params || {};

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [location, setLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const cameraRef = useRef(null);

  // Incident types — valeurs correspondent exactement au ENUM backend
  const incidentTypes = [
    { id: 'security_breach',    label: 'Sécurité',  icon: 'shield' },
    { id: 'theft',              label: 'Vol',       icon: 'hand-left' },
    { id: 'vandalism',          label: 'Vandalisme',icon: 'hammer' },
    { id: 'trespassing',        label: 'Intrusion', icon: 'person-add' },
    { id: 'medical_emergency',  label: 'Médical',   icon: 'medkit' },
    { id: 'fire_alarm',         label: 'Incendie',  icon: 'flame' },
    { id: 'suspicious_activity',label: 'Suspect',   icon: 'eye' },
    { id: 'violence',           label: 'Violence',  icon: 'warning' },
    { id: 'other',              label: 'Autre',     icon: 'ellipsis-horizontal' },
  ];

  // Severity levels
  const severityLevels = [
    { id: 'low', label: 'Faible', color: '#10b981' },
    { id: 'medium', label: 'Moyen', color: '#f59e0b' },
    { id: 'high', label: 'Eleve', color: '#f97316' },
    { id: 'critical', label: 'Critique', color: '#ef4444' },
  ];

  // Get location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Get current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Acces a la localisation necessaire');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc.coords);

      // Reverse geocode for address
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (addresses.length > 0) {
          const addr = addresses[0];
          setLocationAddress(
            `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}`
          );
        }
      } catch (geocodeError) {
        console.log('Geocode error:', geocodeError);
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      setPhotos(prev => [...prev, {
        uri: photo.uri,
        base64: photo.base64,
      }]);
      setShowCamera(false);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo');
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', 'Acces a la galerie necessaire');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled) {
        setPhotos(prev => [...prev, {
          uri: result.assets[0].uri,
          base64: result.assets[0].base64,
        }]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  // Remove photo
  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Open camera
  const openCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      Alert.alert('Permission requise', 'Acces a la camera necessaire');
    }
  };

  // Validate form
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Erreur', 'Le titre est requis');
      return false;
    }
    if (!type) {
      Alert.alert('Erreur', 'Le type d\'incident est requis');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Erreur', 'La description est requise');
      return false;
    }
    return true;
  };

  // Submit incident
  const submitIncident = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const incidentData = {
        title: title.trim(),
        description: description.trim(),
        type,
        severity,
        eventId: event?.id,
        latitude: location?.latitude,
        longitude: location?.longitude,
        location: locationAddress || 'Adresse inconnue', // champ 'location' attendu par le modèle
        photos: photos.length > 0
          ? photos.map(p => ({ uri: p.uri, base64: p.base64 ? `data:image/jpeg;base64,${p.base64}` : undefined }))
          : undefined,
      };

      const response = await api.post('/incidents', incidentData);

      if (response.data.success) {
        Alert.alert(
          'Incident signale',
          'Votre signalement a ete enregistre avec succes.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            }
          ]
        );
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Erreur lors du signalement'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // SOS Emergency
  const sendSOS = () => {
    Alert.alert(
      'ALERTE SOS',
      'Confirmer l\'envoi d\'une alerte d\'urgence?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'CONFIRMER',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/incidents/sos', {
                latitude: location?.latitude,
                longitude: location?.longitude,
                eventId: event?.id,
              });
              Alert.alert('Alerte envoyee', 'Les superviseurs ont ete alertes');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'envoyer l\'alerte');
            }
          }
        }
      ]
    );
  };

  // Render camera view
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={Camera.Constants.Type.back}
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePhoto}
                disabled={!cameraReady}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </Camera>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Signaler un incident</Text>
        <TouchableOpacity style={styles.sosButton} onPress={sendSOS}>
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Event Info */}
        {event && (
          <View style={styles.eventCard}>
            <Ionicons name="calendar" size={18} color="#6b7280" />
            <Text style={styles.eventName}>{event.name}</Text>
          </View>
        )}

        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Personne suspecte detectee"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Type Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type d'incident *</Text>
          <View style={styles.typeGrid}>
            {incidentTypes.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.typeButton,
                  type === t.id && styles.typeButtonActive
                ]}
                onPress={() => setType(t.id)}
              >
                <Ionicons
                  name={t.icon}
                  size={20}
                  color={type === t.id ? '#fff' : '#6b7280'}
                />
                <Text style={[
                  styles.typeLabel,
                  type === t.id && styles.typeLabelActive
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gravite *</Text>
          <View style={styles.severityRow}>
            {severityLevels.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.severityButton,
                  { borderColor: s.color },
                  severity === s.id && { backgroundColor: s.color }
                ]}
                onPress={() => setSeverity(s.id)}
              >
                <Text style={[
                  styles.severityLabel,
                  { color: s.color },
                  severity === s.id && { color: '#fff' }
                ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Decrivez l'incident en detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        {/* Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Localisation</Text>
          <View style={styles.locationCard}>
            <Ionicons name="location" size={20} color="#2563eb" />
            <View style={styles.locationInfo}>
              {location ? (
                <>
                  <Text style={styles.locationAddress}>
                    {locationAddress || 'Adresse en cours...'}
                  </Text>
                  <Text style={styles.locationCoords}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                </>
              ) : (
                <Text style={styles.locationLoading}>
                  Obtention de la position...
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={getCurrentLocation}>
              <Ionicons name="refresh" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photos */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Photos (optionnel)</Text>
          <View style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}

            {photos.length < 5 && (
              <View style={styles.addPhotoButtons}>
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={openCamera}
                >
                  <Ionicons name="camera" size={24} color="#6b7280" />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={24} color="#6b7280" />
                  <Text style={styles.addPhotoText}>Galerie</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={styles.photoHint}>
            Maximum 5 photos. Les photos aident a documenter l'incident.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled
          ]}
          onPress={submitIncident}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Envoyer le signalement</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setType('security_breach');
              setSeverity('high');
              setTitle('Alerte securite urgente');
            }}
          >
            <Ionicons name="shield" size={20} color="#ef4444" />
            <Text style={styles.quickActionText}>Alerte securite</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setType('medical_emergency');
              setSeverity('critical');
              setTitle('Urgence medicale');
            }}
          >
            <Ionicons name="medkit" size={20} color="#ef4444" />
            <Text style={styles.quickActionText}>Urgence medicale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setType('fire_alarm');
              setSeverity('critical');
              setTitle('Alerte incendie');
            }}
          >
            <Ionicons name="flame" size={20} color="#ef4444" />
            <Text style={styles.quickActionText}>Incendie</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  sosButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sosText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  eventName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: '#fff',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  severityLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 10,
  },
  locationAddress: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  locationCoords: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  locationLoading: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  photoHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
  },
  quickActionText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeCameraButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
});

export default IncidentReportScreen;
