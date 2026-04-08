/**
 * 🔔 SERVICE NOTIFICATIONS PUSH — PROFESSIONNEL
 * =============================================
 * Canaux Android (importance + son + vibration par type) :
 *   security-alerts    → Alertes urgentes (MAX, rouge, son fort)
 *   security-messages  → Messages superviseur (HIGH, bleu, son)
 *   security-checkin   → Check-in / check-out (HIGH, vert)
 *   security-battery   → Batterie (HIGH, orange)
 *   gps-tracking       → GPS silencieux (LOW, sans son)
 *
 * Fonctionnalités :
 *   - Token push Expo enregistré sur le backend
 *   - Handler foreground intelligent par priorité
 *   - scheduleLocalNotification() avec type et canal automatique
 *   - sendImmediateNotification() sans déclencheur
 *   - addNotificationTapListener() pour navigation sur tap
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PUSH_TOKEN_KEY = 'expoPushToken';

// ─── Définition des canaux Android ────────────────────────────────────────────
const CHANNELS = {
  alerts: {
    id:              'security-alerts',
    name:            'Alertes Sécurité',
    description:     'Alertes urgentes : batterie critique, sortie de zone, urgences',
    importance:      Notifications.AndroidImportance.MAX,
    vibrationPattern:[0, 250, 100, 250, 100, 500],
    sound:           'default',
    lightColor:      '#ef4444',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd:       true,
    enableVibrate:   true,
  },
  messages: {
    id:              'security-messages',
    name:            'Messages Superviseur',
    description:     'Messages et instructions du superviseur',
    importance:      Notifications.AndroidImportance.HIGH,
    vibrationPattern:[0, 200, 80, 200],
    sound:           'default',
    lightColor:      '#3b82f6',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd:       false,
    enableVibrate:   true,
  },
  checkin: {
    id:              'security-checkin',
    name:            'Check-in / Check-out',
    description:     'Confirmations de pointage et rappels',
    importance:      Notifications.AndroidImportance.HIGH,
    vibrationPattern:[0, 150, 80, 150],
    sound:           'default',
    lightColor:      '#10b981',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd:       false,
    enableVibrate:   true,
  },
  battery: {
    id:              'security-battery',
    name:            'Batterie',
    description:     'Avertissements de niveau de batterie',
    importance:      Notifications.AndroidImportance.HIGH,
    vibrationPattern:[0, 100, 80, 300],
    sound:           'default',
    lightColor:      '#f59e0b',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd:       false,
    enableVibrate:   true,
  },
  gps: {
    id:              'gps-tracking',
    name:            'Suivi GPS',
    description:     'Mises à jour silencieuses du suivi GPS',
    importance:      Notifications.AndroidImportance.LOW,
    sound:           null,
    lightColor:      '#6b7280',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    bypassDnd:       false,
    enableVibrate:   false,
  },
};

// Mappage type d'alerte → canal
const TYPE_TO_CHANNEL = {
  battery_critical:   'security-alerts',
  battery_low:        'security-battery',
  geofence_early_exit:'security-alerts',
  gps_disabled:       'security-alerts',
  network_disabled:   'security-alerts',
  inactivity:         'security-alerts',
  checkin_late:       'security-checkin',
  checkin_success:    'security-checkin',
  checkout_success:   'security-checkin',
  message:            'security-messages',
  message_urgent:     'security-alerts',
  incident:           'security-alerts',
  default:            'security-messages',
};

/**
 * Initialiser le service notification :
 * - Créer tous les canaux Android
 * - Demander la permission
 * - Enregistrer le token sur le backend
 */
export async function initNotificationService() {
  // ── Créer tous les canaux Android ────────────────────────────────────────
  if (Platform.OS === 'android') {
    for (const ch of Object.values(CHANNELS)) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name:                 ch.name,
        description:          ch.description,
        importance:           ch.importance,
        vibrationPattern:     ch.vibrationPattern,
        sound:                ch.sound,
        lightColor:           ch.lightColor,
        lockscreenVisibility: ch.lockscreenVisibility,
        bypassDnd:            ch.bypassDnd ?? false,
        enableVibrate:        ch.enableVibrate ?? true,
        showBadge:            ch.importance >= Notifications.AndroidImportance.HIGH,
      });
    }
  }

  // ── Permission notifications ─────────────────────────────────────────────
  if (!Device.isDevice) {
    console.log('📱 Simulateur — push notifications ignorées');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert:        true,
        allowBadge:        true,
        allowSound:        true,
        allowCriticalAlerts: true,
        allowProvisional:  false,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('⚠️ Notifications push non autorisées');
    return null;
  }

  // ── Token Expo Push ──────────────────────────────────────────────────────
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '5cda8a17-f9e2-4912-8559-86342ad0f264',
    });
    const token = tokenData.data;

    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (stored !== token) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      await registerTokenOnServer(token);
    }

    return token;
  } catch (err) {
    console.warn('⚠️ Impossible d\'obtenir le token push:', err?.message);
    return null;
  }
}

async function registerTokenOnServer(token) {
  try {
    await api.post('/notifications/register-push-token', {
      token,
      platform:   Platform.OS,
      deviceName: require('expo-device').deviceName || 'Mobile',
    });
  } catch (err) {
    console.warn('⚠️ Enregistrement token push échoué:', err?.message);
  }
}

/**
 * Handler global des notifications.
 * Appeler au démarrage de l'app, avant NavigationContainer.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data     = notification.request.content.data || {};
      const type     = data.type || 'default';
      const priority = data.priority || 'normal';

      const isUrgent  = priority === 'urgent' || priority === 'high'
        || type === 'battery_critical' || type === 'geofence_early_exit'
        || type === 'gps_disabled'     || type === 'incident'
        || data.popup === true;

      const channelId = TYPE_TO_CHANNEL[type] || (isUrgent ? CHANNELS.alerts.id : CHANNELS.messages.id);

      return {
        shouldShowAlert: true,
        shouldPlaySound: isUrgent,
        shouldSetBadge:  true,
        ...(Platform.OS === 'android' && { channelId }),
      };
    },
  });
}

/**
 * Listener tap de notification → navigation possible.
 * Retourne une fonction de nettoyage à appeler au unmount.
 */
export function addNotificationTapListener(callback) {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data || {};
    callback(data);
  });
  return () => sub.remove();
}

/**
 * Programmer une notification locale typée.
 * Le canal Android est choisi automatiquement selon le type.
 */
export async function scheduleLocalNotification({
  title,
  body,
  data     = {},
  type     = 'default',
  urgent   = false,
  delay    = 0,
}) {
  const channelId = TYPE_TO_CHANNEL[type]
    || (urgent ? CHANNELS.alerts.id : CHANNELS.messages.id);

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data:     { ...data, type },
      sound:    urgent || channelId !== CHANNELS.gps.id ? 'default' : null,
      priority: urgent
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
      color: urgent ? '#ef4444' : '#2563eb',
      badge: urgent ? 1 : undefined,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: delay > 0 ? { seconds: delay } : null,
  });
}

/**
 * Notification immédiate (sans trigger) — alias raccourci.
 */
export async function sendImmediateNotification({ title, body, type = 'default', urgent = false, data = {} }) {
  return scheduleLocalNotification({ title, body, data, type, urgent, delay: 0 });
}

