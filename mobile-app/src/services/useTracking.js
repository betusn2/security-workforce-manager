/**
 * 🎣 HOOK useTracking
 * Gère le tracking GPS en continu + handler demande capture du dashboard
 */

import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import socketService from '../services/socketService';
import trackingService from '../services/trackingService';
import useAuthStore from '../services/authStore';

/**
 * À utiliser dans App.js quand l'utilisateur est connecté
 * @param {string|null} eventId - ID de l'événement courant (null si pas d'événement)
 */
const useTracking = (eventId = null) => {
  const { user, isAuthenticated } = useAuthStore();
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ─── Démarrer/Arrêter le tracking selon l'auth ───────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      trackingService.stop();
      return;
    }

    const startTracking = async () => {
      await trackingService.start(user.id, eventId);
    };
    startTracking();

    return () => {
      trackingService.stop();
    };
  }, [isAuthenticated, user?.id, eventId]);

  // ─── Écouter les demandes de capture du dashboard ────────────────
  const handleScreenshotRequest = useCallback(async (data) => {
    if (!user?.id) return;

    Alert.alert(
      '📸 Demande de capture',
      'Le responsable demande une photo de votre position. Acceptez-vous ?',
      [
        {
          text: 'Refuser',
          style: 'cancel',
          onPress: () => socketService.sendScreenshotError(user.id, 'Agent a refusé'),
        },
        {
          text: 'Accepter',
          onPress: async () => {
            try {
              // Demander permission caméra si pas accordée
              if (!cameraPermission?.granted) {
                const result = await requestCameraPermission();
                if (!result.granted) {
                  socketService.sendScreenshotError(user.id, 'Permission caméra refusée');
                  return;
                }
              }

              // Prendre la photo avec expo-camera ref
              if (cameraRef.current) {
                const photo = await cameraRef.current.takePictureAsync({
                  quality: 0.5,
                  base64: true,
                  exif: false,
                });
                const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;
                socketService.sendScreenshotResponse(user.id, imageBase64);
              } else {
                socketService.sendScreenshotError(user.id, 'Caméra non disponible');
              }
            } catch (err) {
              console.error('❌ Erreur prise de photo:', err);
              socketService.sendScreenshotError(user.id, 'Erreur caméra');
            }
          },
        },
      ]
    );
  }, [user?.id, cameraPermission, requestCameraPermission]);

  useEffect(() => {
    socketService.on('screenshot_request', handleScreenshotRequest);
    return () => socketService.off('screenshot_request', handleScreenshotRequest);
  }, [handleScreenshotRequest]);

  return { cameraRef };
};

export default useTracking;
