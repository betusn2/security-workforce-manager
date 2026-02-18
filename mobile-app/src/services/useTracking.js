/**
 * 🎣 HOOK useTracking
 * Gère : capture caméra sur demande du dashboard
 * (le GPS background est géré dans App.js via startBackgroundTracking)
 */

import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import socketService from '../services/socketService';
import trackingService from '../services/trackingService';
import useAuthStore from '../services/authStore';

/**
 * À utiliser dans App.js quand l'utilisateur est connecté
 * Note: le GPS est géré par backgroundLocationTask.js (fonctionne écran éteint)
 * Ce hook gère uniquement la capture caméra sur demande du dashboard.
 */
const useTracking = (eventId = null) => {
  const { user, isAuthenticated } = useAuthStore();

  // ─── Tracking foreground (Socket.IO) quand app active ─────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      trackingService.stop();
      return;
    }
    trackingService.start(user.id, eventId);
    return () => trackingService.stop();
  }, [isAuthenticated, user?.id, eventId]);

  // ─── Écouter les demandes de capture du dashboard ────────────────
  const handleScreenshotRequest = useCallback(async (data) => {
    if (!user?.id) return;

    Alert.alert(
      '📸 Demande de capture',
      'Le responsable demande une photo de votre environnement. Acceptez-vous ?',
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
              // Utiliser ImagePicker (pas besoin de CameraRef)
              const ImagePicker = require('expo-image-picker');
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                socketService.sendScreenshotError(user.id, 'Permission caméra refusée');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.5,
                base64: true,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets?.[0]?.base64) {
                const imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
                socketService.sendScreenshotResponse(user.id, imageBase64);
              } else {
                socketService.sendScreenshotError(user.id, 'Capture annulée');
              }
            } catch (err) {
              console.error('❌ Erreur prise de photo:', err);
              socketService.sendScreenshotError(user.id, 'Erreur caméra');
            }
          },
        },
      ]
    );
  }, [user?.id]);

  useEffect(() => {
    socketService.on('screenshot_request', handleScreenshotRequest);
    return () => socketService.off('screenshot_request', handleScreenshotRequest);
  }, [handleScreenshotRequest]);

  return {};
};

export default useTracking;
