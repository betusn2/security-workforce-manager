/**
 * 🚨 POPUP MESSAGE OVERLAY
 * ===================================================
 * Affiche un popup plein écran quand l'admin envoie
 * un message/alerte depuis le dashboard Web.
 *
 * Écoute les événements Socket.IO :
 *   - admin:message
 *   - message:popup
 *   - admin:urgent_alert
 *
 * Affiche également les notifications push reçues
 * en premier plan via expo-notifications.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import socketService from '../services/socketService';

const { width: W, height: H } = Dimensions.get('window');

// Durée avant fermeture automatique (ms) — 0 = jamais
const AUTO_DISMISS_MS = 60000; // 60 secondes

// Patterns de vibration selon priorité
const VIBRATION_PATTERNS = {
  urgent:  [0, 300, 150, 300, 150, 500],
  high:    [0, 400, 200, 400],
  normal:  [0, 250],
};

// Couleurs selon priorité
const PRIORITY_COLORS = {
  urgent: { bg: '#7f1d1d', border: '#ef4444', badge: '#ef4444', badgeText: '#fff', icon: 'alert-circle' },
  high:   { bg: '#78350f', border: '#f59e0b', badge: '#f59e0b', badgeText: '#fff', icon: 'warning'      },
  normal: { bg: '#1e3a5f', border: '#3b82f6', badge: '#3b82f6', badgeText: '#fff', icon: 'chatbubble'   },
  info:   { bg: '#1e3a5f', border: '#3b82f6', badge: '#6b7280', badgeText: '#fff', icon: 'information-circle' },
};

export default function PopupMessageOverlay() {
  const [messages, setMessages]     = useState([]);   // queue de messages
  const [visible,  setVisible]      = useState(false);
  const [current,  setCurrent]      = useState(null);
  const scaleAnim  = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef(null);
  const progressTimer = useRef(null);

  // ── Afficher le message suivant de la queue ─────────────────────────────
  const showNext = useCallback((queue) => {
    if (queue.length === 0) return;
    const msg = queue[0];
    setCurrent(msg);
    setVisible(true);

    // Animation entrée
    scaleAnim.setValue(0.7);
    opacityAnim.setValue(0);
    progressAnim.setValue(1);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Vibration
    const pattern = VIBRATION_PATTERNS[msg.priority] || VIBRATION_PATTERNS.normal;
    Vibration.vibrate(pattern);

    // Shake si urgent
    if (msg.priority === 'urgent') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
      ]).start();
    }

    // Progress bar auto-dismiss
    if (AUTO_DISMISS_MS > 0) {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: AUTO_DISMISS_MS,
        useNativeDriver: false,
      }).start();

      dismissTimer.current = setTimeout(() => {
        dismiss(msg.id);
      }, AUTO_DISMISS_MS);
    }
  }, [scaleAnim, opacityAnim, progressAnim, shakeAnim]);

  // ── Ajouter un message à la queue ───────────────────────────────────────
  const enqueue = useCallback((msgData) => {
    const msg = {
      id:        Date.now() + Math.random(),
      title:     msgData.title     || 'Message Admin',
      body:      msgData.message   || msgData.body || '',
      priority:  msgData.priority  || 'normal',
      sender:    msgData.senderName || msgData.sender || 'Administrateur',
      targetType: msgData.targetType || 'user',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
    };

    setMessages(prev => {
      const next = [...prev, msg];
      // Si aucun popup actif, afficher immédiatement
      setVisible(v => {
        if (!v) {
          // setTimeout pour éviter mutation state dans render
          setTimeout(() => showNext(next), 0);
        }
        return v;
      });
      return next;
    });
  }, [showNext]);

  // ── Fermer le popup courant ─────────────────────────────────────────────
  const dismiss = useCallback((id) => {
    clearTimeout(dismissTimer.current);

    // Animation sortie
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setCurrent(null);
      // Passer au suivant si queue non vide
      setMessages(prev => {
        const remaining = prev.filter(m => m.id !== (id || prev[0]?.id));
        if (remaining.length > 0) {
          setTimeout(() => showNext(remaining), 300);
        }
        return remaining;
      });
    });
  }, [scaleAnim, opacityAnim, showNext]);

  // ── Socket.IO — écoute des messages admin ───────────────────────────────
  useEffect(() => {
    const handleAdminMessage    = (data) => enqueue(data);
    const handleMessagePopup    = (data) => enqueue(data);
    const handleUrgentAlert     = (data) => enqueue({ ...data, priority: 'urgent' });
    const handleNotificationNew = (data) => {
      // Afficher en popup si priority >= high
      if (data.priority === 'urgent' || data.priority === 'high') {
        enqueue({ ...data, title: data.title || 'Notification', body: data.message || data.body });
      }
    };

    socketService.on('admin:message',      handleAdminMessage);
    socketService.on('message:popup',      handleMessagePopup);
    socketService.on('admin:urgent_alert', handleUrgentAlert);
    socketService.on('notification_new',   handleNotificationNew);

    return () => {
      socketService.off('admin:message',      handleAdminMessage);
      socketService.off('message:popup',      handleMessagePopup);
      socketService.off('admin:urgent_alert', handleUrgentAlert);
      socketService.off('notification_new',   handleNotificationNew);
    };
  }, [enqueue]);

  // ── Notifications push reçues en premier plan ───────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      if (data?.popup || data?.priority === 'urgent' || data?.priority === 'high') {
        enqueue({
          title:    title || 'Message',
          body:     body || '',
          priority: data?.priority || 'high',
          sender:   data?.sender || 'Système',
        });
      }
    });
    return () => sub.remove();
  }, [enqueue]);

  if (!visible || !current) return null;

  const colors = PRIORITY_COLORS[current.priority] || PRIORITY_COLORS.normal;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      statusBarTranslucent
      onRequestClose={() => dismiss(current.id)}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.container,
            { borderColor: colors.border, backgroundColor: colors.bg },
            {
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={[styles.header, { backgroundColor: colors.badge }]}>
            <Ionicons name={colors.icon} size={22} color="#fff" />
            <Text style={styles.headerTitle}>{current.title}</Text>
            <TouchableOpacity onPress={() => dismiss(current.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ── Corps ── */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.message}>{current.body}</Text>
          </ScrollView>

          {/* ── Infos départ ── */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Ionicons name="person-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.footerText}>{current.sender}</Text>
            </View>
            <Text style={styles.footerTime}>{current.timestamp}</Text>
          </View>

          {/* ── Bouton fermer ── */}
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.badge }]} onPress={() => dismiss(current.id)}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </TouchableOpacity>

          {/* ── Barre de progression auto-dismiss ── */}
          {AUTO_DISMISS_MS > 0 && (
            <View style={styles.progressBg}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.badge },
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}

          {/* ── Badge priorité ── */}
          <View style={[styles.priorityBadge, { backgroundColor: colors.badge }]}>
            <Text style={styles.priorityText}>
              {current.priority === 'urgent' ? '🚨 URGENT' :
               current.priority === 'high'   ? '⚠️ IMPORTANT' : '💬 MESSAGE'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    maxHeight: H * 0.35,
  },
  bodyContent: {
    padding: 20,
  },
  message: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  footerTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  closeBtn: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  progressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  priorityBadge: {
    position: 'absolute',
    top: -1,
    right: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
