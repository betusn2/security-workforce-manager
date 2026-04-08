/**
 * 🎭 AUTO FACIAL CHECK-IN COMPONENT — v2 (Guide Temps Réel)
 * ===================================================
 * Reconnaissance Faciale AUTOMATIQUE — 0 clic requis.
 * Interface guidée en temps réel comme la version web.
 *
 * Workflow :
 *  1. Ouvre caméra frontale automatiquement
 *  2. Affiche cadre OVALE de guidage avec messages dynamiques
 *  3. Compte à rebours 3 → 0 → capture automatique
 *  4. Envoie photo au backend /api/face-recognition/verify
 *  5. Affiche score avec couleur (vert/orange/rouge)
 *  6. Si score >= 50% → succès → callback onSuccess
 *  7. Si score < 50%  → échec  → retry (max 3 tentatives)
 *  8. Si 3 échecs     → bloque et appelle onMaxAttempts
 *
 * Props :
 *   userId        : ID de l'utilisateur
 *   onSuccess     : (score, photo) => void
 *   onMaxAttempts : () => void
 *   onCancel      : () => void
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
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { facialAPI } from '../services/api';

const { width: W, height: H } = Dimensions.get('window');

// ── Config ────────────────────────────────────────────────────────────────
const COUNTDOWN_SEC  = 3;
const MIN_SCORE      = 50;
const MAX_ATTEMPTS   = 3;
const RETRY_DELAY_MS = 2000;

// Ovale centré, adapté à l'écran
const OVAL_W = Math.round(W * 0.62);
const OVAL_H = Math.round(OVAL_W * 1.3);

// ── Phases de guidage ─────────────────────────────────────────────────────
const GUIDE_PHASES = [
  { color: '#ef4444', icon: 'scan-outline',     msg: "Placez votre visage dans le cadre"  },
  { color: '#f59e0b', icon: 'eye-outline',       msg: 'Centrez et regardez la caméra'      },
  { color: '#eab308', icon: 'body-outline',      msg: 'Restez parfaitement immobile...'    },
  { color: '#10b981', icon: 'checkmark-circle',  msg: 'Parfait ! Capture en cours...'      },
];

// ── Score Card ────────────────────────────────────────────────────────────
function ScoreCard({ score }) {
  const color = score >= 70 ? '#10b981' : score >= MIN_SCORE ? '#f59e0b' : '#ef4444';
  const icon  = score >= MIN_SCORE ? 'checkmark-circle' : 'close-circle';
  const label = score >= 70  ? 'Excellente correspondance'
              : score >= MIN_SCORE ? 'Correspondance acceptable'
              : 'Correspondance insuffisante';
  return (
    <View style={[styles.scoreCard, { borderColor: color }]}>
      <Ionicons name={icon} size={44} color={color} />
      <Text style={[styles.scoreValue, { color }]}>{score}%</Text>
      <Text style={styles.scoreLabel}>Score de correspondance</Text>
      <Text style={[styles.scoreDesc, { color }]}>{label}</Text>
      <View style={[styles.scoreBar, { backgroundColor: `${color}33` }]}>
        <View style={[styles.scoreBarFill, { width: `${Math.min(score, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Face Guide Overlay centré ─────────────────────────────────────────────
function FaceGuide({ countdown, isCapturing }) {
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0.5)).current;
  const msgOpacity = useRef(new Animated.Value(1)).current;
  const flashAnim  = useRef(new Animated.Value(1)).current;

  const phaseIdx = isCapturing ? 3 : Math.max(0, Math.min(3, COUNTDOWN_SEC - countdown));
  const phase    = GUIDE_PHASES[phaseIdx];

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    if (phaseIdx === 3) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1,   duration: 300, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0.5);
    }
  }, [phaseIdx]);

  useEffect(() => {
    if (isCapturing) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.1, duration: 80,  useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1,   duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [isCapturing]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(msgOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(msgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [phaseIdx]);

  // Vignette hors-ovale : 4 zones sombres (haut, bas, gauche, droite)
  // Chaque zone est positionnée de façon absolue autour de l'ovale centré
  const ovalTop  = (H - OVAL_H) / 2 - 60; // décalé légèrement vers le haut
  const ovalLeft = (W - OVAL_W) / 2;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: flashAnim }]} pointerEvents="none">

      {/* Zone sombre HAUT */}
      <View style={[styles.vigZone, { top: 0, left: 0, right: 0, height: ovalTop }]} />

      {/* Zone sombre BAS */}
      <View style={[styles.vigZone, {
        top: ovalTop + OVAL_H, left: 0, right: 0, bottom: 0,
        justifyContent: 'flex-start', alignItems: 'center', paddingTop: 14,
      }]}>
        {/* Message de guidage */}
        <Animated.View style={[styles.guidanceRow, { opacity: msgOpacity }]}>
          <Ionicons name={phase.icon} size={16} color={phase.color} style={{ marginRight: 6 }} />
          <Text style={[styles.guidanceMsg, { color: phase.color }]}>{phase.msg}</Text>
        </Animated.View>

        {/* Dots de phase */}
        <View style={styles.phaseDotsRow}>
          {GUIDE_PHASES.map((p, i) => (
            <View key={i} style={[
              styles.phaseDot,
              { backgroundColor: i <= phaseIdx ? p.color : 'rgba(255,255,255,0.2)', width: i === phaseIdx ? 20 : 8 },
            ]} />
          ))}
        </View>

        <Text style={styles.lightingTip}>Bonne lumière • 30-60 cm • Visage dégagé</Text>
      </View>

      {/* Zone sombre GAUCHE */}
      <View style={[styles.vigZone, { top: ovalTop, left: 0, width: ovalLeft, height: OVAL_H }]} />

      {/* Zone sombre DROITE */}
      <View style={[styles.vigZone, { top: ovalTop, right: 0, left: ovalLeft + OVAL_W, height: OVAL_H }]} />

      {/* Cadre ovale centré */}
      <Animated.View style={[
        styles.ovalOuter,
        {
          position: 'absolute',
          top: ovalTop, left: ovalLeft,
          width: OVAL_W, height: OVAL_H,
          borderColor: phase.color,
          transform: [{ scale: pulseAnim }],
        },
      ]}>
        {/* Anneau halo */}
        <Animated.View style={[
          styles.ovalGlow,
          { borderColor: phase.color, opacity: glowAnim },
        ]} />

        {/* Compteur ou icône */}
        {!isCapturing && countdown > 0 && (
          <Text style={styles.countdownNum}>{countdown}</Text>
        )}
        {!isCapturing && countdown === 0 && (
          <Ionicons name="camera" size={36} color="#10b981" />
        )}
        {isCapturing && <ActivityIndicator size="large" color="#fff" />}
      </Animated.View>
    </Animated.View>
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

  // Refs pour éviter les stale closures (useCallback avec [] deps)
  const userIdRef   = useRef(userId);
  const attemptsRef = useRef(0);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);

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

      // Attendre que la caméra soit prête (Android)
      if (!cameraReady.current) {
        await new Promise(resolve => setTimeout(resolve, 700));
      }

      // Prendre la photo — NE PAS utiliser skipProcessing sur Android
      // (évite les images tournées 90° qui bloquent la détection CompreFace)
      const raw = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: false,
      });

      // Redimensionner à 800px (résolution suffisante pour CompreFace)
      // compress: 0.88 conserve la qualité faciale nécessaire
      const compressed = await ImageManipulator.manipulateAsync(
        raw.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG, base64: true }
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
    // Lire depuis les refs pour avoir les valeurs ACTUELLES (évite stale closure)
    const currentUserId  = userIdRef.current;
    const currentAttempts = attemptsRef.current;

    console.log('[FacialVerif] userId=', currentUserId, 'attempts=', currentAttempts);

    if (!currentUserId) {
      console.error('[FacialVerif] userId null — impossible de vérifier');
      setErrorMsg('Session expirée — veuillez vous reconnecter.');
      setScore(0);
      setPhase('result');
      return;
    }

    try {
      const res = await facialAPI.verifyCheckin({
        userId: currentUserId,
        image: `data:image/jpeg;base64,${compressed.base64}`,
      });

      const data      = res.data?.data || res.data;
      const rawScore  = data?.score ?? data?.similarity ?? data?.confidence ?? 0;
      const pct       = typeof rawScore === 'number'
        ? (rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore))
        : 0;

      console.log('[FacialVerif] score=', pct, 'faceDetected=', data?.faceDetected, 'errorCode=', data?.errorCode);

      // Cas spécial : aucun visage détecté dans l'image
      if (data?.errorCode === 'NO_FACE' || (!data?.faceDetected && pct === 0)) {
        setErrorMsg('Aucun visage détecté — repositionnez-vous et améliorez l\'éclairage.');
      }

      setScore(pct);
      setVerified(pct >= MIN_SCORE);
      setPhase('result');

      if (pct >= MIN_SCORE) {
        // Succès — appeler callback après 1.5s pour laisser l'animation
        setTimeout(() => onSuccess(pct, compressed), 1500);
      } else {
        // Échec — préparer re-tentative
        const newAttempts = currentAttempts + 1;
        setAttempts(newAttempts);
        attemptsRef.current = newAttempts;
        if (newAttempts >= MAX_ATTEMPTS) {
          setPhase('blocked');
          setTimeout(() => onMaxAttempts?.(), 2000);
        }
        // Sinon retry button visible dans render
      }
    } catch (err) {
      console.error('Erreur vérification faciale:', err);
      console.error('Response data:', err.response?.data);

      const errorCode = err.response?.data?.errorCode;
      const debugMsg  = err.response?.data?.debug || '';

      // SERVICE_UNAVAILABLE = serveur en démarrage → retry auto sans consommer une tentative
      if (err.response?.status === 503 || errorCode === 'SERVICE_UNAVAILABLE') {
        setErrorMsg('Serveur en cours de démarrage… Nouvelle tentative dans 5s');
        setScore(null);
        setPhase('result');
        setTimeout(() => {
          setScore(null);
          setErrorMsg('');
          setPhase('init');
          setTimeout(() => startCountdown(), 500);
        }, 5000);
        return;
      }

      const newAttempts = currentAttempts + 1;
      setAttempts(newAttempts);
      attemptsRef.current = newAttempts;
      const msg = err.response?.data?.message || 'Vérification impossible. Vérifiez votre connexion.';
      setErrorMsg(debugMsg ? `${msg} (${debugMsg})` : msg);
      setScore(0);
      setPhase('result');
      if (newAttempts >= MAX_ATTEMPTS) {
        setPhase('blocked');
        setTimeout(() => onMaxAttempts?.(), 2000);
      }
    }
  }, [onSuccess, onMaxAttempts]);

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
            style={StyleSheet.absoluteFill}
            type={CameraType.front}
            onCameraReady={() => { cameraReady.current = true; }}
          />
          <FaceGuide countdown={countdown} isCapturing={phase === 'capturing'} />

          {/* ── Barre supérieure : titre + statut ── */}
          <View style={styles.infoBar}>
            <View style={styles.infoBarLeft}>
              <Ionicons name="person-circle-outline" size={18} color="#93c5fd" />
              <Text style={styles.infoBarTitle}>Reconnaissance Faciale</Text>
            </View>
            <View style={styles.infoBarRight}>
              <View style={[styles.statusDot, {
                backgroundColor: phase === 'capturing' ? '#f59e0b'
                               : phase === 'countdown'  ? '#10b981'
                               : '#64748b',
              }]} />
              <Text style={styles.infoBarStatus}>
                {phase === 'capturing' ? 'Capture...'
                : phase === 'countdown' ? `${countdown}s`
                : 'Prêt'}
              </Text>
            </View>
          </View>

          {/* ── Barre tentatives (bas) ── */}
          <View style={styles.attemptsBar}>
            <View style={styles.attemptDotsRow}>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <View key={i} style={[styles.attemptDot, i < attempts && styles.attemptDotUsed]} />
              ))}
            </View>
            <Text style={styles.attemptsText}>
              {MAX_ATTEMPTS - attempts} tentative{MAX_ATTEMPTS - attempts > 1 ? 's' : ''} restante{MAX_ATTEMPTS - attempts > 1 ? 's' : ''}
            </Text>
          </View>

          {/* ── Bouton annuler ── */}
          <TouchableOpacity
            style={styles.floatCancel}
            onPress={() => { clearInterval(countdownRef.current); onCancel?.(); }}
          >
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

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0f172a' },

  // ── Caméra ──────────────────────────────────────────────────────────
  cameraContainer: { flex: 1, position: 'relative', backgroundColor: '#000' },

  // ── Vignette zones sombres (positionnées absolument autour de l'ovale) ──
  vigZone: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  // ── Ovale centré ────────────────────────────────────────────────────
  ovalOuter: {
    borderRadius: 1000,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  ovalGlow: {
    position: 'absolute',
    width: OVAL_W + 18,
    height: OVAL_H + 18,
    borderRadius: 1000,
    borderWidth: 2.5,
    opacity: 0.5,
  },

  // Chiffre du compte à rebours
  countdownNum: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },

  // ── Messages de guidage ──────────────────────────────────────────────
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  guidanceMsg: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Points de phase
  phaseDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  phaseDot: {
    height: 8,
    borderRadius: 4,
  },

  lightingTip: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },

  // ── Barre supérieure (info) ──────────────────────────────────────────
  infoBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  infoBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBarTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginLeft: 4 },
  infoBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBarStatus:{ color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },

  // ── Barre tentatives ────────────────────────────────────────────────
  attemptsBar: {
    position: 'absolute',
    bottom: 10, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  attemptDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attemptDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981' },
  attemptDotUsed: { backgroundColor: '#ef4444' },
  attemptsText:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

  // ── Bouton annuler flottant ──────────────────────────────────────────
  floatCancel: { position: 'absolute', top: 12, right: 12 },

  // ── Vérification en cours ───────────────────────────────────────────
  verifyingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32,
  },
  verifyingText:    { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  verifyingSubText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center' },

  // ── Résultat ─────────────────────────────────────────────────────────
  resultContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 14,
  },
  scoreCard: {
    width: '100%', maxWidth: 320,
    backgroundColor: '#1e293b',
    borderRadius: 16, borderWidth: 2,
    padding: 24, alignItems: 'center', gap: 8,
  },
  scoreValue: { fontSize: 56, fontWeight: '900' },
  scoreLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  scoreDesc:  { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  scoreBar:   { width: '100%', height: 10, borderRadius: 5, marginTop: 8, overflow: 'hidden' },
  scoreBarFill: { height: 10, borderRadius: 5 },

  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },

  retrySection: { alignItems: 'center', gap: 10 },
  retryInfo:    { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  successSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText:    { color: '#10b981', fontSize: 16, fontWeight: '700' },

  cancelSmall:     { marginTop: 8 },
  cancelSmallText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecorationLine: 'underline' },

  // ── Bouton annuler ───────────────────────────────────────────────────
  cancelBtn: {
    backgroundColor: '#334155', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  cancelText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Permission refusée ───────────────────────────────────────────────
  permissionContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 16, padding: 32, backgroundColor: '#0f172a',
  },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  permissionText:  { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },

  // ── Bloqué ───────────────────────────────────────────────────────────
  blockedContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 12, padding: 32, backgroundColor: '#0f172a',
  },
  blockedTitle:    { color: '#ef4444', fontSize: 24, fontWeight: '900' },
  blockedText:     { color: '#fff', fontSize: 16, textAlign: 'center' },
  blockedSubText:  { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
});
