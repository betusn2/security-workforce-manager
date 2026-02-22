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

const CheckOutScreen = ({ route, navigation }) => {
  const { event, assignment, attendance } = route.params || {};

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
  const [step, setStep] = useState('camera'); // 'camera', 'confirm', 'summary', 'success'
  const [workSummary, setWorkSummary] = useState(null);
  const [notes, setNotes] = useState('');

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

      // Calculate work summary if we have check-in data
      if (attendance?.checkInTime) {
        calculateWorkSummary();
      }
    })();
  }, []);

  // Calculate work duration and summary
  const calculateWorkSummary = () => {
    const checkInTime = new Date(attendance.checkInTime);
    const now = new Date();
    const durationMs = now - checkInTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    setWorkSummary({
      checkInTime: checkInTime,
      checkOutTime: now,
      durationHours: hours,
      durationMinutes: minutes,
      totalHours: (durationMs / (1000 * 60 * 60)).toFixed(2),
    });
  };

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
      calculateWorkSummary();
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

  // Go to summary
  const goToSummary = () => {
    setStep('summary');
  };

  // Submit check-out
  const submitCheckOut = async () => {
    if (!capturedPhoto || !location) {
      Alert.alert('Erreur', 'Photo et localisation requises');
      return;
    }

    setIsSubmitting(true);

    try {
      const checkOutData = {
        attendanceId: attendance?.id,
        eventId: event?.id,
        assignmentId: assignment?.id,
        latitude: location.latitude,
        longitude: location.longitude,
        checkOutPhoto: `data:image/jpeg;base64,${capturedPhoto.base64}`,
        checkOutMethod: 'facial',
        isWithinGeofence: isWithinGeofence,
        distanceFromLocation: distance,
        notes: notes,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
        }
      };

      const response = await api.post(`/attendance/check-out/${attendance?.id}`, checkOutData);

      if (response.data.success) {
        setWorkSummary(prev => ({
          ...prev,
          ...response.data.data,
        }));
        setStep('success');

        // Navigate back after 3 seconds
        setTimeout(() => {
          navigation.goBack();
        }, 3000);
      }
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Erreur lors du pointage de sortie'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time
  const formatTime = (date) => {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Permissions requises</Text>
          <Text style={styles.errorText}>
            L'acces a la camera et a la localisation est necessaire pour le pointage.
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
        <ActivityIndicator size="large" color="#ef4444" />
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
            <Ionicons name="checkmark-circle" size={100} color="#ef4444" />
          </View>
          <Text style={styles.successTitle}>Depart enregistre!</Text>
          <Text style={styles.successText}>
            Votre depart a ete enregistre a {formatTime(new Date())}
          </Text>

          {/* Work Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Resume de la journee</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="log-in-outline" size={24} color="#10b981" />
                <Text style={styles.summaryLabel}>Arrivee</Text>
                <Text style={styles.summaryValue}>
                  {formatTime(workSummary?.checkInTime)}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                <Text style={styles.summaryLabel}>Depart</Text>
                <Text style={styles.summaryValue}>
                  {formatTime(workSummary?.checkOutTime)}
                </Text>
              </View>
            </View>

            <View style={styles.totalHoursContainer}>
              <Ionicons name="time" size={28} color="#2563eb" />
              <View style={styles.totalHoursText}>
                <Text style={styles.totalHoursLabel}>Temps total</Text>
                <Text style={styles.totalHoursValue}>
                  {workSummary?.durationHours}h {workSummary?.durationMinutes}min
                </Text>
              </View>
            </View>
          </View>

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

  // Render summary before confirmation
  if (step === 'summary') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Confirmer le depart</Text>
          <Text style={styles.summarySubtitle}>
            Verifiez les informations avant de valider
          </Text>

          {/* Time Summary */}
          <View style={styles.timeSummaryCard}>
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Ionicons name="log-in" size={32} color="#10b981" />
                <Text style={styles.timeLabel}>Arrivee</Text>
                <Text style={styles.timeValue}>{formatTime(workSummary?.checkInTime)}</Text>
              </View>

              <View style={styles.durationBlock}>
                <Ionicons name="arrow-forward" size={24} color="#9ca3af" />
                <Text style={styles.durationText}>
                  {workSummary?.durationHours}h {workSummary?.durationMinutes}m
                </Text>
              </View>

              <View style={styles.timeBlock}>
                <Ionicons name="log-out" size={32} color="#ef4444" />
                <Text style={styles.timeLabel}>Depart</Text>
                <Text style={styles.timeValue}>{formatTime(new Date())}</Text>
              </View>
            </View>
          </View>

          {/* Photo Preview */}
          <View style={styles.miniPhotoPreview}>
            <Image
              source={{ uri: capturedPhoto?.uri }}
              style={styles.miniPhoto}
            />
            <View style={styles.miniPhotoOverlay}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.miniPhotoText}>Photo validee</Text>
            </View>
          </View>

          {/* Location Status */}
          <View style={[
            styles.locationStatusCard,
            { backgroundColor: isWithinGeofence ? '#dcfce7' : '#fee2e2' }
          ]}>
            <Ionicons
              name={isWithinGeofence ? 'location' : 'location-outline'}
              size={24}
              color={isWithinGeofence ? '#10b981' : '#ef4444'}
            />
            <View style={styles.locationStatusContent}>
              <Text style={[
                styles.locationStatusTitle,
                { color: isWithinGeofence ? '#166534' : '#991b1b' }
              ]}>
                {isWithinGeofence ? 'Position validee' : 'Hors zone'}
              </Text>
              <Text style={styles.locationStatusDistance}>
                {distance}m de l'evenement
              </Text>
            </View>
          </View>

          {/* Event Info */}
          {event && (
            <View style={styles.eventSummaryCard}>
              <View style={styles.eventSummaryHeader}>
                <Ionicons name="calendar" size={20} color="#6b7280" />
                <Text style={styles.eventSummaryTitle}>{event.name}</Text>
              </View>
              <View style={styles.eventSummaryRow}>
                <Ionicons name="location-outline" size={16} color="#9ca3af" />
                <Text style={styles.eventSummaryText}>{event.location}</Text>
              </View>
            </View>
          )}

          {/* Notes input placeholder */}
          <TouchableOpacity
            style={styles.notesButton}
            onPress={() => {
              Alert.prompt(
                'Notes',
                'Ajoutez une note pour cette journee (optionnel)',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'OK', onPress: (text) => setNotes(text || '') }
                ],
                'plain-text',
                notes
              );
            }}
          >
            <Ionicons name="create-outline" size={20} color="#6b7280" />
            <Text style={styles.notesButtonText}>
              {notes ? notes : 'Ajouter une note (optionnel)'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('confirm')}
            >
              <Ionicons name="arrow-back" size={20} color="#6b7280" />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.buttonDisabled
              ]}
              onPress={submitCheckOut}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Valider le depart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Render confirmation (photo preview)
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
                {faceDetected ? 'Visage detecte' : 'Aucun visage'}
              </Text>
            </View>

            {/* Check-out badge */}
            <View style={styles.checkOutBadge}>
              <Ionicons name="log-out" size={16} color="#fff" />
              <Text style={styles.checkOutBadgeText}>DEPART</Text>
            </View>
          </View>

          {/* Work Duration Preview */}
          {workSummary && (
            <View style={styles.durationPreview}>
              <View style={styles.durationIcon}>
                <Ionicons name="time" size={28} color="#2563eb" />
              </View>
              <View style={styles.durationInfo}>
                <Text style={styles.durationTitle}>Duree de travail</Text>
                <Text style={styles.durationValue}>
                  {workSummary.durationHours}h {workSummary.durationMinutes}min
                </Text>
                <Text style={styles.durationSubtext}>
                  {formatTime(workSummary.checkInTime)} - {formatTime(new Date())}
                </Text>
              </View>
            </View>
          )}

          {/* Location Info */}
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={24} color="#ef4444" />
              <Text style={styles.locationTitle}>Localisation de depart</Text>
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
                      {distance}m de l'evenement
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
                      ? 'Dans la zone autorisee'
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
                (!location) && styles.buttonDisabled
              ]}
              onPress={goToSummary}
              disabled={!location}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Continuer</Text>
            </TouchableOpacity>
          </View>

          {/* Warning if outside geofence */}
          {isWithinGeofence === false && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.warningText}>
                Attention: Vous etes hors de la zone autorisee. Le pointage sera signale.
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
            {/* Check-out header */}
            <View style={styles.checkOutHeader}>
              <Ionicons name="log-out" size={24} color="#ef4444" />
              <Text style={styles.checkOutHeaderText}>POINTAGE DE DEPART</Text>
            </View>
            <Text style={styles.instructionText}>
              Placez votre visage dans le cadre
            </Text>
          </View>

          <View style={styles.middleOverlay}>
            <View style={styles.sideOverlay} />
            <View style={[
              styles.faceGuide,
              { borderColor: faceDetected ? '#ef4444' : '#fff' }
            ]}>
              {faceDetected && (
                <View style={[styles.faceDetectedBadge, { backgroundColor: '#ef4444' }]}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.sideOverlay} />
          </View>

          <View style={styles.bottomOverlay}>
            {/* Work Duration Status */}
            {workSummary && (
              <View style={styles.workDurationStatus}>
                <Ionicons name="time" size={20} color="#2563eb" />
                <Text style={styles.workDurationText}>
                  En service depuis {workSummary.durationHours}h {workSummary.durationMinutes}min
                </Text>
              </View>
            )}

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
                { backgroundColor: '#ef4444' },
                (!faceDetected || !cameraReady) && styles.captureButtonDisabled
              ]}
              onPress={capturePhoto}
              disabled={!faceDetected || !cameraReady}
            >
              <View style={styles.captureButtonInner}>
                <Ionicons
                  name="log-out"
                  size={32}
                  color={faceDetected ? '#fff' : '#9ca3af'}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.captureHint}>
              {faceDetected
                ? 'Appuyez pour enregistrer votre depart'
                : 'Aucun visage detecte'
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
  checkOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkOutHeaderText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
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
    backgroundColor: '#ef4444',
    borderRadius: 20,
    padding: 5,
  },
  bottomOverlay: {
    flex: 1.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 20,
  },
  workDurationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
  },
  workDurationText: {
    color: '#93c5fd',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
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
    backgroundColor: '#ef4444',
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
    height: 280,
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
  checkOutBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  checkOutBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  durationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  durationIcon: {
    marginRight: 12,
  },
  durationInfo: {
    flex: 1,
  },
  durationTitle: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  durationValue: {
    fontSize: 24,
    color: '#1e3a8a',
    fontWeight: '700',
  },
  durationSubtext: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2,
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
    backgroundColor: '#ef4444',
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
  // Summary styles
  summaryContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  timeSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBlock: {
    alignItems: 'center',
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 2,
  },
  durationBlock: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  durationText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  miniPhotoPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    height: 100,
  },
  miniPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  miniPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
  },
  miniPhotoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  locationStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationStatusContent: {
    marginLeft: 12,
  },
  locationStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationStatusDistance: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  eventSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  eventSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  eventSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventSummaryText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  notesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  notesButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  backButton: {
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
  backButtonText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  totalHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
  },
  totalHoursText: {
    marginLeft: 12,
  },
  totalHoursLabel: {
    fontSize: 12,
    color: '#1e40af',
  },
  totalHoursValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  eventInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
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

export default CheckOutScreen;
