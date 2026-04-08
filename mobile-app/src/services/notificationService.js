/**
 * 🔔 SERVICE NOTIFICATIONS PUSH
 * ===================================================
 * Gère :
 *  - Enregistrement du token FCM/Expo sur le serveur
 *  - Réception des notifications push en background
 *  - Relay vers PopupMessageOverlay si urgente
 *  - Canal notification Android (haute priorité)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PUSH_TOKEN_KEY = 'expoPushToken';
const CHANNEL_ID     = 'security-guard-alerts';

/**
 * Initialiser le service notification :
 * - Créer le canal Android haute priorité
 * - Demander la permission
 * - Enregistrer le token sur le backend
 */
export async function initNotificationService() {
  // ── Canal Android haute priorité ─────────────────────────────────────
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alertes Security',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250, 150, 500],
      sound: 'default',
      lightColor: '#ef4444',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });

    // Canal pour tracking GPS (discret)
    await Notifications.setNotificationChannelAsync('gps-tracking', {
      name: 'Suivi GPS',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      showBadge: false,
    });
  }

  // ── Permission notifications ──────────────────────────────────────────
  if (!Device.isDevice) {
    console.log('📱 Simulateur — push notifications ignorées');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('⚠️ Notifications push non autorisées');
    return null;
  }

  // ── Récupérer le token Expo Push ──────────────────────────────────────
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '5cda8a17-f9e2-4912-8559-86342ad0f264', // depuis eas.json
    });
    const token = tokenData.data;
    console.log('🔔 Push token Expo:', token);

    // Vérifier si déjà enregistré
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (stored !== token) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      // Envoyer au backend
      await registerTokenOnServer(token);
    }

    return token;
  } catch (err) {
    console.warn('⚠️ Impossible d\'obtenir le token push:', err?.message);
    return null;
  }
}

/**
 * Envoyer le token push au backend pour stocker
 * dans la table users ou push_tokens.
 */
async function registerTokenOnServer(token) {
  try {
    await api.post('/notifications/register-push-token', {
      token,
      platform: Platform.OS,
      deviceName: require('expo-device').deviceName || 'Mobile',
    });
    console.log('✅ Token push enregistré sur le serveur');
  } catch (err) {
    // Non-fatal: l'app fonctionne sans push token enregistré
    console.warn('⚠️ Enregistrement token push échoué:', err?.message);
  }
}

/**
 * Configurer le handler global des notifications.
 * À appeler au démarrage de l'app (avant NavigationContainer).
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data     = notification.request.content.data || {};
      const priority = data.priority || 'normal';

      // Notifications urgentes/admin : afficher en premier plan avec son
      const isUrgent = priority === 'urgent' || priority === 'high' || data.popup;

      return {
        shouldShowAlert: true,
        shouldPlaySound: isUrgent,
        shouldSetBadge:  true,
        // Canal Android selon priorité
        ...(Platform.OS === 'android' && {
          channelId: isUrgent ? CHANNEL_ID : 'gps-tracking',
        }),
      };
    },
  });
}

/**
 * Programmer une notification locale (ex: alerte batterie, sortie zone).
 */
export async function scheduleLocalNotification({
  title,
  body,
  data     = {},
  urgent   = false,
  delay    = 0, // secondes
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound:    urgent ? 'default' : null,
      priority: urgent
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.DEFAULT,
      color:    urgent ? '#ef4444' : '#2563eb',
      ...(Platform.OS === 'android' && {
        channelId: urgent ? CHANNEL_ID : 'gps-tracking',
      }),
    },
    trigger: delay > 0 ? { seconds: delay } : null,
  });
}
