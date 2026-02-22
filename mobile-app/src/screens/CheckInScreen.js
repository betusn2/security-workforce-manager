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
import * as FaceDetector from 'expo-face-detector';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const CheckInScreen = ({ route, navigation }) => {
  const { event, assignment } = route.params || {};

  // States
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceData, setFaceData] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('camera'); // 'camera', 'confirm', 'success'

  const cameraRef = useRef(null);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      // Camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();

      // Location permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

      setHasPermission(cameraStatus === 'granted' && locationStatus === 'granted');

      if (locationStatus === 'granted') {
        getCurrentLocation();
      }
    })();
  }, []);

  // Get current location
  const getCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc.coords);

      // Check if within geofence of event
      if (event?.latitude && event?.longitude) {
        const dist = calculateDistance(
          loc.coords.latitude,
          loc.coords.longitude,
          parseFloat(event.latitude),
          parseFloat(event.longitude)
        );
        setDistance(Math.round(dist));
        setIsWithinGeofence(dist <= (event.geoRadius || 100));
      }
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Impossible d\'obtenir votre position');
    }
  };

  // Haversine formula for distance calculation
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Handle face detection
  const handleFacesDetected = ({ faces }) => {
    if (faces.length > 0) {
      setFaceDetected(true);
      setFaceData(faces[0]);
    } else {
      setFaceDetected(false);
      setFaceData(null);
    }
  };

  // Capture photo
  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady || !faceDetected) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      setCapturedPhoto(photo);
      setStep('confirm');
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Erreur', 'Impossible de capturer la photo');
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setStep('camera');
  };

  // Submit check-in
  const submitCheckIn = async () => {
    if (!capturedPhoto || !location) {
      Alert.alert('Erreur', 'Photo et localisation requises');
      return;
    }

    setIsSubmitting(true);

    try {
      const checkInData = {
        eventId: event?.id,
        assignmentId: assignment?.id,
        latitude: location.latitude,
        longitude: location.longitude,
        checkInPhoto: `data:image/jpeg;base64,${capturedPhoto.base64}`,
        checkInMethod: 'facial',
        isWithinGeofence: isWithinGeofence,
        distanceFromLocation: distance,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
        }
      };

      const response = await api.post('/attendance/check-in', checkInData);

      if (response.data.success) {
        setStep('success');

        // Navigate back after 2 seconds
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Erreur lors du pointage'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Permissions requises</Text>
          <Text style={styles.errorText}>
            L'accès à la caméra et à la localisation est nécessaire pour le pointage.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render loading
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // Render success
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={100} color="#10b981" />
          </View>
          <Text style={styles.successTitle}>Pointage réussi!</Text>
          <Text style={styles.successText}>
            Votre arrivée a été enregistrée à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {event && (
            <View style={styles.eventInfo}>
              <Text style={styles.eventName}>{event.name}</Text>
              <Text style={styles.eventLocation}>{event.location}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Render confirmation
  if (step === 'confirm' && capturedPhoto) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.confirmContainer}>
          {/* Captured Photo */}
          <View style={styles.photoPreview}>
            <Image
              source={{ uri: capturedPhoto.uri }}
              style={styles.previewImage}
            />
            <View style={[
              styles.faceIndicator,
              { backgroundColor: faceDetected ? '#10b981' : '#ef4444' }
            ]}>
              <Ionicons
                name={faceDetected ? 'checkmark' : 'close'}
                size={16}
                color="#fff"
              />
              <Text style={styles.faceIndicatorText}>
                {faceDetected ? 'Visage détecté' : 'Aucun visage'}
              </Text>
            </View>
          </View>

          {/* Location Info */}
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={24} color="#2563eb" />
              <Text style={styles.locationTitle}>Localisation</Text>
            </View>

            {location ? (
              <>
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Position:</Text>
                  <Text style={styles.locationValue}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                </View>

                {distance !== null && (
                  <View style={styles.locationRow}>
                    <Text style={styles.locationLabel}>Distance:</Text>
                    <Text style={[
                      styles.locationValue,
                      { color: isWithinGeofence ? '#10b981' : '#ef4444' }
                    ]}>
                      {distance}m de l'événement
                    </Text>
                  </View>
                )}

                <View style={[
                  styles.geofenceStatus,
                  { backgroundColor: isWithinGeofence ? '#dcfce7' : '#fee2e2' }
                ]}>
                  <Ionicons
                    name={isWithinGeofence ? 'checkmark-circle' : 'warning'}
                    size={20}
                    color={isWithinGeofence ? '#10b981' : '#ef4444'}
                  />
                  <Text style={[
                    styles.geofenceText,
                    { color: isWithinGeofence ? '#166534' : '#991b1b' }
                  ]}>
                    {isWithinGeofence
                      ? 'Dans la zone autorisée'
                      : `Hors zone (max ${event?.geoRadius || 100}m)`
                    }
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.locationError}>
                <Ionicons name="warning" size={20} color="#f59e0b" />
                <Text style={styles.locationErrorText}>
                  {locationError || 'Obtention de la position...'}
                </Text>
              </View>
            )}
          </View>

          {/* Event Info */}
          {event && (
            <View style={styles.eventCard}>
              <Text style={styles.eventCardTitle}>{event.name}</Text>
              <View style={styles.eventCardRow}>
                <Ionicons name="location-outline" size={16} color="#6b7280" />
                <Text style={styles.eventCardText}>{event.location}</Text>
              </View>
              <View style={styles.eventCardRow}>
                <Ionicons name="time-outline" size={16} color="#6b7280" />
                <Text style={styles.eventCardText}>
                  {event.checkInTime} - {event.checkOutTime}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={retakePhoto}
              disabled={isSubmitting}
            >
              <Ionicons name="camera-reverse" size={20} color="#6b7280" />
              <Text style={styles.retakeButtonText}>Reprendre</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!location || isSubmitting) && styles.buttonDisabled
              ]}
              onPress={submitCheckIn}
              disabled={!location || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirmer le pointage</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Warning if outside geofence */}
          {isWithinGeofence === false && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.warningText}>
                Attention: Vous êtes hors de la zone autorisée. Le pointage sera signalé.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // Render camera
  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants.Type.front}
        onCameraReady={() => setCameraReady(true)}
        onFacesDetected={handleFacesDetected}
        faceDetectorSettings={{
          mode: FaceDetector.FaceDetectorMode.fast,
          detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
          runClassifications: FaceDetector.FaceDetectorClassifications.none,
          minDetectionInterval: 100,
          tracking: true,
        }}
      >
        {/* Face Guide Overlay */}
        <View style={styles.overlay}>
          <View style={styles.topOverlay}>
            <Text style={styles.instructionText}>
              Placez votre visage dans le cadre
            </Text>
          </View>

          <View style={styles.middleOverlay}>
            <View style={styles.sideOverlay} />
            <View style={[
              styles.faceGuide,
              { borderColor: faceDetected ? '#10b981' : '#fff' }
            ]}>
              {faceDetected && (
                <View style={styles.faceDetectedBadge}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.sideOverlay} />
          </View>

          <View style={styles.bottomOverlay}>
            {/* Location Status */}
            <View style={styles.locationStatus}>
              <Ionicons
                name={location ? 'location' : 'location-outline'}
                size={20}
                color={location ? '#10b981' : '#f59e0b'}
              />
              <Text style={[
                styles.locationStatusText,
                { color: location ? '#10b981' : '#f59e0b' }
              ]}>
                {location
                  ? `Position obtenue (${distance !== null ? `${distance}m` : '...'})`
                  : 'Obtention position...'
                }
              </Text>
            </View>

            {/* Capture Button */}
            <TouchableOpacity
              style={[
                styles.captureButton,
                (!faceDetected || !cameraReady) && styles.captureButtonDisabled
              ]}
              onPress={capturePhoto}
              disabled={!faceDetected || !cameraReady}
            >
              <View style={styles.captureButtonInner}>
                <Ionicons
                  name="camera"
                  size={32}
                  color={faceDetected ? '#fff' : '#9ca3af'}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.captureHint}>
              {faceDetected
                ? 'Appuyez pour capturer'
                : 'Aucun visage détecté'
              }
            </Text>
          </View>
        </View>
      </Camera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  middleOverlay: {
    flexDirection: 'row',
    height: 280,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  faceGuide: {
    width: 220,
    height: 280,
    borderWidth: 3,
    borderRadius: 120,
    borderStyle: 'dashed',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
  },
  faceDetectedBadge: {
    backgroundColor: '#10b981',
    borderRadius: 20,
    padding: 5,
  },
  bottomOverlay: {
    flex: 1.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 30,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationStatusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    backgroundColor: '#374151',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureHint: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 15,
  },
  // Confirmation styles
  confirmContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  photoPreview: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  faceIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  faceIndicatorText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  locationLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  locationValue: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  geofenceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  geofenceText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  locationError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  locationErrorText: {
    marginLeft: 8,
    color: '#92400e',
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  eventCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  eventCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventCardText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  retakeButtonText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  confirmButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: '#92400e',
    fontSize: 13,
  },
  // Success styles
  successContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  eventInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  eventName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  eventLocation: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  // Error styles
  errorContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
});

export default CheckInScreen;
