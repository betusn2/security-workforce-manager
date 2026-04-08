/**
 * 🎭 AUTO FACIAL CHECK-IN COMPONENT
 * ===================================================
 * Reconnaissance Faciale AUTOMATIQUE — 0 clic requis.
 *
 * Workflow :
 *  1. Ouvre caméra frontale automatiquement
 *  2. Affiche cadre de guidage visage
 *  3. Compte à rebours 3 → 0 → capture automatique
 *  4. Envoie photo au backend /api/face-recognition/verify
 *  5. Affiche score avec couleur (vert/orange/rouge)
 *  6. Si score >= 50% → succès → callback onSuccess
 *  7. Si score < 50%  → échec  → retry (max 3 tentatives)
 *  8. Si 3 échecs     → bloque et appelle onMaxAttempts
 *
 * Props :
 *   userId      : ID de l'utilisateur
 *   onSuccess   : (score, photo) => void
 *   onMaxAttempts : () => void
 *   onCancel    : () => void
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { facialAPI } from '../services/api';

const { width: W, height: H } = Dimensions.get('window');

// ── Config ───────────────────────────────────────────────────────────────
const COUNTDOWN_SEC   = 3;   // compte à rebours avant capture
const MIN_SCORE       = 50;  // score minimum pour valider (%)
const MAX_ATTEMPTS    = 3;   // tentatives max avant blocage
const RETRY_DELAY_MS  = 2000; // délai avant nouvelle tentative

// ── Score card ───────────────────────────────────────────────────────────
function ScoreCard({ score, status }) {
  const color = score >= 70 ? '#10b981' : score >= MIN_SCORE ? '#f59e0b' : '#ef4444';
  const icon  = score >= MIN_SCORE ? 'checkmark-circle' : 'close-circle';
  const label = score >= 70 ? 'Excellente correspondance'
              : score >= MIN_SCORE ? 'Correspondance acceptable'
              : 'Correspondance insuffisante';
  return (
    <View style={[styles.scoreCard, { borderColor: color }]}>
      <Ionicons name={icon} size={40} color={color} />
      <Text style={[styles.scoreValue, { color }]}>{score}%</Text>
      <Text style={styles.scoreLabel}>Score de correspondance</Text>
      <Text style={[styles.scoreDesc, { color }]}>{label}</Text>
      <View style={[styles.scoreBar, { backgroundColor: `${color}33` }]}>
        <View style={[styles.scoreBarFill, { width: `${Math.min(score, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Face guide overlay ───────────────────────────────────────────────────
function FaceGuide({ countdown, isCapturing }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    if (isCapturing) {
      Animated.sequence([
        Animated.timing(borderOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(borderOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(borderOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(borderOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isCapturing]);

  return (
    <View style={styles.guideContainer}>
      <Animated.View
        style={[
          styles.faceGuide,
          {
            transform: [{ scale: pulse }],
            opacity: borderOpacity,
          },
        ]}
      >
        {/* Coins du cadre */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* Compte à rebours */}
        {countdown > 0 && (
          <Animated.Text style={styles.countdown}>{countdown}</Animated.Text>
        )}
        {countdown === 0 && !isCapturing && (
          <Ionicons name="camera" size={36} color="#10b981" />
        )}
        {isCapturing && (
          <ActivityIndicator size="large" color="#fff" />
        )}
      </Animated.View>
    </View>
  );
}

// ── Composant principal ─────────────────────────────────────────────────
export default function AutoFacialCheckIn({ userId, onSuccess, onMaxAttempts, onCancel }) {
  const [permission, setPermission]     = useState(null);
  const [phase,      setPhase]          = useState('init'); // init|countdown|capturing|verifying|result|blocked
  const [countdown,  setCountdown]      = useState(COUNTDOWN_SEC);
  const [attempts,   setAttempts]       = useState(0);
  const [score,      setScore]          = useState(null);
  const [verified,   setVerified]       = useState(false);
  const [errorMsg,   setErrorMsg]       = useState('');
  const cameraRef   = useRef(null);
  const cameraReady = useRef(false);
  const countdownRef = useRef(null);

  // ── 1. Demander permission caméra dès le montage ──────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status === 'granted');
      if (status === 'granted') {
        // Court délai pour laisser la caméra s'initialiser
        setTimeout(() => startCountdown(), 800);
      }
    })();
    return () => clearInterval(countdownRef.current);
  }, []);

  // ── 2. Compte à rebours ──────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(COUNTDOWN_SEC);
    let remaining = COUNTDOWN_SEC;
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        captureAndVerify();
      }
    }, 1000);
  }, []);

  // ── 3. Capture automatique ───────────────────────────────────────────
  const captureAndVerify = useCallback(async () => {
    setPhase('capturing');
    try {
      if (!cameraRef.current) throw new Error('Caméra non disponible');

      // Prendre la photo
      const raw = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: Platform.OS === 'android',
      });

      // Redimensionner (640px max) pour économiser bande passante
      const compressed = await ImageManipulator.manipulateAsync(
        raw.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      setPhase('verifying');
      await verifyFace(compressed);
    } catch (err) {
      console.error('Erreur capture:', err);
      setErrorMsg('Erreur lors de la capture. Réessayez.');
      setPhase('result');
      setScore(0);
    }
  }, []);

  // ── 4. Vérification côté backend ─────────────────────────────────────
  const verifyFace = useCallback(async (compressed) => {
    try {
      const res = await facialAPI.verifyCheckin({
        userId,
        photo: `data:image/jpeg;base64,${compressed.base64}`,
      });

      const data      = res.data?.data || res.data;
      const rawScore  = data?.score ?? data?.similarity ?? data?.confidence ?? 0;
      const pct       = typeof rawScore === 'number'
        ? (rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore))
        : 0;

      setScore(pct);
      setVerified(pct >= MIN_SCORE);
      setPhase('result');

      if (pct >= MIN_SCORE) {
        // Succès — appeler callback après 1.5s pour laisser l'animation
        setTimeout(() => onSuccess(pct, compressed), 1500);
      } else {
        // Échec — préparer re-tentative
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setPhase('blocked');
          setTimeout(() => onMaxAttempts?.(), 2000);
        }
        // Sinon retry button visible dans render
      }
    } catch (err) {
      console.error('Erreur vérification faciale:', err);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const msg = err.response?.data?.message || 'Vérification impossible. Vérifiez votre connexion.';
      setErrorMsg(msg);
      setScore(0);
      setPhase('result');
      if (newAttempts >= MAX_ATTEMPTS) {
        setPhase('blocked');
        setTimeout(() => onMaxAttempts?.(), 2000);
      }
    }
  }, [userId, attempts, onSuccess, onMaxAttempts]);

  // ── Retry ────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setScore(null);
    setErrorMsg('');
    setVerified(false);
    // Délai avant relancement
    setTimeout(() => startCountdown(), RETRY_DELAY_MS);
  }, [startCountdown]);

  // ── Render ───────────────────────────────────────────────────────────
  if (permission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off-outline" size={48} color="#ef4444" />
        <Text style={styles.permissionTitle}>Caméra non autorisée</Text>
        <Text style={styles.permissionText}>
          Autorisez l'accès à la caméra dans les paramètres pour effectuer la reconnaissance faciale.
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Écran bloqué après 3 échecs
  if (phase === 'blocked') {
    return (
      <View style={styles.blockedContainer}>
        <Ionicons name="lock-closed" size={56} color="#ef4444" />
        <Text style={styles.blockedTitle}>Accès refusé</Text>
        <Text style={styles.blockedText}>Nombre maximum de tentatives atteint.</Text>
        <Text style={styles.blockedSubText}>
          Contactez votre superviseur ou essayez ultérieurement.
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* ── Caméra frontale ── */}
      {(phase === 'countdown' || phase === 'capturing' || phase === 'init') && (
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={CameraType.front}
            onCameraReady={() => { cameraReady.current = true; }}
            ratio="4:3"
          />
          <FaceGuide countdown={countdown} isCapturing={phase === 'capturing'} />

          {/* Barre info dessus */}
          <View style={styles.infoBar}>
            <Ionicons name="scan-outline" size={16} color="#fff" />
            <Text style={styles.infoBarText}>
              {phase === 'countdown'
                ? `Capture automatique dans ${countdown}s...`
                : phase === 'capturing'
                ? 'Capture en cours...'
                : 'Préparation...'}
            </Text>
          </View>

          {/* Tentatives restantes */}
          <View style={styles.attemptsBar}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <View
                key={i}
                style={[styles.attemptDot, i < attempts && styles.attemptDotUsed]}
              />
            ))}
            <Text style={styles.attemptsText}>{MAX_ATTEMPTS - attempts} tentative(s) restante(s)</Text>
          </View>

          {/* Bouton annuler */}
          <TouchableOpacity style={styles.floatCancel} onPress={() => { clearInterval(countdownRef.current); onCancel?.(); }}>
            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Vérification en cours ── */}
      {phase === 'verifying' && (
        <View style={styles.verifyingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.verifyingText}>Vérification du visage en cours...</Text>
          <Text style={styles.verifyingSubText}>Comparaison avec la base de données</Text>
        </View>
      )}

      {/* ── Résultat ── */}
      {phase === 'result' && (
        <View style={styles.resultContainer}>
          <ScoreCard score={score ?? 0} />

          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : null}

          {!verified && attempts < MAX_ATTEMPTS && (
            <View style={styles.retrySection}>
              <Text style={styles.retryInfo}>
                Tentative {attempts}/{MAX_ATTEMPTS} — {MAX_ATTEMPTS - attempts} restante(s)
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {verified && (
            <View style={styles.successSection}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.successText}>Identité vérifiée !</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelSmall} onPress={onCancel}>
            <Text style={styles.cancelSmallText}>Annuler le pointage facial</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const GUIDE_SIZE = Math.min(W * 0.6, 220);

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0f172a' },

  // Caméra
  cameraContainer: { flex: 1, position: 'relative' },
  camera:          { flex: 1 },

  // Guide visage
  guideContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  faceGuide: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE * 1.25,
    borderRadius: GUIDE_SIZE * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10b981',
    borderWidth: 3,
  },
  cornerTL: { top: 0,  left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0,  right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0,   borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0,   borderBottomRightRadius: 6 },
  countdown: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },

  // Barre info
  infoBar: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
  },
  infoBarText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Tentatives
  attemptsBar: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  attemptDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  attemptDotUsed: { backgroundColor: '#ef4444' },
  attemptsText:   { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  // Bouton annuler flottant
  floatCancel: { position: 'absolute', top: 16, right: 16 },

  // Vérification
  verifyingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32,
  },
  verifyingText:    { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  verifyingSubText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },

  // Résultat
  resultContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16,
  },
  scoreCard: {
    width: '100%', maxWidth: 320,
    backgroundColor: '#1e293b',
    borderRadius: 16, borderWidth: 2,
    padding: 24, alignItems: 'center', gap: 8,
  },
  scoreValue: { fontSize: 52, fontWeight: '900' },
  scoreLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  scoreDesc:  { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  scoreBar:   { width: '100%', height: 8, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  scoreBarFill: { height: 8, borderRadius: 4 },

  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },

  retrySection: { alignItems: 'center', gap: 8 },
  retryInfo:    { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  successSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText:    { color: '#10b981', fontSize: 16, fontWeight: '700' },

  cancelSmall: { marginTop: 8 },
  cancelSmallText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecorationLine: 'underline' },

  // Permission refusée
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32, backgroundColor: '#0f172a' },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  permissionText:  { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },

  // Bloqué
  blockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32, backgroundColor: '#0f172a' },
  blockedTitle:     { color: '#ef4444', fontSize: 24, fontWeight: '900' },
  blockedText:      { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  blockedSubText:   { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },

  cancelBtn: {
    marginTop: 16, backgroundColor: '#374151', borderRadius: 10,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  cancelText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
